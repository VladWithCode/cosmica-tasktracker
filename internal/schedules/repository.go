package schedules

import (
	"context"

	"github.com/vladwithcode/tasktracker/internal/db"
)

type Repository interface {
	Create(ctx context.Context, schedule *db.ScheduleTask) error
	Delete(ctx context.Context, schedule *db.ScheduleTask) error
	GetByID(ctx context.Context, id string) (*db.ScheduleTask, error)
	ListByUser(ctx context.Context, userID string) ([]*db.ScheduleTask, error)
	SetStatus(ctx context.Context, id string, userID string, status db.ScheduleTaskStatus) error
	Update(ctx context.Context, schedule *db.ScheduleTask) error
}

type DBRepository struct{}

func NewRepository() *DBRepository {
	return &DBRepository{}
}

func (r *DBRepository) Create(ctx context.Context, schedule *db.ScheduleTask) error {
	return db.CreateScheduleTask(ctx, schedule)
}

func (r *DBRepository) Delete(ctx context.Context, schedule *db.ScheduleTask) error {
	return db.DeleteScheduleTask(ctx, schedule)
}

func (r *DBRepository) GetByID(ctx context.Context, id string) (*db.ScheduleTask, error) {
	return db.GetScheduleTaskByID(ctx, id)
}

func (r *DBRepository) ListByUser(ctx context.Context, userID string) ([]*db.ScheduleTask, error) {
	return db.GetScheduleTasksByUserID(ctx, userID)
}

func (r *DBRepository) SetStatus(ctx context.Context, id string, userID string, status db.ScheduleTaskStatus) error {
	return db.SetScheduleTaskStatus(ctx, id, userID, status)
}

func (r *DBRepository) Update(ctx context.Context, schedule *db.ScheduleTask) error {
	return db.UpdateScheduleTask(ctx, schedule)
}
