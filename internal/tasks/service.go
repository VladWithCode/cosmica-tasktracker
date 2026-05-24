package tasks

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/vladwithcode/tasktracker/internal/auth"
	"github.com/vladwithcode/tasktracker/internal/db"
)

var (
	ErrForbidden = errors.New("task access forbidden")
	ErrNotFound  = errors.New("task not found")
)

type Service struct {
	repo Repository
}

type UpdateTaskInput struct {
	ActualEnd       time.Time
	ActualStart     time.Time
	ApplyToSchedule bool
	Category        *string
	Date            time.Time
	Description     *string
	DurationMinutes *int
	EndTime         *time.Time
	Frequency       *db.ScheduleTaskFrequency
	IsRequired      *bool
	Notes           string
	Priority        *db.ScheduleTaskPriority
	StartTime       *time.Time
	Status          db.TaskStatus
	TargetCount     *int
	Title           *string
	// CurrentCount is a pointer so the service can distinguish between "field
	// absent" (nil) and "explicitly set to 0" (pointer to 0). Required for
	// counter tasks like the water bottle UI.
	CurrentCount *int
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Create(ctx context.Context, userID string, scheduleTask *db.ScheduleTask) (*db.DetailedTask, error) {
	scheduleTask.UserID = userID
	scheduleTask.ID = uuid.Must(uuid.NewV7()).String()
	scheduleTask.Status = db.ScheduleTaskStatusActive

	if scheduleTask.StartDate.IsZero() {
		scheduleTask.StartDate = time.Now()
	}

	if err := s.repo.CreateScheduleTask(ctx, scheduleTask); err != nil {
		return nil, err
	}

	task, err := s.repo.CreateTaskForSchedule(ctx, scheduleTask)
	if err != nil {
		return nil, err
	}

	return db.NewDetailedTask(task, scheduleTask), nil
}

func (s *Service) GetDetails(ctx context.Context, authData *auth.Auth, id string) (*db.DetailedTask, error) {
	task, err := s.repo.GetTaskDetailsByID(ctx, id)
	if err != nil {
		return nil, normalizeNotFound(err)
	}

	if canAccessTask(authData, task.UserID) {
		task.CanEdit = true
		task.CanApplyToSchedule = true
		return task, nil
	}

	allowed, err := s.repo.UserHasTaskPermission(ctx, task.UserID, authData.ID, db.SharingPermissionView)
	if err != nil {
		return nil, err
	}
	if !allowed {
		return nil, ErrForbidden
	}
	canEdit, err := s.repo.UserHasTaskPermission(ctx, task.UserID, authData.ID, db.SharingPermissionEdit)
	if err != nil {
		return nil, err
	}
	task.CanEdit = canEdit
	task.CanApplyToSchedule = false

	return task, nil
}

func (s *Service) CanViewOwner(ctx context.Context, authData *auth.Auth, ownerUserID string) error {
	if canAccessTask(authData, ownerUserID) {
		return nil
	}

	allowed, err := s.repo.UserHasTaskPermission(ctx, ownerUserID, authData.ID, db.SharingPermissionView)
	if err != nil {
		return err
	}
	if !allowed {
		return ErrForbidden
	}

	return nil
}

func (s *Service) ListByUser(ctx context.Context, userID string) ([]*db.DetailedTask, error) {
	tasks, err := s.repo.GetTasksByUserID(ctx, userID)
	if err != nil {
		return nil, err
	}

	return ensureDetailedTaskSlice(tasks), nil
}

func (s *Service) ListToday(ctx context.Context, userID string) ([]*db.DetailedTask, error) {
	if _, err := s.repo.CreateUsersTodayTasks(ctx, userID); err != nil {
		return nil, err
	}

	tasks, err := s.repo.GetUserTodayDetailedTasks(ctx, userID)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}

	return ensureDetailedTaskSlice(tasks), nil
}

func (s *Service) ListByDate(ctx context.Context, userID string, date time.Time) ([]*db.DetailedTask, error) {
	if _, err := s.repo.CreateUserTasksForDate(ctx, userID, date); err != nil {
		return nil, err
	}

	tasks, err := s.repo.GetUserDateDetailedTasks(ctx, userID, date)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}

	return ensureDetailedTaskSlice(tasks), nil
}

