package db

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
)

type ScheduleTaskStatus string

const (
	ScheduleTaskStatusActive    ScheduleTaskStatus = "active"
	ScheduleTaskStatusPaused    ScheduleTaskStatus = "paused"
	ScheduleTaskStatusCompleted ScheduleTaskStatus = "completed"
	ScheduleTaskStatusCancelled ScheduleTaskStatus = "cancelled"
)

type ScheduleTaskPriority int

const (
	ScheduleTaskPriorityLow ScheduleTaskPriority = iota
	ScheduleTaskPriorityMedium
	ScheduleTaskPriorityHigh
	ScheduleTaskPriorityUrgent
)

type ScheduleTaskRepeatFrequency string

const (
	ScheduleTaskRepeatFrequencyDaily     ScheduleTaskRepeatFrequency = "daily"
	ScheduleTaskRepeatFrequencyWeekly    ScheduleTaskRepeatFrequency = "weekly"
	ScheduleTaskRepeatFrequencyBiweekly  ScheduleTaskRepeatFrequency = "biweekly"
	ScheduleTaskRepeatFrequencyMonthly   ScheduleTaskRepeatFrequency = "monthly"
	ScheduleTaskRepeatFrequencyBimonthly ScheduleTaskRepeatFrequency = "bimonthly"
	ScheduleTaskRepeatFrequencyYearly    ScheduleTaskRepeatFrequency = "yearly"
)

// ScheduleTasks represent the scheduling of individual day tasks (tasks meant to be completed
// on the current day).
//
// A schedule task may have multiple tasks associated with it if the task is recurring.
// Or just one if the task's Repeating field is set to false.
type ScheduleTask struct {
	ID          string `db:"id" json:"id,omitempty"`
	UserID      string `db:"user_id" json:"user_id,omitempty"`
	Title       string `db:"title" json:"title,omitempty" binding:"required"`
	Description string `db:"description" json:"description,omitempty"`
	// StartTime is the time the task is supposed to be completed. Usually some time
	// during the current day.
	StartTime time.Time `db:"start_time" json:"start_time,omitzero" time_format:"15:04"`
	// EndTime is the time the task is supposed to be completed. Usually some time
	// during the current day.
	EndTime time.Time `db:"end_time" json:"end_time,omitzero" time_format:"15:04"`
	// StartDate is the date the task is supposed to be completed.
	// Normally, this is "today's date" since the task are expected to be completed
	// on the same day.
	//
	// Note that for repeating tasks, the StartDate is used for monthly and bimonthly
	// tasks to determine the day of the month to repeat on.
	StartDate time.Time `db:"start_date" json:"start_date,omitzero" time_format:"2006-01-02"`
	// EndDate is the date the task is supposed to be completed.
	// Normally, this is "today's date" since the task are expected to be completed
	// on the same day.
	EndDate time.Time `db:"end_date" json:"end_date,omitzero" time_format:"2006-01-02"`
	// Duration allows users to define a task that they may complete at any time during the day
	// for a specific duration.
	//
	// If StartTime and EndTime are set, this
	// will be calculated automatically.
	Duration time.Duration `db:"duration" json:"duration,omitempty"`
	// Some tasks may be marked as required, meaning the user wants to give them a special
	// priority in the UI. This is used to determine which tasks are pinned in the UI.
	Required bool `db:"required" json:"required,omitempty"`
	// Repeating indicates whether the task is repeating or not.
	// false by default
	Repeating bool `db:"repeating" json:"repeating,omitempty"`
	// RepeatFrequency is the frequency of the repeating task. This is used to determine
	// when to repeat the task. If no RepeatFrequency is set, the task will repeat
	// on the specified days.
	//
	// Possible values are daily, weekly, biweekly, monthly, bimonthly, yearly
	RepeatFrequency ScheduleTaskRepeatFrequency `db:"repeat_frequency" json:"repeat_frequency,omitempty"`
	// RepeatWeekdays is a 0 indexed list of integers representing the days of the week
	// to repeat on. 0 = sunday.
	//
	// If RepeatFrequency set to weekly, this will be used
	// to determine the day of the week to repeat on, using only the first index and ignoring
	// the rest of the values.
	RepeatWeekdays []int `db:"repeat_weekdays" json:"repeat_weekdays,omitempty"`
	// RepeatInterval is an arbitrary interval in days to repeat on.
	RepeatInterval int `db:"repeat_interval" json:"repeat_interval,omitempty"`
	// RepeatEndDate is the date to stop repeating the task.
	RepeatEndDate time.Time `db:"repeat_end_date" json:"repeat_end_date,omitzero"`
	// Status of the shceduling for this task.
	//
	// Possible values are active, paused, completed, cancelled and stopped.
	Status ScheduleTaskStatus `db:"status" json:"status,omitempty"`
	// Priority is used to determine the order in which tasks are presented to the user
	// in the UI. This value is used to sort tasks in minimal tasklist view and in the pinned (required)
	// tasks list.
	Priority ScheduleTaskPriority `db:"priority" json:"priority,omitempty"`

	CreatedAt time.Time `db:"created_at" json:"created_at"`
	UpdatedAt time.Time `db:"updated_at" json:"updated_at"`
}

