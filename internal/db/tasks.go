package db

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"slices"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/vladwithcode/tasktracker/internal/util"
)

var (
	// ErrNilScheduleTask is returned when a nil schedule task is passed to the
	// CreateTaskForSchedule function
	ErrNilScheduleTask = errors.New("schedule task is nil")
	// ErrNoWeekdayForWeeklyTask is returned when a weekly/biweekly task is created
	// without any repeat weekdays set
	ErrNoWeekdayForWeeklyTask = fmt.Errorf("no repeat weekdays set for weekly/biweekly repeat")
)

type TaskStatus string

const (
	TaskStatusPending   TaskStatus = "pending"
	TaskStatusCompleted TaskStatus = "completed"
	TaskStatusOverdue   TaskStatus = "overdue"
	TaskStatusCancelled TaskStatus = "cancelled"
)

type Task struct {
	ID             string `db:"id" json:"id,omitempty"`
	UserID         string `db:"user_id" json:"userId,omitempty"`
	ScheduleTaskID string `db:"schedule_task_id" json:"scheduleTaskId,omitempty"`

	// The date the task is meant to be completed.
	// Normally, this is "today's date" since the task are expected to be completed
	// on the same day.
	Date time.Time `db:"date" json:"date,omitzero"`
	// The status of the shceduling for this task.
	//
	// Possible values are pending, completed, overdue and cancelled
	Status TaskStatus `db:"status" json:"status,omitempty"`
	// The time the task is supposed to be completed. Usually some time
	// during the current day.
	CompletedAt time.Time `db:"completed_at" json:"completedAt,omitzero"`

	CreatedAt time.Time `db:"created_at" json:"created_at,omitzero"`
	UpdatedAt time.Time `db:"updated_at" json:"updated_at,omitzero"`
}

// DetailedTask is meant to be used for displaying tasks in the UI.
//
// It contains all the fields of the Task struct, but also adds the
// StartTime, EndTime, and Duration fields from the ScheduleTask struct.
type DetailedTask struct {
	ID             string               `db:"id" json:"id,omitempty"`
	UserID         string               `db:"user_id" json:"userId,omitempty"`
	ScheduleTaskID string               `db:"schedule_task_id" json:"scheduleTaskId,omitempty"`
	Title          string               `db:"title" json:"title,omitempty"`
	Description    string               `db:"description" json:"description,omitempty"`
	Date           time.Time            `db:"date" json:"date,omitzero"`
	Status         TaskStatus           `db:"status" json:"status,omitempty"`
	Priority       ScheduleTaskPriority `db:"priority" json:"priority,omitempty"`
	CompletedAt    time.Time            `db:"completed_at" json:"completedAt,omitzero"`
	StartTime      time.Time            `db:"start_time" json:"startTime,omitzero"`
	EndTime        time.Time            `db:"end_time" json:"endTime,omitzero"`
	Duration       time.Duration        `db:"duration" json:"duration,omitempty"`

	CreatedAt time.Time `db:"created_at" json:"createdAt"`
	UpdatedAt time.Time `db:"updated_at" json:"updatedAt"`
}

// NewDetailedTask creates a new DetailedTask struct based on the provided task and schedule task.
func NewDetailedTask(task *Task, scheduleTask *ScheduleTask) *DetailedTask {
	return &DetailedTask{
		Title:          scheduleTask.Title,
		Description:    scheduleTask.Description,
		Date:           task.Date,
		Status:         task.Status,
		Priority:       scheduleTask.Priority,
		CompletedAt:    task.CompletedAt,
		StartTime:      scheduleTask.StartTime,
		EndTime:        scheduleTask.EndTime,
		Duration:       scheduleTask.Duration,
		ID:             task.ID,
		UserID:         task.UserID,
		ScheduleTaskID: scheduleTask.ID,
	}
}

func CreateUsersTodayTasks(ctx context.Context, userID string) ([]*DetailedTask, error) {
	// Get user's active schedule tasks
	scheduleTasks, err := getUserActiveScheduleTasks(ctx, userID)
	if err != nil {
		return nil, err
	}

	today := time.Now()
	var todayTasks []*DetailedTask

	for _, scheduleTask := range scheduleTasks {
		if shouldCreateTaskForToday(scheduleTask, today) {
			// Check if task already exists for today
			existingTask, err := GetTaskByScheduleAndDate(ctx, scheduleTask.ID, today)
			if err != nil && !errors.Is(err, pgx.ErrNoRows) {
				return nil, err
			}

			var task *Task
			if existingTask == nil {
				// Create new task for today
				task, err = createTaskForDate(ctx, scheduleTask, today)
				if err != nil {
					return nil, err
				}
			} else {
				task = existingTask
			}

			// Set appropriate status based on current time
			task.Status = determineTaskStatus(scheduleTask, today)
			if existingTask != nil {
				err = UpdateTask(ctx, task)
				if err != nil {
					return nil, err
				}
			}

			// Create detailed task for response
			detailedTask := NewDetailedTask(task, scheduleTask)
			todayTasks = append(todayTasks, detailedTask)
		}
	}

	return todayTasks, nil
}