func (s *Service) Update(ctx context.Context, authData *auth.Auth, id string, input UpdateTaskInput) (*db.DetailedTask, error) {
	task, err := s.repo.GetTaskByID(ctx, id)
	if err != nil {
		return nil, normalizeNotFound(err)
	}

	if !canAccessTask(authData, task.UserID) {
		allowed, err := s.repo.UserHasTaskPermission(ctx, task.UserID, authData.ID, db.SharingPermissionEdit)
		if err != nil {
			return nil, err
		}
		if !allowed || input.ApplyToSchedule {
			return nil, ErrForbidden
		}
	}
	canApplyToSchedule := canAccessTask(authData, task.UserID)

	previousStatus := task.Status
	if input.Status != "" {
		task.Status = input.Status
	}
	if !input.Date.IsZero() {
		task.Date = input.Date
	}
	if !input.ActualStart.IsZero() {
		task.ActualStart = input.ActualStart
	}
	if !input.ActualEnd.IsZero() {
		task.ActualEnd = input.ActualEnd
	}
	if input.CurrentCount != nil {
		task.CurrentCount = *input.CurrentCount
	}
	if input.TargetCount != nil {
		task.TargetCount = input.TargetCount
	}
	if input.Notes != "" {
		task.Notes = input.Notes
	}
	if input.Title != nil {
		task.Title = *input.Title
	}
	if input.Description != nil {
		task.Description = *input.Description
	}

	now := time.Now()
	if task.Status == db.TaskStatusInProgress && task.ActualStart.IsZero() {
		task.ActualStart = now
	}
	if task.Status == db.TaskStatusCompleted {
		if task.CompletedAt.IsZero() {
			task.CompletedAt = now
		}
		if task.ActualEnd.IsZero() {
			task.ActualEnd = task.CompletedAt
		}
	}
	if task.Status != db.TaskStatusCompleted {
		task.CompletedAt = time.Time{}
		task.ActualEnd = time.Time{}
	}

	// Idempotency rule: only generate a task_completions row when the task
	// transitions from a non-completed state into completed. Re-sending
	// status=completed for a task that was already completed is a no-op for
	// the history table.
	isCompletingTransition := task.Status == db.TaskStatusCompleted && previousStatus != db.TaskStatusCompleted

	var schedule *db.ScheduleTask
	if input.ApplyToSchedule {
		schedule, err = s.repo.GetScheduleByID(ctx, task.ScheduleTaskID)
		if err != nil {
			return nil, normalizeNotFound(err)
		}
		if input.Title != nil {
			schedule.Title = *input.Title
		}
		if input.Description != nil {
			schedule.Description = *input.Description
		}
		if input.Priority != nil {
			schedule.Priority = *input.Priority
		}
		if input.IsRequired != nil {
			schedule.IsRequired = *input.IsRequired
			schedule.Required = *input.IsRequired
		}
		if input.StartTime != nil {
			schedule.StartTime = *input.StartTime
		}
		if input.EndTime != nil {
			schedule.EndTime = *input.EndTime
		}
		if input.DurationMinutes != nil {
			schedule.DurationMinutes = *input.DurationMinutes
			schedule.Duration = time.Duration(*input.DurationMinutes) * time.Minute
		}
		if input.TargetCount != nil {
			schedule.TargetCount = input.TargetCount
		}
		if input.Frequency != nil {
			schedule.Frequency = *input.Frequency
		}
		if input.Category != nil {
			schedule.Category = *input.Category
		}
	}

	if isCompletingTransition {
		completion := &db.TaskCompletion{
			TaskID:      task.ID,
			UserID:      task.UserID,
			CompletedAt: task.CompletedAt,
			ActualStart: task.ActualStart,
			ActualEnd:   task.ActualEnd,
			Count:       task.CurrentCount,
			Notes:       task.Notes,
		}
		if input.ApplyToSchedule {
			if err := s.repo.CompleteTaskAndSchedule(ctx, task, schedule, completion); err != nil {
				return nil, err
			}
		} else {
			if err := s.repo.CompleteTask(ctx, task, completion); err != nil {
				return nil, err
			}
		}
	} else {
		if input.ApplyToSchedule {
			if err := s.repo.UpdateTaskAndSchedule(ctx, task, schedule); err != nil {
				return nil, err
			}
		} else {
			if err := s.repo.UpdateTask(ctx, task); err != nil {
				return nil, err
			}
		}
	}

	detailedTask, err := s.repo.GetTaskDetailsByID(ctx, task.ID)
	if err != nil {
		return nil, err
	}
	detailedTask.CanEdit = true
	detailedTask.CanApplyToSchedule = canApplyToSchedule

	return detailedTask, nil
}

func (s *Service) GetDayProgress(ctx context.Context, userID string, day time.Time) (*db.DayProgress, error) {
	return s.repo.GetUserDayProgress(ctx, userID, day)
}

func (s *Service) GetHistory(ctx context.Context, userID string, from time.Time, to time.Time) (*db.TaskHistoryRange, error) {
	return s.repo.GetUserTaskHistory(ctx, userID, from, to)
}

func (s *Service) GetMetrics(ctx context.Context, userID string, from time.Time, to time.Time) (*db.TaskMetricsRange, error) {
	return s.repo.GetUserTaskMetrics(ctx, userID, from, to)
}

func (s *Service) Delete(ctx context.Context, authData *auth.Auth, id string) error {
	task, err := s.repo.GetTaskByID(ctx, id)
	if err != nil {
		return normalizeNotFound(err)
	}

	if !canAccessTask(authData, task.UserID) {
		return ErrForbidden
	}

	return s.repo.DeleteTask(ctx, task)
}

func canAccessTask(authData *auth.Auth, userID string) bool {
	return authData.ID == userID || authData.HasAccess(auth.AccessLevelAdmin)
}

func ensureDetailedTaskSlice(tasks []*db.DetailedTask) []*db.DetailedTask {
	if tasks == nil {
		return []*db.DetailedTask{}
	}

	return tasks
}

func normalizeNotFound(err error) error {
	if errors.Is(err, sql.ErrNoRows) || errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}

	return err
}
