package schedules

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
	ErrForbidden = errors.New("schedule access forbidden")
	ErrNotFound  = errors.New("schedule not found")
)

type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Create(ctx context.Context, userID string, schedule *db.ScheduleTask) (*db.ScheduleTask, error) {
	return s.CreateForOwner(ctx, userID, userID, schedule)
}

func (s *Service) CreateForOwner(ctx context.Context, ownerUserID string, creatorUserID string, schedule *db.ScheduleTask) (*db.ScheduleTask, error) {
	schedule.ID = uuid.Must(uuid.NewV7()).String()
	schedule.UserID = ownerUserID
	schedule.CreatedBy = creatorUserID
	if schedule.Status == "" {
		schedule.Status = db.ScheduleTaskStatusActive
	}
	if schedule.StartDate.IsZero() {
		schedule.StartDate = time.Now()
	}

	if err := s.repo.Create(ctx, schedule); err != nil {
		return nil, err
	}

	return schedule, nil
}

func (s *Service) List(ctx context.Context, userID string) ([]*db.ScheduleTask, error) {
	schedules, err := s.repo.ListByUser(ctx, userID)
	if err != nil {
		return nil, err
	}
	if schedules == nil {
		return []*db.ScheduleTask{}, nil
	}

	return schedules, nil
}

func (s *Service) Get(ctx context.Context, authData *auth.Auth, id string) (*db.ScheduleTask, error) {
	schedule, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, normalizeNotFound(err)
	}
	if !canAccessSchedule(authData, schedule.UserID) {
		allowed, err := s.repo.UserHasTaskPermission(ctx, schedule.UserID, authData.ID, db.SharingPermissionView)
		if err != nil {
			return nil, err
		}
		if !allowed {
			return nil, ErrForbidden
		}
	}

	return schedule, nil
}

func (s *Service) Update(ctx context.Context, authData *auth.Auth, id string, input *db.ScheduleTask) (*db.ScheduleTask, error) {
	existing, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, normalizeNotFound(err)
	}
	if !canAccessSchedule(authData, existing.UserID) {
		return nil, ErrForbidden
	}

	input.ID = existing.ID
	input.UserID = existing.UserID
	input.CreatedBy = existing.CreatedBy
	if input.Status == "" {
		input.Status = existing.Status
	}
	if input.StartDate.IsZero() {
		input.StartDate = existing.StartDate
	}

	if err := s.repo.Update(ctx, input); err != nil {
		return nil, err
	}

	return s.repo.GetByID(ctx, id)
}

func (s *Service) Delete(ctx context.Context, authData *auth.Auth, id string) error {
	schedule, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return normalizeNotFound(err)
	}
	if !canAccessSchedule(authData, schedule.UserID) {
		return ErrForbidden
	}

	return s.repo.Delete(ctx, schedule)
}

func (s *Service) Pause(ctx context.Context, authData *auth.Auth, id string) (*db.ScheduleTask, error) {
	return s.setStatus(ctx, authData, id, db.ScheduleTaskStatusPaused)
}

func (s *Service) Resume(ctx context.Context, authData *auth.Auth, id string) (*db.ScheduleTask, error) {
	return s.setStatus(ctx, authData, id, db.ScheduleTaskStatusActive)
}

func (s *Service) setStatus(ctx context.Context, authData *auth.Auth, id string, status db.ScheduleTaskStatus) (*db.ScheduleTask, error) {
	schedule, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, normalizeNotFound(err)
	}
	if !canAccessSchedule(authData, schedule.UserID) {
		return nil, ErrForbidden
	}

	if err := s.repo.SetStatus(ctx, schedule.ID, schedule.UserID, status); err != nil {
		return nil, err
	}

	return s.repo.GetByID(ctx, id)
}

func canAccessSchedule(authData *auth.Auth, userID string) bool {
	return authData.ID == userID || authData.HasAccess(auth.AccessLevelAdmin)
}

func normalizeNotFound(err error) error {
	if errors.Is(err, sql.ErrNoRows) || errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}

	return err
}