// Check if task should be created for today
func shouldCreateTaskForToday(scheduleTask *ScheduleTask, today time.Time) bool {
	// Check if repeat has ended
	if !scheduleTask.RepeatEndDate.IsZero() {
		if util.AfterDate(today, scheduleTask.RepeatEndDate) {
			return false
		}
	}

	// Non-repeating tasks
	if !scheduleTask.Repeating {
		if !scheduleTask.StartDate.IsZero() {
			return scheduleTask.StartDate.Equal(today)
		}
		return true // One-time task without specific date
	}

	// Repeating tasks
	return shouldRepeatToday(scheduleTask, today)
}

// Determine if repeating task should run today
func shouldRepeatToday(scheduleTask *ScheduleTask, today time.Time) bool {
	switch scheduleTask.RepeatFrequency {
	case ScheduleTaskRepeatFrequencyDaily:
		return true
	case ScheduleTaskRepeatFrequencyWeekly:
		return slices.Contains(scheduleTask.RepeatWeekdays, int(today.Weekday()))
	// Biweekly is for "quincenal" tasks, meaning that the task should be repeated every 15 days
	case ScheduleTaskRepeatFrequencyBiweekly:
		if len(scheduleTask.RepeatWeekdays) > 0 {
			daysDiff := int(today.Sub(scheduleTask.StartDate).Hours() / 24)
			// When there's 15 days until the next repeat day, the task should be repeated if it's on the same weekday
			// the user specified.
			return daysDiff%15 == 0 && slices.Contains(scheduleTask.RepeatWeekdays, int(today.Weekday()))
		}
		return false
	case ScheduleTaskRepeatFrequencyMonthly:
		return scheduleTask.StartDate.Day() == today.Day()
	case ScheduleTaskRepeatFrequencyBimonthly:
		// TODO: explain this
		monthsDiff := (today.Year()-scheduleTask.StartDate.Year())*12 + int(today.Month()) - int(scheduleTask.StartDate.Month())
		return monthsDiff%2 == 0 && scheduleTask.StartDate.Day() == today.Day()
	case ScheduleTaskRepeatFrequencyYearly:
		return scheduleTask.StartDate.Month() == today.Month() && scheduleTask.StartDate.Day() == today.Day()
	}

	// Custom weekdays or interval
	if len(scheduleTask.RepeatWeekdays) > 0 {
		return slices.Contains(scheduleTask.RepeatWeekdays, int(today.Weekday()))
	}

	if scheduleTask.RepeatInterval > 0 {
		daysDiff := int(today.Sub(scheduleTask.StartDate).Hours() / 24)
		return daysDiff%scheduleTask.RepeatInterval == 0
	}

	return false
}

// Determine task status based on current time vs start/end times
func determineTaskStatus(scheduleTask *ScheduleTask, now time.Time) TaskStatus {
	if scheduleTask.StartTime.IsZero() && scheduleTask.EndTime.IsZero() {
		return TaskStatusPending
	}

	currentTime := time.Date(0, 1, 1, now.Hour(), now.Minute(), now.Second(), now.Nanosecond(), now.Location())

	if !scheduleTask.StartTime.IsZero() {
		if util.BeforeTime(currentTime, scheduleTask.StartTime) {
			return TaskStatusPending
		}
	}

	if !scheduleTask.EndTime.IsZero() {
		if util.AfterTime(currentTime, scheduleTask.EndTime) {
			return TaskStatusOverdue
		}
	}

	return TaskStatusPending
}

// Helper functions
func createTaskForDate(ctx context.Context, scheduleTask *ScheduleTask, date time.Time) (*Task, error) {
	conn, err := GetConn(ctx)
	if err != nil {
		return nil, err
	}
	defer conn.Release()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	task := &Task{
		ID:             uuid.Must(uuid.NewV7()).String(),
		UserID:         scheduleTask.UserID,
		ScheduleTaskID: scheduleTask.ID,
		Date:           date,
		Status:         TaskStatusPending,
	}

	_, err = conn.Exec(ctx, `
		INSERT INTO tasks (id, user_id, schedule_task_id, date, status)
		VALUES ($1, $2, $3, $4, $5)`,
		task.ID, task.UserID, task.ScheduleTaskID, task.Date, task.Status)

	if err != nil {
		return nil, err
	}

	return task, nil
}

