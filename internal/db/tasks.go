package db

import (
	"context"
	"errors"
	"time"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/vladwithcode/tasktracker/internal/auth"
)

var (
	ErrNilScheduleTask = errors.New("schedule task is nil")
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
	UserID         string `db:"user_id" json:"user_id,omitempty"`
	ScheduleTaskID string `db:"schedule_task_id" json:"schedule_task_id,omitempty"`

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
	CompletedAt time.Time `db:"completed_at" json:"completed_at"`

	CreatedAt time.Time `db:"created_at" json:"created_at"`
	UpdatedAt time.Time `db:"updated_at" json:"updated_at"`
}

// DetailedTask is meant to be used for displaying tasks in the UI.
//
// It contains all the fields of the Task struct, but also adds the
// StartTime, EndTime, and Duration fields from the ScheduleTask struct.
type DetailedTask struct {
	ID             string               `db:"id" json:"id,omitempty"`
	UserID         string               `db:"user_id" json:"user_id,omitempty"`
	ShceduleTaskID string               `db:"schedule_task_id" json:"schedule_task_id,omitempty"`
	Title          string               `db:"title" json:"title,omitempty"`
	Description    string               `db:"description" json:"description,omitempty"`
	Date           time.Time            `db:"date" json:"date,omitzero"`
	Status         TaskStatus           `db:"status" json:"status,omitempty"`
	Priority       ScheduleTaskPriority `db:"priority" json:"priority,omitempty"`
	CompletedAt    time.Time            `db:"completed_at" json:"completed_at,omitzero"`
	StartTime      time.Time            `db:"start_time" json:"start_time,omitzero"`
	EndTime        time.Time            `db:"end_time" json:"end_time,omitzero"`
	Duration       time.Duration        `db:"duration" json:"duration,omitempty"`

	CreatedAt time.Time `db:"created_at" json:"created_at"`
	UpdatedAt time.Time `db:"updated_at" json:"updated_at"`
}

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
		ShceduleTaskID: scheduleTask.ID,
	}
}

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

	user, err := auth.ExtractAuthFromCtx(ctx)
	if err != nil {
		return nil, err
	}

	task := &Task{}

	task.ID = uuid.Must(uuid.NewV7()).String()
	task.UserID = user.ID
	task.ScheduleTaskID = sct.ID
	task.Date = time.Now()
	task.Status = TaskStatusPending

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
		`SELECT (
			id, user_id, schedule_task_id, date, status, completed_at
		) FROM tasks
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
		`SELECT (
			id, user_id, schedule_task_id, title, description, date, status, priority, completed_at, 
			start_time, end_time, duration
		) FROM tasks
		WHERE id = $1`,
		id,
	).Scan(
		&task.ID,
		&task.UserID,
		&task.ShceduleTaskID,
		&task.Title,
		&task.Description,
		&task.Date,
		&task.Status,
		&task.Priority,
		&task.CompletedAt,
		&task.StartTime,
		&task.EndTime,
		&task.Duration,
	)

	if err != nil {
		return nil, err
	}

	return &task, nil
}

func GetTasksByUserID(ctx context.Context, userID string) ([]*Task, error) {
	conn, err := GetConn(ctx)
	if err != nil {
		return nil, err
	}
	defer conn.Release()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	var tasks []*Task

	rows, err := conn.Query(
		ctx,
		`SELECT (
			id, user_id, schedule_task_id, date, status, completed_at
		) FROM tasks WHERE user_id = $1`,
		userID,
	)

	if err != nil {
		return nil, err
	}

	defer rows.Close()

	for rows.Next() {
		var task Task

		err = rows.Scan(
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

		tasks = append(tasks, &task)
	}

	return tasks, nil
}
