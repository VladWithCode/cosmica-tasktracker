package db

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
)

type Task struct {
	ID              string        `db:"id" json:"id"`
	Title           string        `db:"title" json:"title"`
	Description     string        `db:"description" json:"description"`
	StartDate       string        `db:"start_date" json:"start_date"`
	EndDate         string        `db:"end_date" json:"end_date"`
	Duration        time.Duration `db:"duration" json:"duration"`
	Required        bool          `db:"required" json:"required"`
	Repeating       bool          `db:"repeating" json:"repeating"`
	RepeatFrequency string        `db:"repeat_frequency" json:"repeat_frequency"`
	RepeatInterval  int           `db:"repeat_interval" json:"repeat_interval"`
	RepeatWeekdays  []int         `db:"repeat_weekdays" json:"repeat_weekdays"`
	RepeatEndDate   string        `db:"repeat_end_date" json:"repeat_end_date"`
	Status          string        `db:"status" json:"status"`
	Priority        int           `db:"priority" json:"priority"`
	UserID          string        `db:"user_id" json:"user_id"`

	DoneAt    time.Time `db:"done_at" json:"done_at"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
	UpdatedAt time.Time `db:"updated_at" json:"updated_at"`
}

func CreateTask(ctx context.Context, task *Task) error {
	conn, err := GetConn(ctx)
	if err != nil {
		return err
	}
	defer conn.Release()

	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	args := pgx.NamedArgs{
		"title":           task.Title,
		"description":     task.Description,
		"startDate":       task.StartDate,
		"endDate":         task.EndDate,
		"duration":        task.Duration,
		"required":        task.Required,
		"repeating":       task.Repeating,
		"repeatFrequency": task.RepeatFrequency,
		"repeatInterval":  task.RepeatInterval,
		"repeatWeekdays":  task.RepeatWeekdays,
		"repeatEndDate":   task.RepeatEndDate,
		"status":          task.Status,
		"priority":        task.Priority,
		"userID":          task.UserID,
	}
	_, err = conn.Exec(
		ctx,
		`INSERT INTO tasks (
			id, title, description, start_date, end_date, duration, required, repeating,
			repeat_frequency, repeat_interval, repeat_weekdays, repeat_end_date, 
			status, priority, user_id
		) VALUES (
			@id, @title, @description, @startDate, @endDate, @duration, @required, 
			@repeating, @repeatFrequency, @repeatInterval, @repeatWeekdays, @repeatEndDate, 
			@status, @priority, @userID
		)`,
		args,
	)

	if err != nil {
		return err
	}

	return nil
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
			id, title, description, start_date, end_date, duration, required, 
			repeating, repeat_frequency, repeat_interval, repeat_weekdays, repeat_end_date,
			status, priority, user_id
		) FROM tasks
		WHERE id = $1`,
		id,
	).Scan(
		&task.ID,
		&task.Title,
		&task.Description,
		&task.StartDate,
		&task.EndDate,
		&task.Duration,
		&task.Required,
		&task.Repeating,
		&task.RepeatFrequency,
		&task.RepeatInterval,
		&task.RepeatWeekdays,
		&task.RepeatEndDate,
		&task.Status,
		&task.Priority,
		&task.UserID,
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
			id, title, description, start_date, end_date, duration, required, 
			repeating, repeat_frequency, repeat_interval, repeat_weekdays, repeat_end_date,
			status, priority, user_id
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
			&task.Title,
			&task.Description,
			&task.StartDate,
			&task.EndDate,
			&task.Duration,
			&task.Required,
			&task.Repeating,
			&task.RepeatFrequency,
			&task.RepeatInterval,
			&task.RepeatWeekdays,
			&task.RepeatEndDate,
			&task.Status,
			&task.Priority,
			&task.UserID,
		)

		if err != nil {
			return nil, err
		}

		tasks = append(tasks, &task)
	}

	return tasks, nil
}

func UpdateTask(ctx context.Context, task *Task) error {
	conn, err := GetConn(ctx)
	if err != nil {
		return err
	}
	defer conn.Release()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	args := pgx.NamedArgs{
		"title":           task.Title,
		"description":     task.Description,
		"startDate":       task.StartDate,
		"endDate":         task.EndDate,
		"duration":        task.Duration,
		"required":        task.Required,
		"repeating":       task.Repeating,
		"repeatFrequency": task.RepeatFrequency,
		"repeatInterval":  task.RepeatInterval,
		"repeatWeekdays":  task.RepeatWeekdays,
		"repeatEndDate":   task.RepeatEndDate,
		"status":          task.Status,
		"priority":        task.Priority,
		"userID":          task.UserID,
		"id":              task.ID,
	}
	_, err = conn.Exec(
		ctx,
		`UPDATE tasks SET
			title = @title, description = @description, start_date = @startDate, 
			end_date = @endDate, duration = @duration, required = @required, 
			repeating = @repeating, repeat_frequency = @repeatFrequency, 
			repeat_interval = @repeatInterval, repeat_weekdays = @repeatWeekdays, 
			repeat_end_date = @repeatEndDate, status = @status, priority = @priority, 
			user_id = @userID
		WHERE id = @id`,
		args,
	)

	return err
}

func DeleteTaskByID(ctx context.Context, id string) error {
	conn, err := GetConn(ctx)
	if err != nil {
		return err
	}
	defer conn.Release()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	args := pgx.NamedArgs{
		"id": id,
	}
	_, err = conn.Exec(
		ctx,
		`DELETE FROM tasks WHERE id = $1`,
		args,
	)

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

	args := pgx.NamedArgs{
		"id": task.ID,
	}
	_, err = conn.Exec(
		ctx,
		`DELETE FROM tasks WHERE id = $1`,
		args,
	)

	return err
}