func GetTaskByScheduleAndDate(ctx context.Context, scheduleTaskID string, date time.Time) (*Task, error) {
	conn, err := GetConn(ctx)
	if err != nil {
		return nil, err
	}
	defer conn.Release()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	var task Task
	err = conn.QueryRow(ctx, `
		SELECT id, user_id, schedule_task_id, date, status, completed_at, created_at, updated_at
		FROM tasks WHERE schedule_task_id = $1 AND date = $2`,
		scheduleTaskID, date).Scan(
		&task.ID, &task.UserID, &task.ScheduleTaskID, &task.Date,
		&task.Status, &task.CompletedAt, &task.CreatedAt, &task.UpdatedAt)

	if err != nil {
		return nil, err
	}

	return &task, nil
}

func UpdateTask(ctx context.Context, task *Task) error {
	conn, err := GetConn(ctx)
	if err != nil {
		return err
	}
	defer conn.Release()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	_, err = conn.Exec(ctx, `
		UPDATE tasks SET
			date = $2, status = $3, completed_at = $4
		WHERE id = $1`,
		task.ID, task.Date, task.Status, task.CompletedAt)

	return err
}

func DeleteTask(ctx context.Context, task *Task) error {
	conn, err := GetConn(ctx)
	if err != nil {
		return err
	}
	defer conn.Release()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	_, err = conn.Exec(ctx, `DELETE FROM tasks WHERE id = $1`, task.ID)
	return err
}

// CreateTaskForSchedule creates a task based on the provided schedule task settings
func CreateTaskForSchedule(ctx context.Context, sct *ScheduleTask) (*Task, error) {
	if sct == nil {
		return nil, ErrNilScheduleTask
	}
	conn, err := GetConn(ctx)
	if err != nil {
		return nil, err
	}
	defer conn.Release()
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	task := &Task{}

	task.ID = uuid.Must(uuid.NewV7()).String()
	task.UserID = sct.UserID
	task.ScheduleTaskID = sct.ID
	task.Status = TaskStatusPending

	task.Date, err = getNextTaskDate(sct)
	if err != nil {
		return nil, err
	}

	_, err = conn.Exec(
		ctx,
		`INSERT INTO tasks (
			id, user_id, schedule_task_id, date, status
		) VALUES (
			@id, @user_id, @schedule_task_id, @date, @status
		)`,
		pgx.NamedArgs{
			"id":               task.ID,
			"user_id":          task.UserID,
			"schedule_task_id": task.ScheduleTaskID,
			"date":             task.Date,
			"status":           task.Status,
		},
	)

	if err != nil {
		return nil, err
	}

	return task, nil
}

// GetTaskByID returns a plain task based on the provided task ID.
//
// This is meant for basic per task operations, such as updating a task's status.
func GetTaskByID(ctx context.Context, id string) (*Task, error) {
	conn, err := GetConn(ctx)
	if err != nil {
		return nil, err
	}
	defer conn.Release()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	var task Task

	err = conn.QueryRow(
		ctx,
		`SELECT
			id, user_id, schedule_task_id, date, status, completed_at
		FROM tasks
		WHERE id = $1`,
		id,
	).Scan(
		&task.ID,
		&task.UserID,
		&task.ScheduleTaskID,
		&task.Date,
		&task.Status,
		&task.CompletedAt,
	)

	if err != nil {
		return nil, err
	}

	return &task, nil
}

// GetTaskDetailsByID returns a detailed task based on the provided task ID.
//
// This is meant to be used for displaying tasks in the UI.
func GetTaskDetailsByID(ctx context.Context, id string) (*DetailedTask, error) {
	conn, err := GetConn(ctx)
	if err != nil {
		return nil, err
	}
	defer conn.Release()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	var task DetailedTask

	err = conn.QueryRow(
		ctx,
		`SELECT
			id, user_id, schedule_task_id, title, description, date, status, priority,
			start_time, end_time, completed_at, duration
		 FROM detailed_tasks WHERE id = $1`,
		id,
	).Scan(
		&task.ID,
		&task.UserID,
		&task.ScheduleTaskID,
		&task.Title,
		&task.Description,
		&task.Date,
		&task.Status,
		&task.Priority,
		&task.StartTime,
		&task.EndTime,
		&task.CompletedAt,
		&task.Duration,
	)

	if err != nil {
		return nil, err
	}

	return &task, nil
}