func CreateScheduleTask(ctx context.Context, task *ScheduleTask) error {
	conn, err := GetConn(ctx)
	if err != nil {
		return err
	}
	defer conn.Release()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if !task.StartTime.IsZero() && !task.EndTime.IsZero() {
		task.Duration = time.Duration(task.EndTime.Sub(task.StartTime).Minutes())
	}

	args := pgx.NamedArgs{
		"id":              task.ID,
		"userID":          task.UserID,
		"title":           task.Title,
		"description":     task.Description,
		"startTime":       task.StartTime,
		"endTime":         task.EndTime,
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
	}
	_, err = conn.Exec(
		ctx,
		`INSERT INTO schedule_tasks (
			id, title, user_id, description, start_time, end_time, start_date, end_date, duration, required, 
			repeating, repeat_frequency, repeat_interval, repeat_weekdays, repeat_end_date, 
			status, priority
		) VALUES (
			@id, @title, @userID, @description, @startTime, @endTime, @startDate, @endDate, @duration, @required, 
			@repeating, @repeatFrequency, @repeatInterval, @repeatWeekdays, @repeatEndDate, 
			@status, @priority
		)`,
		args,
	)

	return err
}

func UpdateScheduleTask(ctx context.Context, task *ScheduleTask) error {
	conn, err := GetConn(ctx)
	if err != nil {
		return err
	}
	defer conn.Release()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if !task.StartTime.IsZero() && !task.EndTime.IsZero() {
		task.Duration = time.Duration(task.EndTime.Sub(task.StartTime).Minutes())
	}

	args := pgx.NamedArgs{
		"id":              task.ID,
		"userID":          task.UserID,
		"title":           task.Title,
		"description":     task.Description,
		"startTime":       task.StartTime,
		"endTime":         task.EndTime,
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
	}
	_, err = conn.Exec(
		ctx,
		`UPDATE schedule_tasks SET
			title = @title, description = @description, start_time = @startTime, 
			end_time = @endTime, start_date = @startDate, end_date = @endDate, 
			duration = @duration, required = @required, repeating = @repeating, 
			repeat_frequency = @repeatFrequency, repeat_interval = @repeatInterval, 
			repeat_weekdays = @repeatWeekdays, repeat_end_date = @repeatEndDate, 
			status = @status, priority = @priority
		WHERE id = @id`,
		args,
	)

	return err
}
func GetScheduleTaskByID(ctx context.Context, id string) (*ScheduleTask, error) {
	conn, err := GetConn(ctx)
	if err != nil {
		return nil, err
	}
	defer conn.Release()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	var task ScheduleTask

	err = conn.QueryRow(
		ctx,
		`SELECT (
			id, title, description, start_time, end_time, start_date, end_date, duration, required,
			repeating, repeat_frequency, repeat_interval, repeat_weekdays, repeat_end_date,
			status, priority, user_id
		) FROM schedule_tasks
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

func GetScheduleTasksByUserID(ctx context.Context, userID string) ([]*ScheduleTask, error) {
	conn, err := GetConn(ctx)
	if err != nil {
		return nil, err
	}
	defer conn.Release()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	var tasks []*ScheduleTask

	rows, err := conn.Query(
		ctx,
		`SELECT (
			id, title, description, start_time, end_time, start_date, end_date, duration, required,
			repeating, repeat_frequency, repeat_interval, repeat_weekdays, repeat_end_date,
			status, priority, user_id
		) FROM schedule_tasks WHERE user_id = $1`,
		userID,
	)

	if err != nil {
		return nil, err
	}

	defer rows.Close()

	for rows.Next() {
		var task ScheduleTask

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

func DeleteScheduleTask(ctx context.Context, task *ScheduleTask) error {
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
		`DELETE FROM schedule_tasks WHERE id = $1`,
		args,
	)

	return err
}

func getUserActiveScheduleTasks(ctx context.Context, userID string) ([]*ScheduleTask, error) {
	conn, err := GetConn(ctx)
	if err != nil {
		return nil, err
	}
	defer conn.Release()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	var tasks []*ScheduleTask
	rows, err := conn.Query(ctx, `
		SELECT id, title, description, start_time, end_time, start_date, end_date,
			   repeating, repeat_frequency, repeat_weekdays, repeat_interval, repeat_end_date,
			   status, priority, user_id, created_at, updated_at
		FROM schedule_tasks 
		WHERE user_id = $1 AND status = 'active'`, userID)

	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var task ScheduleTask
		err = rows.Scan(&task.ID, &task.Title, &task.Description,
			&task.StartTime, &task.EndTime, &task.StartDate, &task.EndDate,
			&task.Repeating, &task.RepeatFrequency, &task.RepeatWeekdays,
			&task.RepeatInterval, &task.RepeatEndDate, &task.Status,
			&task.Priority, &task.UserID, &task.CreatedAt, &task.UpdatedAt)
		if err != nil {
			return nil, err
		}
		tasks = append(tasks, &task)
	}

	return tasks, nil
}
