package notifications

import (
	"context"
	"log"
	"os"
	"time"

	"github.com/vladwithcode/tasktracker/internal/db"
)

type TaskScheduler struct {
	ctx              context.Context
	checkInterval    time.Duration
	reminderLeadTime time.Duration
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
			log.Println("Checking for tasks to notify")
			s.checkAndNotifyTasks()
		}
	}
}

func (s *TaskScheduler) checkAndNotifyTasks() {
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
		SELECT t.id, t.title, t.description, t.start_date, t.user_id
		FROM detailed_tasks t
		WHERE t.status != 'completed'
		  AND t.date IS NOT NULL
		  AND t.date <= $1
		  AND t.date > $2
	`, notifyTime, now)

	if err != nil {
		log.Printf("Error querying tasks: %v", err)
		return
	}

	vapidPrivateKey := os.Getenv("VAPID_PRIVATE_KEY")
	vapidPublicKey := os.Getenv("VAPID_PUBLIC_KEY")
	subscriberEmail := os.Getenv("VAPID_SUBSCRIBER_EMAIL")

	for rows.Next() {
		var taskID, title, description, userID string
		var startDate time.Time

		if err := rows.Scan(&taskID, &title, &description, &startDate, &userID); err != nil {
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
		err := SendNotificationToUser(
			s.ctx,
			userID,
			payload,
			vapidPrivateKey,
			vapidPublicKey,
			subscriberEmail,
		)

		if err != nil {
			log.Printf("Error sending notification for task %s: %v", taskID, err)
			continue
		}
		log.Printf("Sent notification for task: %s to user: %s", title, userID)
	}
}