// GetTasksByUserID returns a list of detailed tasks based on the provided user ID.
//
// This is meant to be used for displaying tasks in the UI.
func GetTasksByUserID(ctx context.Context, userID string) ([]*DetailedTask, error) {
	conn, err := GetConn(ctx)
	if err != nil {
		return nil, err
	}
	defer conn.Release()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	var tasks []*DetailedTask

	rows, err := conn.Query(
		ctx,
		`SELECT 
			id, user_id, schedule_task_id, title, description, date, status, priority,
			start_time, end_time, completed_at, duration, created_at, updated_at
		FROM detailed_tasks WHERE user_id = $1`,
		userID,
	)

	if err != nil {
		return nil, err
	}

	defer rows.Close()

	for rows.Next() {
		var (
			task        DetailedTask
			completedAt sql.NullTime
		)

		err = rows.Scan(
			&task.ID,
			&task.UserID,
			&task.ScheduleTaskID,
			&task.Title,
			&task.Description,
			&task.Date,
			&task.Status,
			&task.Priority,
			&task.StartTime,
			&task.EndTime,
			&completedAt,
			&task.Duration,
			&task.CreatedAt,
			&task.UpdatedAt,
		)

		if err != nil {
			return nil, err
		}

		if completedAt.Valid {
			task.CompletedAt = completedAt.Time
		}

		tasks = append(tasks, &task)
	}

	return tasks, nil
}

// GetUserDetailedTasksForToday returns a list of detailed tasks for the specified user for today.
// This queries the detailed_tasks view and filters by user_id and today's date.
func GetUserTodayDetailedTasks(ctx context.Context, userID string) ([]*DetailedTask, error) {
	conn, err := GetConn(ctx)
	if err != nil {
		return nil, err
	}
	defer conn.Release()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	var tasks []*DetailedTask

	rows, err := conn.Query(
		ctx,
		`SELECT
			id, user_id, schedule_task_id, title, description, date, status, priority,
			start_time, end_time, completed_at, duration, created_at, updated_at
		FROM detailed_tasks
		WHERE user_id = $1 AND DATE(date) = CURRENT_DATE
		ORDER BY start_time ASC`,
		userID,
	)

	if err != nil {
		return nil, err
	}

	defer rows.Close()

	for rows.Next() {
		var (
			task        DetailedTask
			completedAt sql.NullTime
		)

		err = rows.Scan(
			&task.ID,
			&task.UserID,
			&task.ScheduleTaskID,
			&task.Title,
			&task.Description,
			&task.Date,
			&task.Status,
			&task.Priority,
			&task.StartTime,
			&task.EndTime,
			&completedAt,
			&task.Duration,
			&task.CreatedAt,
			&task.UpdatedAt,
		)

		if err != nil {
			return nil, err
		}

		if completedAt.Valid {
			task.CompletedAt = completedAt.Time
		}

		tasks = append(tasks, &task)
	}

	return tasks, nil
}

// getNextTaskDate returns the next date for the schedule task based on the
// current time and the schedule task's settings
func getNextTaskDate(sct *ScheduleTask) (time.Time, error) {
	currentTime := time.Now()
	nextDate := currentTime.AddDate(0, 0, 1)

	if sct.RepeatFrequency != "" {
		switch sct.RepeatFrequency {
		case ScheduleTaskRepeatFrequencyDaily:
			nextDate = currentTime.AddDate(0, 0, 1)
		case ScheduleTaskRepeatFrequencyMonthly:
			nextDate = currentTime.AddDate(0, 1, 0)
		case ScheduleTaskRepeatFrequencyBimonthly:
			nextDate = currentTime.AddDate(0, 2, 0)
		case ScheduleTaskRepeatFrequencyYearly:
			nextDate = currentTime.AddDate(1, 0, 0)
		case ScheduleTaskRepeatFrequencyWeekly:
			if len(sct.RepeatWeekdays) == 0 {
				return time.Time{}, ErrNoWeekdayForWeeklyTask
			}
			addAmount := int(currentTime.Weekday()) - int(sct.RepeatWeekdays[0])
			if addAmount < 0 {
				addAmount += 7
			}
			nextDate = currentTime.AddDate(0, 0, addAmount)
		case ScheduleTaskRepeatFrequencyBiweekly:
			if len(sct.RepeatWeekdays) == 0 {
				return time.Time{}, ErrNoWeekdayForWeeklyTask
			}
			addAmount := int(currentTime.Weekday()) - int(sct.RepeatWeekdays[0])
			if addAmount < 0 {
				addAmount += 14
			}
			nextDate = currentTime.AddDate(0, 0, addAmount)
		}
	} else if len(sct.RepeatWeekdays) > 0 {
		wkd := int(currentTime.Weekday())
		nextWeekday := 0
		for i, rptWkd := range sct.RepeatWeekdays {
			if wkd == rptWkd {
				nextWeekday = i
				break
			}
		}
		addAmount := nextWeekday - int(wkd)
		if addAmount < 0 {
			addAmount += 7
		}
		nextDate = currentTime.AddDate(0, 0, addAmount)
	} else if sct.RepeatInterval > 0 {
		nextDate = currentTime.AddDate(0, 0, sct.RepeatInterval)
	}

	return nextDate, nil
}
