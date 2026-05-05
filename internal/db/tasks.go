package db

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log"
	"math"
	"slices"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/vladwithcode/tasktracker/internal/util"
)

var (
	ErrNilScheduleTask        = errors.New("schedule task is nil")
	ErrNoWeekdayForWeeklyTask = fmt.Errorf("no repeat weekdays set for weekly/biweekly repeat")
)

type TaskStatus string

const (
	TaskStatusPending    TaskStatus = "pending"
	TaskStatusInProgress TaskStatus = "in_progress"
	TaskStatusCompleted  TaskStatus = "completed"
	TaskStatusSkipped    TaskStatus = "skipped"
	TaskStatusFailed     TaskStatus = "failed"
)

type Task struct {
	ID             string     `db:"id" json:"id,omitempty"`
	UserID         string     `db:"user_id" json:"userId,omitempty"`
	ScheduleTaskID string     `db:"schedule_task_id" json:"scheduleTaskId,omitempty"`
	Title          string     `db:"title" json:"title,omitempty"`
	Description    string     `db:"description" json:"description,omitempty"`
	Date           time.Time  `db:"date" json:"date,omitzero"`
	Status         TaskStatus `db:"status_level" json:"status,omitempty"`
	CompletedAt    time.Time  `db:"completed_at" json:"completedAt,omitzero"`
	ActualStart    time.Time  `db:"actual_start" json:"actualStart,omitzero"`
	ActualEnd      time.Time  `db:"actual_end" json:"actualEnd,omitzero"`
	CurrentCount   int        `db:"current_count" json:"currentCount"`
	TargetCount    *int       `db:"target_count" json:"targetCount,omitempty"`
	Notes          string     `db:"notes" json:"notes,omitempty"`
	CreatedAt      time.Time  `db:"created_at" json:"createdAt,omitzero"`
	UpdatedAt      time.Time  `db:"updated_at" json:"updatedAt,omitzero"`
}

type DetailedTask struct {
	ID             string                `db:"id" json:"id,omitempty"`
	UserID         string                `db:"user_id" json:"userId,omitempty"`
	ScheduleTaskID string                `db:"schedule_task_id" json:"scheduleTaskId,omitempty"`
	Title          string                `db:"title" json:"title,omitempty"`
	Description    string                `db:"description" json:"description,omitempty"`
	Date           time.Time             `db:"date" json:"date,omitzero"`
	Status         TaskStatus            `db:"status" json:"status,omitempty"`
	Priority       ScheduleTaskPriority  `db:"priority" json:"priority,omitempty"`
	Required       bool                  `db:"required" json:"required,omitempty"`
	IsRequired     bool                  `db:"is_required" json:"isRequired,omitempty"`
	CompletedAt    time.Time             `db:"completed_at" json:"completedAt,omitzero"`
	ActualStart    time.Time             `db:"actual_start" json:"actualStart,omitzero"`
	ActualEnd      time.Time             `db:"actual_end" json:"actualEnd,omitzero"`
	StartTime      time.Time             `db:"start_time" json:"startTime,omitzero"`
	EndTime        time.Time             `db:"end_time" json:"endTime,omitzero"`
	StartDate      time.Time             `db:"start_date" json:"startDate,omitzero"`
	EndDate        time.Time             `db:"end_date" json:"endDate,omitzero"`
	Duration       int                   `db:"duration" json:"duration,omitempty"`
	CurrentCount   int                   `db:"current_count" json:"currentCount"`
	TargetCount    *int                  `db:"target_count" json:"targetCount,omitempty"`
	Notes          string                `db:"notes" json:"notes,omitempty"`
	Frequency      ScheduleTaskFrequency `db:"frequency" json:"frequency,omitempty"`
	Category       string                `db:"category" json:"category,omitempty"`
	CreatedAt      time.Time             `db:"created_at" json:"createdAt"`
	UpdatedAt      time.Time             `db:"updated_at" json:"updatedAt"`
}

type TaskCompletion struct {
	ID          string    `db:"id" json:"id,omitempty"`
	TaskID      string    `db:"task_id" json:"taskId,omitempty"`
	UserID      string    `db:"user_id" json:"userId,omitempty"`
	CompletedAt time.Time `db:"completed_at" json:"completedAt"`
	ActualStart time.Time `db:"actual_start" json:"actualStart,omitzero"`
	ActualEnd   time.Time `db:"actual_end" json:"actualEnd,omitzero"`
	Count       int       `db:"count" json:"count"`
	Notes       string    `db:"notes" json:"notes,omitempty"`
}

