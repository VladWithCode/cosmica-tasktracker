package notifications

import (
	"context"
	"log"
	"time"

	"github.com/vladwithcode/tasktracker/internal/db"
)

type TaskScheduler struct {
	ctx              context.Context
	checkInterval    time.Duration
	reminderLeadTime time.Duration
	warnedNoConfig   bool
}

func NewTaskScheduler(ctx context.Context) *TaskScheduler {
	return &TaskScheduler{
		ctx:              ctx,
		checkInterval:    1 * time.Minute, // Check every minute
		reminderLeadTime: 5 * time.Minute, // Notify 5 minutes before task
	}
}

func (s *TaskScheduler) Start() {
	ticker := time.NewTicker(s.checkInterval)
	defer ticker.Stop()

	log.Println("Task scheduler started")

	for {
		select {
		case <-s.ctx.Done():
			log.Println("Task scheduler stopped")
			return
		case <-ticker.C:
			s.checkAndNotifyTasks()
		}
	}
}

func (s *TaskScheduler) checkAndNotifyTasks() {
	config := LoadConfigFromEnv()
	if !config.CanSend() {
		if !s.warnedNoConfig {
			log.Println("Task scheduler: Web Push disabled because VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY is missing")
			s.warnedNoConfig = true
		}
		return
	}

	conn, err := db.GetConn(s.ctx)
	if err != nil {
		log.Printf("Error getting DB connection: %v", err)
		return
	}
	defer conn.Release()

	// Find tasks that are starting soon and haven't been notified
	now := time.Now()
	notifyTime := now.Add(s.reminderLeadTime)

	rows, err := conn.Query(s.ctx, `
		SELECT t.id, t.title, COALESCE(t.description, ''), t.user_id
		FROM detailed_tasks t
		LEFT JOIN task_notifications tn ON tn.task_id = t.id
		WHERE t.status != 'completed'
		  AND t.status != 'skipped'
		  AND t.status != 'failed'
		  AND t.date IS NOT NULL
		  AND t.start_time IS NOT NULL
		  AND tn.task_id IS NULL
		  AND (DATE(t.date) + t.start_time)::timestamptz <= $1
		  AND (DATE(t.date) + t.start_time)::timestamptz > $2
	`, notifyTime, now)

	if err != nil {
		log.Printf("Error querying tasks: %v", err)
		return
	}
	defer rows.Close()

	for rows.Next() {
		var taskID, title, description, userID string

		if err := rows.Scan(&taskID, &title, &description, &userID); err != nil {
			log.Printf("Error scanning task: %v", err)
			continue
		}

		// Create notification payload
		payload := &NotificationPayload{
			Title:              "Tarea pendiente: " + title,
			Body:               description,
			Icon:               "/icon-192x192.png",
			Badge:              "/badge-72x72.png",
			Tag:                "task-" + taskID,
			RequireInteraction: true,
			URL:                "/tasks",
			TaskID:             taskID,
			Actions: []NotificationAction{
				{Action: "view", Title: "View Task"},
				{Action: "complete", Title: "Mark Complete"},
			},
		}

		// Send notification
		sentCount, err := SendNotificationToUserWithConfig(
			s.ctx,
			userID,
			payload,
			config,
		)

		if err != nil {
			log.Printf("Error sending notification for task %s: %v", taskID, err)
			continue
		}
		if sentCount == 0 {
			continue
		}
		if _, err := conn.Exec(
			s.ctx,
			`INSERT INTO task_notifications (task_id, sent_at)
			 VALUES ($1, CURRENT_TIMESTAMP)
			 ON CONFLICT (task_id) DO NOTHING`,
			taskID,
		); err != nil {
			log.Printf("Error marking task notification as sent for %s: %v", taskID, err)
			continue
		}
		log.Printf("Sent notification for task: %s to user: %s", title, userID)
	}
	if err := rows.Err(); err != nil {
		log.Printf("Error iterating notification tasks: %v", err)
	}
}
