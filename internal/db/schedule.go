package db

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
)

type ScheduleTaskStatus string

const (
	ScheduleTaskStatusActive    ScheduleTaskStatus = "active"
	ScheduleTaskStatusPaused    ScheduleTaskStatus = "paused"
	ScheduleTaskStatusCancelled ScheduleTaskStatus = "cancelled"
)

type ScheduleTaskPriority string

const (
	ScheduleTaskPriorityUrgent ScheduleTaskPriority = "urgent"
	ScheduleTaskPriorityHigh   ScheduleTaskPriority = "high"   // legacy, mapped to urgent
	ScheduleTaskPriorityMedium ScheduleTaskPriority = "medium"
	ScheduleTaskPriorityLow    ScheduleTaskPriority = "low"    // legacy, mapped to medium
)

var ErrInvalidPriority = errors.New("prioridad inválida: sólo se aceptan 'urgent' o 'medium'")

// ValidatePriority rejects legacy high/low values in new requests.
func ValidatePriority(p ScheduleTaskPriority) error {
	switch p {
	case ScheduleTaskPriorityUrgent, ScheduleTaskPriorityMedium, "":
		return nil
	default:
		return ErrInvalidPriority
	}
}

type ScheduleTaskFrequency string

const (
	ScheduleTaskFrequencyDaily   ScheduleTaskFrequency = "daily"
	ScheduleTaskFrequencyWeekly  ScheduleTaskFrequency = "weekly"
	ScheduleTaskFrequencyMonthly ScheduleTaskFrequency = "monthly"
	ScheduleTaskFrequencyCustom  ScheduleTaskFrequency = "custom"
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

type ScheduleTask struct {
	ID          string `db:"id" json:"id,omitempty"`
	UserID      string `db:"user_id" json:"userId,omitempty"`
	CreatedBy   string `db:"created_by" json:"createdBy,omitempty"`
	Title       string `db:"title" json:"title,omitempty" binding:"required"`
	Description string `db:"description" json:"description,omitempty"`

	StartTime       time.Time     `db:"schedule_start_time" json:"startTime,omitzero" time_format:"15:04"`
	EndTime         time.Time     `db:"schedule_end_time" json:"endTime,omitzero" time_format:"15:04"`
	StartDate       time.Time     `db:"start_date" json:"startDate,omitzero" time_format:"2006-01-02"`
	EndDate         time.Time     `db:"end_date" json:"endDate,omitzero" time_format:"2006-01-02"`
	Duration        time.Duration `db:"duration" json:"duration,omitempty"`
	DurationMinutes int           `db:"duration_minutes" json:"durationMinutes,omitempty"`
	TargetCount     *int          `db:"target_count" json:"targetCount,omitempty"`

	Required   bool `db:"required" json:"required,omitempty"`
	IsRequired bool `db:"is_required" json:"isRequired,omitempty"`

	Repeating       bool                        `db:"repeating" json:"repeating,omitempty"`
	RepeatFrequency ScheduleTaskRepeatFrequency `db:"repeat_frequency" json:"repeatFrequency,omitempty"`
	RepeatWeekdays  []int                       `db:"repeat_weekdays" json:"repeatWeekdays,omitempty"`
	RepeatInterval  int                         `db:"repeat_interval" json:"repeatInterval,omitempty"`
	RepeatEndDate   time.Time                   `db:"repeat_end_date" json:"repeatEndDate,omitzero"`

	Frequency       ScheduleTaskFrequency `db:"frequency" json:"frequency,omitempty"`
	FrequencyConfig json.RawMessage       `db:"frequency_config" json:"frequencyConfig,omitempty"`
	Category        string                `db:"category" json:"category,omitempty"`
	Status          ScheduleTaskStatus    `db:"status_level" json:"status,omitempty"`
	Priority        ScheduleTaskPriority  `db:"priority_level" json:"priority,omitempty"`

	CreatedAt time.Time `db:"created_at" json:"createdAt"`
	UpdatedAt time.Time `db:"updated_at" json:"updatedAt"`
}

func (st *ScheduleTask) NormalizeDefaults() {
	if st.CreatedBy == "" {
		st.CreatedBy = st.UserID
	}
	if st.Status == "" {
		st.Status = ScheduleTaskStatusActive
	}
	switch st.Priority {
	case "":
		st.Priority = ScheduleTaskPriorityMedium
	case ScheduleTaskPriorityHigh:
		st.Priority = ScheduleTaskPriorityUrgent
	case ScheduleTaskPriorityLow:
		st.Priority = ScheduleTaskPriorityMedium
	}
	if st.Frequency == "" {
		st.Frequency = deriveFrequency(st)
	}
	if len(st.FrequencyConfig) == 0 {
		st.FrequencyConfig = json.RawMessage(`{}`)
	}
	if !st.IsRequired {
		st.IsRequired = st.Required
	}
	st.Required = st.IsRequired

	if st.DurationMinutes == 0 && st.Duration > 0 {
		st.DurationMinutes = int(st.Duration / time.Minute)
		if st.DurationMinutes == 0 {
			st.DurationMinutes = int(st.Duration)
		}
	}
	if st.Duration == 0 && st.DurationMinutes > 0 {
		st.Duration = time.Duration(st.DurationMinutes) * time.Minute
	}
	if st.Repeating && st.StartDate.IsZero() {
		st.StartDate = time.Now()
	}

	if st.DurationMinutes == 0 && !st.StartTime.IsZero() && !st.EndTime.IsZero() {
		st.DurationMinutes = int(st.EndTime.Sub(st.StartTime).Minutes())
		if st.DurationMinutes < 0 {
			st.DurationMinutes = 0
		}
		st.Duration = time.Duration(st.DurationMinutes) * time.Minute
	}
}

func CreateScheduleTask(ctx context.Context, task *ScheduleTask) error {
	conn, err := GetConn(ctx)
	if err != nil {
		return err
	}
	defer conn.Release()

	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	task.NormalizeDefaults()
	args := scheduleArgs(task)
	_, err = conn.Exec(
		ctx,
		`INSERT INTO schedule_tasks (
			id, title, user_id, created_by, description,
			start_time, end_time, schedule_start_time, schedule_end_time,
			start_date, end_date, duration, duration_minutes, target_count,
			required, is_required, repeating, repeat_frequency, repeat_interval,
			repeat_weekdays, repeat_end_date, frequency, frequency_config, category,
			status, status_level, priority, priority_level
		) VALUES (
			@id, @title, @userID, @createdBy, @description,
			date_trunc('minute', @startTime::timestamptz),
			date_trunc('minute', @endTime::timestamptz),
			@startClock::time,
			@endClock::time,
			@startDate, @endDate, @duration, @durationMinutes, @targetCount,
			@isRequired, @isRequired, @repeating, @repeatFrequency, @repeatInterval,
			@repeatWeekdays, @repeatEndDate, @frequency, @frequencyConfig, @category,
			@legacyStatus, @status, @legacyPriority, @priority
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

	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	task.NormalizeDefaults()
	args := scheduleArgs(task)
	_, err = conn.Exec(
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

	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	row := conn.QueryRow(ctx, scheduleSelectSQL()+` WHERE id = $1`, id)
	return scanScheduleTask(row)
}

func GetScheduleTasksByUserID(ctx context.Context, userID string) ([]*ScheduleTask, error) {
	conn, err := GetConn(ctx)
	if err != nil {
		return nil, err
	}
	defer conn.Release()

	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	rows, err := conn.Query(ctx, scheduleSelectSQL()+` WHERE user_id = $1 ORDER BY created_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tasks []*ScheduleTask
	for rows.Next() {
		task, err := scanScheduleTask(rows)
		if err != nil {
			return nil, err
		}
		tasks = append(tasks, task)
	}

	return tasks, nil
}

func DeleteScheduleTask(ctx context.Context, task *ScheduleTask) error {
	return SetScheduleTaskStatus(ctx, task.ID, task.UserID, ScheduleTaskStatusCancelled)
}

func SetScheduleTaskStatus(ctx context.Context, id string, userID string, status ScheduleTaskStatus) error {
	conn, err := GetConn(ctx)
	if err != nil {
		return err
	}
	defer conn.Release()

	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	_, err = conn.Exec(
		ctx,
		`UPDATE schedule_tasks
		 SET status = @legacyStatus, status_level = @status
		 WHERE id = @id AND user_id = @userID`,
		pgx.NamedArgs{
			"id":           id,
			"userID":       userID,
			"legacyStatus": string(status),
			"status":       status,
		},
	)
	return err
}

func getUserActiveScheduleTasks(ctx context.Context, userID string) ([]*ScheduleTask, error) {
	conn, err := GetConn(ctx)
	if err != nil {
		return nil, err
	}
	defer conn.Release()

	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	rows, err := conn.Query(ctx, scheduleSelectSQL()+` WHERE user_id = $1 AND status_level = 'active'`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tasks []*ScheduleTask
	for rows.Next() {
		task, err := scanScheduleTask(rows)
		if err != nil {
			return nil, err
		}
		tasks = append(tasks, task)
	}

	return tasks, nil
}

type scheduleScanner interface {
	Scan(dest ...interface{}) error
}

func scanScheduleTask(scanner scheduleScanner) (*ScheduleTask, error) {
	var task ScheduleTask
	var (
		category        sql.NullString
		createdBy       sql.NullString
		description     sql.NullString
		duration        sql.NullInt64
		durationMinutes sql.NullInt64
		endDate         sql.NullTime
		endTime         sql.NullTime
		frequencyConfig []byte
		repeatEndDate   sql.NullTime
		repeatFrequency sql.NullString
		repeatInterval  sql.NullInt64
		startDate       sql.NullTime
		startTime       sql.NullTime
		targetCount     sql.NullInt64
	)

	err := scanner.Scan(
		&task.ID,
		&task.UserID,
		&createdBy,
		&task.Title,
		&description,
		&startTime,
		&endTime,
		&startDate,
		&endDate,
		&duration,
		&durationMinutes,
		&targetCount,
		&task.Required,
		&task.IsRequired,
		&task.Repeating,
		&repeatFrequency,
		&repeatInterval,
		&task.RepeatWeekdays,
		&repeatEndDate,
		&task.Frequency,
		&frequencyConfig,
		&category,
		&task.Status,
		&task.Priority,
		&task.CreatedAt,
		&task.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	if category.Valid {
		task.Category = category.String
	}
	if createdBy.Valid {
		task.CreatedBy = createdBy.String
	}
	if description.Valid {
		task.Description = description.String
	}
	if duration.Valid {
		task.Duration = time.Duration(duration.Int64) * time.Minute
	}
	if durationMinutes.Valid {
		task.DurationMinutes = int(durationMinutes.Int64)
	}
	if endDate.Valid {
		task.EndDate = endDate.Time
	}
	if endTime.Valid {
		task.EndTime = endTime.Time
	}
	if len(frequencyConfig) > 0 {
		task.FrequencyConfig = json.RawMessage(frequencyConfig)
	}
	if repeatEndDate.Valid {
		task.RepeatEndDate = repeatEndDate.Time
	}
	if repeatFrequency.Valid {
		task.RepeatFrequency = ScheduleTaskRepeatFrequency(repeatFrequency.String)
	}
	if repeatInterval.Valid {
		task.RepeatInterval = int(repeatInterval.Int64)
	}
	if startDate.Valid {
		task.StartDate = startDate.Time
	}
	if startTime.Valid {
		task.StartTime = startTime.Time
	}
	if targetCount.Valid {
		nextTarget := int(targetCount.Int64)
		task.TargetCount = &nextTarget
	}

	task.NormalizeDefaults()
	return &task, nil
}

func scheduleSelectSQL() string {
	return `SELECT
		id,
		user_id,
		created_by::text,
		title,
		description,
		CASE WHEN schedule_start_time IS NULL THEN NULL ELSE (CURRENT_DATE + schedule_start_time)::timestamptz END,
		CASE WHEN schedule_end_time IS NULL THEN NULL ELSE (CURRENT_DATE + schedule_end_time)::timestamptz END,
		start_date,
		end_date,
		duration,
		duration_minutes,
		target_count,
		required,
		is_required,
		repeating,
		repeat_frequency,
		repeat_interval,
		COALESCE(repeat_weekdays, ARRAY[]::INT[]),
		repeat_end_date,
		frequency,
		frequency_config,
		category,
		status_level,
		priority_level,
		created_at,
		updated_at
	FROM schedule_tasks`
}

func scheduleArgs(task *ScheduleTask) pgx.NamedArgs {
	return pgx.NamedArgs{
		"id":              task.ID,
		"userID":          task.UserID,
		"createdBy":       task.CreatedBy,
		"title":           task.Title,
		"description":     nullableString(task.Description),
		"startTime":       nullableTime(task.StartTime),
		"endTime":         nullableTime(task.EndTime),
		"startClock":      nullableClock(task.StartTime),
		"endClock":        nullableClock(task.EndTime),
		"startDate":       nullableTime(task.StartDate),
		"endDate":         nullableTime(task.EndDate),
		"duration":        task.DurationMinutes,
		"durationMinutes": nullablePositiveInt(task.DurationMinutes),
		"targetCount":     nullableIntPtr(task.TargetCount),
		"isRequired":      task.IsRequired,
		"repeating":       task.Repeating,
		"repeatFrequency": nullableString(string(task.RepeatFrequency)),
		"repeatInterval":  nullablePositiveInt(task.RepeatInterval),
		"repeatWeekdays":  task.RepeatWeekdays,
		"repeatEndDate":   nullableTime(task.RepeatEndDate),
		"frequency":       task.Frequency,
		"frequencyConfig": task.FrequencyConfig,
		"category":        nullableString(task.Category),
		"legacyStatus":    string(task.Status),
		"status":          task.Status,
		"legacyPriority":  legacyPriority(task.Priority),
		"priority":        task.Priority,
	}
}

func deriveFrequency(task *ScheduleTask) ScheduleTaskFrequency {
	switch task.RepeatFrequency {
	case ScheduleTaskRepeatFrequencyWeekly:
		return ScheduleTaskFrequencyWeekly
	case ScheduleTaskRepeatFrequencyMonthly:
		return ScheduleTaskFrequencyMonthly
	case ScheduleTaskRepeatFrequencyDaily:
		return ScheduleTaskFrequencyDaily
	}
	if task.Repeating || task.RepeatInterval > 0 || len(task.RepeatWeekdays) > 0 {
		return ScheduleTaskFrequencyCustom
	}
	return ScheduleTaskFrequencyDaily
}

func legacyPriority(priority ScheduleTaskPriority) int {
	switch priority {
	case ScheduleTaskPriorityUrgent:
		return 3
	case ScheduleTaskPriorityHigh:
		return 2
	case ScheduleTaskPriorityMedium:
		return 1
	case ScheduleTaskPriorityLow:
		return 0
	default:
		return 1
	}
}

func nullableString(value string) interface{} {
	if value == "" {
		return nil
	}
	return value
}

func nullableTime(value time.Time) interface{} {
	if value.IsZero() {
		return nil
	}
	return value
}

func nullableClock(value time.Time) interface{} {
	if value.IsZero() {
		return nil
	}
	return value.Format("15:04:05")
}

func nullablePositiveInt(value int) interface{} {
	if value <= 0 {
		return nil
	}
	return value
}

func nullableIntPtr(value *int) interface{} {
	if value == nil {
		return nil
	}
	return *value
}