type TaskFeedItem struct {
	ID                string     `json:"id"`
	Title             string     `json:"title"`
	Description       string     `json:"description,omitempty"`
	ScheduleID        string     `json:"schedule_id"`
	PriorityLevel     string     `json:"priority_level"`
	StatusLevel       string     `json:"status_level"`
	IsRequired        bool       `json:"is_required"`
	ScheduleStartTime *string    `json:"schedule_start_time,omitempty"`
	ScheduleEndTime   *string    `json:"schedule_end_time,omitempty"`
	DurationMinutes   *int       `json:"duration_minutes,omitempty"`
	TargetCount       *int       `json:"target_count,omitempty"`
	CurrentCount      int        `json:"current_count"`
	CreatedAt         time.Time  `json:"created_at"`
	CompletedAt       *time.Time `json:"completed_at,omitempty"`
}

func NewDetailedTask(task *Task, scheduleTask *ScheduleTask) *DetailedTask {
	title := scheduleTask.Title
	description := scheduleTask.Description
	if task.Title != "" {
		title = task.Title
	}
	if task.Description != "" {
		description = task.Description
	}

	return &DetailedTask{
		ID:             task.ID,
		UserID:         task.UserID,
		ScheduleTaskID: scheduleTask.ID,
		Title:          title,
		Description:    description,
		Date:           task.Date,
		Status:         task.Status,
		Priority:       scheduleTask.Priority,
		Required:       scheduleTask.IsRequired,
		IsRequired:     scheduleTask.IsRequired,
		CompletedAt:    task.CompletedAt,
		ActualStart:    task.ActualStart,
		ActualEnd:      task.ActualEnd,
		StartTime:      scheduleTask.StartTime,
		EndTime:        scheduleTask.EndTime,
		StartDate:      scheduleTask.StartDate,
		EndDate:        scheduleTask.EndDate,
		Duration:       scheduleTask.DurationMinutes,
		CurrentCount:   task.CurrentCount,
		TargetCount:    task.TargetCount,
		Notes:          task.Notes,
		Frequency:      scheduleTask.Frequency,
		Category:       scheduleTask.Category,
		CreatedAt:      task.CreatedAt,
		UpdatedAt:      task.UpdatedAt,
	}
}

func CreateUsersTodayTasks(ctx context.Context, userID string) ([]*DetailedTask, error) {
	scheduleTasks, err := getUserActiveScheduleTasks(ctx, userID)
	if err != nil {
		return nil, err
	}

	today := time.Now()
	var todayTasks []*DetailedTask
	generatedCount := 0

	for _, scheduleTask := range scheduleTasks {
		if shouldCreateTaskForToday(scheduleTask, today) {
			existingTask, err := GetTaskByScheduleAndDate(ctx, scheduleTask.ID, today)
			if err != nil && !errors.Is(err, pgx.ErrNoRows) {
				return nil, err
			}

			var task *Task
			if existingTask == nil {
				task, err = createTaskForDate(ctx, scheduleTask, today)
				if err != nil {
					return nil, err
				}
				generatedCount++
			} else {
				task = existingTask
			}

			nextStatus := determineTaskStatus(scheduleTask, today)
			if task.Status != TaskStatusCompleted && task.Status != TaskStatusSkipped {
				task.Status = nextStatus
			}
			if existingTask != nil {
				err = UpdateTask(ctx, task)
				if err != nil {
					return nil, err
				}
			}

			todayTasks = append(todayTasks, NewDetailedTask(task, scheduleTask))
		}
	}

	log.Printf("lazy task generation user_id=%s generated=%d", userID, generatedCount)

	return todayTasks, nil
}

