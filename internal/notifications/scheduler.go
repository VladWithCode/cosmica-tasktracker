package notifications

import (
	"context"
	"errors"
	"log"
	"time"

	"github.com/jackc/pgx/v5"
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
			s.checkAndNotifyHydration()
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

	type pendingTask struct {
		id, title, description, userID string
	}
	var pending []pendingTask
	for rows.Next() {
		var t pendingTask
		if err := rows.Scan(&t.id, &t.title, &t.description, &t.userID); err != nil {
			log.Printf("Error scanning task: %v", err)
			continue
		}
		pending = append(pending, t)
	}
	if err := rows.Err(); err != nil {
		log.Printf("Error iterating notification tasks: %v", err)
	}
	rows.Close()

	for _, t := range pending {
		payload := &NotificationPayload{
			Title:              "Tarea pendiente: " + t.title,
			Body:               t.description,
			Icon:               "/icon-192x192.png",
			Badge:              "/badge-72x72.png",
			Tag:                "task-" + t.id,
			RequireInteraction: true,
			URL:                "/tasks",
			TaskID:             t.id,
			Actions: []NotificationAction{
				{Action: "view", Title: "View Task"},
				{Action: "complete", Title: "Mark Complete"},
			},
		}

		sentCount, err := SendNotificationToUserWithConfig(s.ctx, t.userID, payload, config)
		if err != nil {
			log.Printf("Error sending notification for task %s: %v", t.id, err)
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
			t.id,
		); err != nil {
			log.Printf("Error marking task notification as sent for %s: %v", t.id, err)
			continue
		}
		log.Printf("Sent notification for task: %s to user: %s", t.title, t.userID)
	}
}

// checkAndNotifyHydration sends a one-per-task-per-day push reminder for water
// routines that have waterReminder=true in their frequency_config.
func (s *TaskScheduler) checkAndNotifyHydration() {
	config := LoadConfigFromEnv()
	if !config.CanSend() {
		return // warnedNoConfig already logged by checkAndNotifyTasks
	}

	conn, err := db.GetConn(s.ctx)
	if err != nil {
		log.Printf("hydration scheduler: error getting DB connection: %v", err)
		return
	}
	defer conn.Release()

	// Active schedule_tasks that have waterReminder enabled.
	rows, err := conn.Query(s.ctx, `
		SELECT st.id, st.user_id, COALESCE(st.title, ''), COALESCE(st.target_count, 0)
		FROM schedule_tasks st
		WHERE st.status_level = 'active'
		  AND (st.frequency_config->>'waterReminder')::boolean IS TRUE
	`)
	if err != nil {
		log.Printf("hydration scheduler: query schedule_tasks: %v", err)
		return
	}

	type waterSchedule struct {
		id, userID, title string
		targetCount       int
	}
	var schedules []waterSchedule
	for rows.Next() {
		var ws waterSchedule
		if err := rows.Scan(&ws.id, &ws.userID, &ws.title, &ws.targetCount); err != nil {
			log.Printf("hydration scheduler: scan: %v", err)
			continue
		}
		schedules = append(schedules, ws)
	}
	if err := rows.Err(); err != nil {
		log.Printf("hydration scheduler: rows err: %v", err)
	}
	rows.Close()

	today := time.Now()

	for _, ws := range schedules {
		task, err := db.GetTaskByScheduleAndDate(s.ctx, ws.id, today)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				continue // no task generated today for this schedule
			}
			log.Printf("hydration scheduler: GetTaskByScheduleAndDate(%s): %v", ws.id, err)
			continue
		}

		// Skip if already completed or fully consumed.
		if task.Status == "completed" || (ws.targetCount > 0 && task.CurrentCount >= ws.targetCount) {
			continue
		}

		// Rate-limit: one reminder per task per day (task_notifications PK = task_id).
		var exists bool
		err = conn.QueryRow(s.ctx,
			`SELECT EXISTS(SELECT 1 FROM task_notifications WHERE task_id = $1)`,
			task.ID,
		).Scan(&exists)
		if err != nil {
			log.Printf("hydration scheduler: check task_notifications(%s): %v", task.ID, err)
			continue
		}
		if exists {
			continue // already notified today
		}

		payload := &NotificationPayload{
			Title:              "Hidratación: " + ws.title,
			Body:               "Recuerda tomar agua 💧",
			Icon:               "/icon-192x192.png",
			Badge:              "/badge-72x72.png",
			Tag:                "water-" + ws.id,
			RequireInteraction: false,
			URL:                "/tasks",
			TaskID:             task.ID,
		}

		sentCount, err := SendNotificationToUserWithConfig(s.ctx, ws.userID, payload, config)
		if err != nil {
			log.Printf("hydration scheduler: send notification for schedule %s: %v", ws.id, err)
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
			task.ID,
		); err != nil {
			log.Printf("hydration scheduler: mark task_notifications(%s): %v", task.ID, err)
			continue
		}
		log.Printf("hydration scheduler: sent reminder for schedule %s to user %s", ws.id, ws.userID)
	}
}