func shouldCreateTaskForToday(scheduleTask *ScheduleTask, today time.Time) bool {
	if !scheduleTask.RepeatEndDate.IsZero() && util.AfterDate(today, scheduleTask.RepeatEndDate) {
		return false
	}

	if !scheduleTask.EndDate.IsZero() && util.AfterDate(today, scheduleTask.EndDate) {
		return false
	}

	if !scheduleTask.StartDate.IsZero() && util.BeforeDate(today, scheduleTask.StartDate) {
		return false
	}

	if scheduleTask.Frequency != "" {
		return shouldRepeatToday(scheduleTask, today)
	}

	if !scheduleTask.Repeating {
		if !scheduleTask.StartDate.IsZero() {
			return util.EqualDate(scheduleTask.StartDate, today)
		}
		return true
	}

	return shouldRepeatToday(scheduleTask, today)
}

func shouldRepeatToday(scheduleTask *ScheduleTask, today time.Time) bool {
	switch scheduleTask.RepeatFrequency {
	case ScheduleTaskRepeatFrequencyDaily:
		return true
	case ScheduleTaskRepeatFrequencyWeekly:
		return slices.Contains(scheduleTask.RepeatWeekdays, int(today.Weekday()))
	case ScheduleTaskRepeatFrequencyBiweekly:
		if len(scheduleTask.RepeatWeekdays) > 0 {
			daysDiff := int(today.Sub(scheduleTask.StartDate).Hours() / 24)
			return daysDiff%15 == 0 && slices.Contains(scheduleTask.RepeatWeekdays, int(today.Weekday()))
		}
		return false
	case ScheduleTaskRepeatFrequencyMonthly:
		return scheduleTask.StartDate.Day() == today.Day()
	case ScheduleTaskRepeatFrequencyBimonthly:
		monthsDiff := (today.Year()-scheduleTask.StartDate.Year())*12 + int(today.Month()) - int(scheduleTask.StartDate.Month())
		return monthsDiff%2 == 0 && scheduleTask.StartDate.Day() == today.Day()
	case ScheduleTaskRepeatFrequencyYearly:
		return scheduleTask.StartDate.Month() == today.Month() && scheduleTask.StartDate.Day() == today.Day()
	}

	if len(scheduleTask.RepeatWeekdays) > 0 {
		return slices.Contains(scheduleTask.RepeatWeekdays, int(today.Weekday()))
	}

	if scheduleTask.RepeatInterval > 0 {
		daysDiff := int(today.Sub(scheduleTask.StartDate).Hours() / 24)
		return daysDiff%scheduleTask.RepeatInterval == 0
	}

	switch scheduleTask.Frequency {
	case ScheduleTaskFrequencyDaily:
		return true
	case ScheduleTaskFrequencyWeekly:
		return slices.Contains(scheduleTask.RepeatWeekdays, int(today.Weekday()))
	case ScheduleTaskFrequencyMonthly:
		return scheduleTask.StartDate.Day() == today.Day()
	default:
		return false
	}
}

func determineTaskStatus(scheduleTask *ScheduleTask, now time.Time) TaskStatus {
	if scheduleTask.StartTime.IsZero() && scheduleTask.EndTime.IsZero() {
		return TaskStatusPending
	}

	currentTime := time.Date(0, 1, 1, now.Hour(), now.Minute(), now.Second(), now.Nanosecond(), now.Location())

	if !scheduleTask.StartTime.IsZero() && util.BeforeTime(currentTime, scheduleTask.StartTime) {
		return TaskStatusPending
	}

	if !scheduleTask.EndTime.IsZero() && util.AfterTime(currentTime, scheduleTask.EndTime) {
		return TaskStatusFailed
	}

	return TaskStatusPending
}

func createTaskForDate(ctx context.Context, scheduleTask *ScheduleTask, date time.Time) (*Task, error) {
	conn, err := GetConn(ctx)
	if err != nil {
		return nil, err
	}
	defer conn.Release()

	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	task := &Task{
		ID:             uuid.Must(uuid.NewV7()).String(),
		UserID:         scheduleTask.UserID,
		ScheduleTaskID: scheduleTask.ID,
		Date:           date,
		Status:         TaskStatusPending,
		TargetCount:    scheduleTask.TargetCount,
	}

	_, err = conn.Exec(
		ctx,
		`INSERT INTO tasks (
			id, user_id, schedule_task_id, date, status, status_level, target_count, current_count
		) VALUES (
			@id, @userID, @scheduleTaskID, @date, @legacyStatus, @status, @targetCount, @currentCount
		)`,
		taskArgs(task),
	)
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

	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	row := conn.QueryRow(ctx, taskSelectSQL()+` WHERE schedule_task_id = $1 AND DATE(date) = DATE($2::timestamptz)`, scheduleTaskID, date)
	return scanTask(row)
}

func UpdateTask(ctx context.Context, task *Task) error {
	conn, err := GetConn(ctx)
	if err != nil {
		return err
	}
	defer conn.Release()

	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	_, err = conn.Exec(
		ctx,
		`UPDATE tasks SET
			date = @date,
			status = @legacyStatus,
			status_level = @status,
			completed_at = @completedAt,
			actual_start = @actualStart,
			actual_end = @actualEnd,
			current_count = @currentCount,
			target_count = @targetCount,
			notes = @notes,
			title = @title,
			description = @description
		WHERE id = @id`,
		taskArgs(task),
	)
	return err
}

func UpdateTaskAndSchedule(ctx context.Context, task *Task, schedule *ScheduleTask) error {
	conn, err := GetConn(ctx)
	if err != nil {
		return err
	}
	defer conn.Release()

	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	tx, err := conn.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(
		ctx,
		`UPDATE tasks SET
			date = @date,
			status = @legacyStatus,
			status_level = @status,
			completed_at = @completedAt,
			actual_start = @actualStart,
			actual_end = @actualEnd,
			current_count = @currentCount,
			target_count = @targetCount,
			notes = @notes,
			title = @title,
			description = @description
		WHERE id = @id`,
		taskArgs(task),
	)
	if err != nil {
		return err
	}

	schedule.NormalizeDefaults()
	_, err = tx.Exec(
		ctx,
		`UPDATE schedule_tasks SET
			title = @title,
			description = @description,
			start_time = date_trunc('minute', @startTime::timestamptz),
			end_time = date_trunc('minute', @endTime::timestamptz),
			schedule_start_time = @startClock::time,
			schedule_end_time = @endClock::time,
			start_date = @startDate,
			end_date = @endDate,
			duration = @duration,
			duration_minutes = @durationMinutes,
			target_count = @targetCount,
			required = @isRequired,
			is_required = @isRequired,
			repeating = @repeating,
			repeat_frequency = @repeatFrequency,
			repeat_interval = @repeatInterval,
			repeat_weekdays = @repeatWeekdays,
			repeat_end_date = @repeatEndDate,
			frequency = @frequency,
			frequency_config = @frequencyConfig,
			category = @category,
			status = @legacyStatus,
			status_level = @status,
			priority = @legacyPriority,
			priority_level = @priority
		WHERE id = @id AND user_id = @userID`,
		scheduleArgs(schedule),
	)
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func DeleteTask(ctx context.Context, task *Task) error {
	conn, err := GetConn(ctx)
	if err != nil {
		return err
	}
	defer conn.Release()

	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	_, err = conn.Exec(ctx, `DELETE FROM tasks WHERE id = $1`, task.ID)
	return err
}

func CreateTaskForSchedule(ctx context.Context, sct *ScheduleTask) (*Task, error) {
	if sct == nil {
		return nil, ErrNilScheduleTask
	}

	taskDate, err := getNextTaskDate(sct)
	if err != nil {
		return nil, err
	}
	if taskDate.IsZero() {
		taskDate = time.Now()
	}

	return createTaskForDate(ctx, sct, taskDate)
}

func GetTaskByID(ctx context.Context, id string) (*Task, error) {
	conn, err := GetConn(ctx)
	if err != nil {
		return nil, err
	}
	defer conn.Release()

	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	row := conn.QueryRow(ctx, taskSelectSQL()+` WHERE id = $1`, id)
	return scanTask(row)
}

func GetTaskDetailsByID(ctx context.Context, id string) (*DetailedTask, error) {
	conn, err := GetConn(ctx)
	if err != nil {
		return nil, err
	}
	defer conn.Release()

	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	row := conn.QueryRow(ctx, detailedTaskSelectSQL()+` WHERE id = $1`, id)
	return scanDetailedTask(row)
}

func GetTasksByUserID(ctx context.Context, userID string) ([]*DetailedTask, error) {
	conn, err := GetConn(ctx)
	if err != nil {
		return nil, err
	}
	defer conn.Release()

	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	rows, err := conn.Query(
		ctx,
		detailedTaskSelectSQL()+` WHERE user_id = $1 AND id IS NOT NULL ORDER BY date DESC, created_at DESC`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanDetailedTasks(rows)
}

func GetUserTodayDetailedTasks(ctx context.Context, userID string) ([]*DetailedTask, error) {
	conn, err := GetConn(ctx)
	if err != nil {
		return nil, err
	}
	defer conn.Release()

	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	rows, err := conn.Query(
		ctx,
		detailedTaskSelectSQL()+`
		WHERE user_id = $1 AND DATE(date) = CURRENT_DATE
		ORDER BY
			(CASE WHEN completed_at IS NULL THEN 1 ELSE 2 END) ASC,
			(CASE WHEN required THEN 1 ELSE 2 END) ASC,
			(CASE priority
				WHEN 'urgent' THEN 1
				WHEN 'high' THEN 2
				WHEN 'medium' THEN 3
				WHEN 'low' THEN 4
				ELSE 5
			END) ASC,
			start_time ASC NULLS LAST`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanDetailedTasks(rows)
}

func CreateTaskCompletion(ctx context.Context, completion *TaskCompletion) error {
	conn, err := GetConn(ctx)
	if err != nil {
		return err
	}
	defer conn.Release()

	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	if completion.ID == "" {
		completion.ID = uuid.Must(uuid.NewV7()).String()
	}
	if completion.CompletedAt.IsZero() {
		completion.CompletedAt = time.Now()
	}

	_, err = conn.Exec(
		ctx,
		`INSERT INTO task_completions (
			id, task_id, user_id, completed_at, actual_start, actual_end, count, notes
		) VALUES (
			@id, @taskID, @userID, @completedAt, @actualStart, @actualEnd, @count, @notes
		)`,
		pgx.NamedArgs{
			"id":          completion.ID,
			"taskID":      completion.TaskID,
			"userID":      completion.UserID,
			"completedAt": completion.CompletedAt,
			"actualStart": nullableTime(completion.ActualStart),
			"actualEnd":   nullableTime(completion.ActualEnd),
			"count":       completion.Count,
			"notes":       nullableString(completion.Notes),
		},
	)
	return err
}

func getNextTaskDate(sct *ScheduleTask) (time.Time, error) {
	currentTime := time.Now()

	if !sct.StartTime.IsZero() {
		startHr, startMin, _ := sct.StartTime.Clock()
		currHr, currMin, _ := currentTime.Clock()

		if currHr < startHr || (currHr == startHr && currMin < startMin) {
			return time.Date(
				currentTime.Year(),
				currentTime.Month(),
				currentTime.Day(),
				startHr,
				startMin,
				0,
				0,
				time.Local,
			), nil
		}
	}

	var nextDate time.Time
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
			addAmount := int(sct.RepeatWeekdays[0]) - int(currentTime.Weekday())
			if addAmount < 0 {
				addAmount += 7
			}
			nextDate = currentTime.AddDate(0, 0, addAmount)
		case ScheduleTaskRepeatFrequencyBiweekly:
			if len(sct.RepeatWeekdays) == 0 {
				return time.Time{}, ErrNoWeekdayForWeeklyTask
			}
			addAmount := int(sct.RepeatWeekdays[0]) - int(currentTime.Weekday())
			if addAmount < 0 {
				addAmount += 14
			}
			nextDate = currentTime.AddDate(0, 0, addAmount)
		}
	} else if len(sct.RepeatWeekdays) > 0 {
		wkd := int(currentTime.Weekday())
		nextWeekday := sct.RepeatWeekdays[0]
		for _, rptWkd := range sct.RepeatWeekdays {
			if rptWkd >= wkd {
				nextWeekday = rptWkd
				break
			}
		}
		addAmount := nextWeekday - wkd
		if addAmount < 0 {
			addAmount += 7
		}
		nextDate = currentTime.AddDate(0, 0, addAmount)
	} else if sct.RepeatInterval > 0 {
		nextDate = currentTime.AddDate(0, 0, sct.RepeatInterval)
	}

	return nextDate, nil
}

type taskScanner interface {
	Scan(dest ...interface{}) error
}

func scanTask(scanner taskScanner) (*Task, error) {
	var task Task
	var completedAt, actualStart, actualEnd sql.NullTime
	var description, notes, title sql.NullString
	var targetCount sql.NullInt64

	err := scanner.Scan(
		&task.ID,
		&task.UserID,
		&task.ScheduleTaskID,
		&title,
		&description,
		&task.Date,
		&task.Status,
		&completedAt,
		&actualStart,
		&actualEnd,
		&task.CurrentCount,
		&targetCount,
		&notes,
		&task.CreatedAt,
		&task.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	if completedAt.Valid {
		task.CompletedAt = completedAt.Time
	}
	if actualStart.Valid {
		task.ActualStart = actualStart.Time
	}
	if actualEnd.Valid {
		task.ActualEnd = actualEnd.Time
	}
	if targetCount.Valid {
		nextTarget := int(targetCount.Int64)
		task.TargetCount = &nextTarget
	}
	if title.Valid {
		task.Title = title.String
	}
	if description.Valid {
		task.Description = description.String
	}
	if notes.Valid {
		task.Notes = notes.String
	}

	return &task, nil
}

func scanDetailedTask(scanner taskScanner) (*DetailedTask, error) {
	var task DetailedTask
	var completedAt, actualStart, actualEnd, startTime, endTime, startDate, endDate sql.NullTime
	var description, notes, category sql.NullString
	var duration, currentCount, targetCount sql.NullInt64

	err := scanner.Scan(
		&task.ID,
		&task.UserID,
		&task.ScheduleTaskID,
		&task.Title,
		&description,
		&task.Date,
		&task.Status,
		&task.Priority,
		&task.Required,
		&task.IsRequired,
		&completedAt,
		&actualStart,
		&actualEnd,
		&startTime,
		&endTime,
		&startDate,
		&endDate,
		&duration,
		&currentCount,
		&targetCount,
		&notes,
		&task.Frequency,
		&category,
		&task.CreatedAt,
		&task.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	if description.Valid {
		task.Description = description.String
	}
	if completedAt.Valid {
		task.CompletedAt = completedAt.Time
	}
	if actualStart.Valid {
		task.ActualStart = actualStart.Time
	}
	if actualEnd.Valid {
		task.ActualEnd = actualEnd.Time
	}
	if startTime.Valid {
		task.StartTime = startTime.Time
	}
	if endTime.Valid {
		task.EndTime = endTime.Time
	}
	if startDate.Valid {
		task.StartDate = startDate.Time
	}
	if endDate.Valid {
		task.EndDate = endDate.Time
	}
	if duration.Valid {
		task.Duration = int(duration.Int64)
	}
	if currentCount.Valid {
		task.CurrentCount = int(currentCount.Int64)
	}
	if targetCount.Valid {
		nextTarget := int(targetCount.Int64)
		task.TargetCount = &nextTarget
	}
	if notes.Valid {
		task.Notes = notes.String
	}
	if category.Valid {
		task.Category = category.String
	}

	return &task, nil
}

func scanDetailedTasks(rows pgx.Rows) ([]*DetailedTask, error) {
	var tasks []*DetailedTask
	for rows.Next() {
		task, err := scanDetailedTask(rows)
		if err != nil {
			return nil, err
		}
		tasks = append(tasks, task)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return tasks, nil
}

func taskSelectSQL() string {
	return `SELECT
		id,
		user_id,
		schedule_task_id,
		title,
		description,
		date,
		status_level,
		completed_at,
		actual_start,
		actual_end,
		current_count,
		target_count,
		notes,
		created_at,
		updated_at
	FROM tasks`
}

func detailedTaskSelectSQL() string {
	return `SELECT
		id,
		user_id,
		schedule_task_id,
		title,
		description,
		date,
		status,
		priority,
		required,
		is_required,
		completed_at,
		actual_start,
		actual_end,
		CASE WHEN start_time IS NULL THEN NULL ELSE (CURRENT_DATE + start_time)::timestamptz END AS start_time,
		CASE WHEN end_time IS NULL THEN NULL ELSE (CURRENT_DATE + end_time)::timestamptz END AS end_time,
		start_date,
		end_date,
		duration,
		current_count,
		target_count,
		notes,
		frequency,
		category,
		created_at,
		updated_at
	FROM detailed_tasks`
}

func taskArgs(task *Task) pgx.NamedArgs {
	return pgx.NamedArgs{
		"id":             task.ID,
		"userID":         task.UserID,
		"scheduleTaskID": task.ScheduleTaskID,
		"date":           task.Date,
		"status":         task.Status,
		"legacyStatus":   string(task.Status),
		"completedAt":    nullableTime(task.CompletedAt),
		"actualStart":    nullableTime(task.ActualStart),
		"actualEnd":      nullableTime(task.ActualEnd),
		"currentCount":   task.CurrentCount,
		"targetCount":    nullableIntPtr(task.TargetCount),
		"notes":          nullableString(task.Notes),
		"title":          nullableString(task.Title),
		"description":    nullableString(task.Description),
	}
}

func NewTaskFeedItem(task *DetailedTask) TaskFeedItem {
	var startTime *string
	var endTime *string
	var duration *int
	var completedAt *time.Time

	if !task.StartTime.IsZero() {
		formatted := task.StartTime.Format("15:04")
		startTime = &formatted
	}
	if !task.EndTime.IsZero() {
		formatted := task.EndTime.Format("15:04")
		endTime = &formatted
	}
	if task.Duration > 0 {
		duration = &task.Duration
	}
	if !task.CompletedAt.IsZero() {
		nextCompletedAt := task.CompletedAt
		completedAt = &nextCompletedAt
	}

	return TaskFeedItem{
		ID:                task.ID,
		Title:             task.Title,
		Description:       task.Description,
		ScheduleID:        task.ScheduleTaskID,
		PriorityLevel:     string(task.Priority),
		StatusLevel:       string(task.Status),
		IsRequired:        task.IsRequired,
		ScheduleStartTime: startTime,
		ScheduleEndTime:   endTime,
		DurationMinutes:   duration,
		TargetCount:       task.TargetCount,
		CurrentCount:      task.CurrentCount,
		CreatedAt:         task.CreatedAt,
		CompletedAt:       completedAt,
	}
}

const taskUpdateSQL = `UPDATE tasks SET
		date = @date,
		status = @legacyStatus,
		status_level = @status,
		completed_at = @completedAt,
		actual_start = @actualStart,
		actual_end = @actualEnd,
		current_count = @currentCount,
		target_count = @targetCount,
		notes = @notes,
		title = @title,
		description = @description
	WHERE id = @id`

const scheduleUpdateSQL = `UPDATE schedule_tasks SET
		title = @title,
		description = @description,
		start_time = date_trunc('minute', @startTime::timestamptz),
		end_time = date_trunc('minute', @endTime::timestamptz),
		schedule_start_time = @startClock::time,
		schedule_end_time = @endClock::time,
		start_date = @startDate,
		end_date = @endDate,
		duration = @duration,
		duration_minutes = @durationMinutes,
		target_count = @targetCount,
		required = @isRequired,
		is_required = @isRequired,
		repeating = @repeating,
		repeat_frequency = @repeatFrequency,
		repeat_interval = @repeatInterval,
		repeat_weekdays = @repeatWeekdays,
		repeat_end_date = @repeatEndDate,
		frequency = @frequency,
		frequency_config = @frequencyConfig,
		category = @category,
		status = @legacyStatus,
		status_level = @status,
		priority = @legacyPriority,
		priority_level = @priority
	WHERE id = @id AND user_id = @userID`

const taskCompletionInsertSQL = `INSERT INTO task_completions (
		id, task_id, user_id, completed_at, actual_start, actual_end, count, notes
	) VALUES (
		@id, @taskID, @userID, @completedAt, @actualStart, @actualEnd, @count, @notes
	)`

func taskCompletionArgs(c *TaskCompletion) pgx.NamedArgs {
	return pgx.NamedArgs{
		"id":          c.ID,
		"taskID":      c.TaskID,
		"userID":      c.UserID,
		"completedAt": c.CompletedAt,
		"actualStart": nullableTime(c.ActualStart),
		"actualEnd":   nullableTime(c.ActualEnd),
		"count":       c.Count,
		"notes":       nullableString(c.Notes),
	}
}

func ensureCompletionDefaults(c *TaskCompletion) {
	if c.ID == "" {
		c.ID = uuid.Must(uuid.NewV7()).String()
	}
	if c.CompletedAt.IsZero() {
		c.CompletedAt = time.Now()
	}
}

// CompleteTask atomically marks a task as completed and inserts the matching
// append-only row in task_completions inside a single transaction. Either both
// writes succeed or both are rolled back.
func CompleteTask(ctx context.Context, task *Task, completion *TaskCompletion) error {
	conn, err := GetConn(ctx)
	if err != nil {
		return err
	}
	defer conn.Release()

	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	tx, err := conn.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var currentStatus string
	if err := tx.QueryRow(ctx, `SELECT status_level FROM tasks WHERE id = $1 FOR UPDATE`, task.ID).Scan(&currentStatus); err != nil {
		return err
	}
	if TaskStatus(currentStatus) == TaskStatusCompleted {
		return tx.Commit(ctx)
	}

	if _, err := tx.Exec(ctx, taskUpdateSQL, taskArgs(task)); err != nil {
		return err
	}

	ensureCompletionDefaults(completion)
	if _, err := tx.Exec(ctx, taskCompletionInsertSQL, taskCompletionArgs(completion)); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

// CompleteTaskAndSchedule is like CompleteTask but also propagates updates to
// the parent schedule_task in the same transaction. Used when the user opts to
// apply changes globally (apply_to_schedule=true) at the same time the task is
// being completed.
func CompleteTaskAndSchedule(ctx context.Context, task *Task, schedule *ScheduleTask, completion *TaskCompletion) error {
	conn, err := GetConn(ctx)
	if err != nil {
		return err
	}
	defer conn.Release()

	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	tx, err := conn.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var currentStatus string
	if err := tx.QueryRow(ctx, `SELECT status_level FROM tasks WHERE id = $1 FOR UPDATE`, task.ID).Scan(&currentStatus); err != nil {
		return err
	}
	if TaskStatus(currentStatus) == TaskStatusCompleted {
		return tx.Commit(ctx)
	}

	if _, err := tx.Exec(ctx, taskUpdateSQL, taskArgs(task)); err != nil {
		return err
	}

	schedule.NormalizeDefaults()
	if _, err := tx.Exec(ctx, scheduleUpdateSQL, scheduleArgs(schedule)); err != nil {
		return err
	}

	ensureCompletionDefaults(completion)
	if _, err := tx.Exec(ctx, taskCompletionInsertSQL, taskCompletionArgs(completion)); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

// DayProgress aggregates the count of tasks per status for a given user/day,
// plus a derived percentage of completion. Used by the progress endpoint.
type DayProgress struct {
	Date       string  `json:"date"`
	Total      int     `json:"total"`
	Completed  int     `json:"completed"`
	Pending    int     `json:"pending"`
	Skipped    int     `json:"skipped"`
	Failed     int     `json:"failed"`
	InProgress int     `json:"in_progress"`
	Percentage float64 `json:"percentage"`
}

// GetUserDayProgress counts the tasks of a given user for the calendar day
// represented by `day` and returns a DayProgress aggregate. Percentage is 0
// when there are no tasks (no division by zero).
func GetUserDayProgress(ctx context.Context, userID string, day time.Time) (*DayProgress, error) {
	conn, err := GetConn(ctx)
	if err != nil {
		return nil, err
	}
	defer conn.Release()

	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	progress := &DayProgress{Date: day.Format("2006-01-02")}
	row := conn.QueryRow(
		ctx,
		`SELECT
			COUNT(*) AS total,
			COUNT(*) FILTER (WHERE status_level = 'completed') AS completed,
			COUNT(*) FILTER (WHERE status_level = 'pending') AS pending,
			COUNT(*) FILTER (WHERE status_level = 'skipped') AS skipped,
			COUNT(*) FILTER (WHERE status_level = 'failed') AS failed,
			COUNT(*) FILTER (WHERE status_level = 'in_progress') AS in_progress
		FROM tasks
		WHERE user_id = $1 AND DATE(date) = DATE($2::timestamptz)`,
		userID,
		day,
	)
	if err := row.Scan(
		&progress.Total,
		&progress.Completed,
		&progress.Pending,
		&progress.Skipped,
		&progress.Failed,
		&progress.InProgress,
	); err != nil {
		return nil, err
	}

	if progress.Total > 0 {
		progress.Percentage = math.Round(float64(progress.Completed)*1000/float64(progress.Total)) / 10
	}

	return progress, nil
}
