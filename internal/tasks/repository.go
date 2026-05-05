package tasks

import (
	"context"
	"time"

	"github.com/vladwithcode/tasktracker/internal/db"
)

type Repository interface {
	CompleteTask(ctx context.Context, task *db.Task, completion *db.TaskCompletion) error
	CompleteTaskAndSchedule(ctx context.Context, task *db.Task, schedule *db.ScheduleTask, completion *db.TaskCompletion) error
	CreateScheduleTask(ctx context.Context, scheduleTask *db.ScheduleTask) error
	CreateTaskCompletion(ctx context.Context, completion *db.TaskCompletion) error
	CreateTaskForSchedule(ctx context.Context, scheduleTask *db.ScheduleTask) (*db.Task, error)
	CreateUsersTodayTasks(ctx context.Context, userID string) ([]*db.DetailedTask, error)
	DeleteTask(ctx context.Context, task *db.Task) error
	GetScheduleByID(ctx context.Context, id string) (*db.ScheduleTask, error)
	GetTaskByID(ctx context.Context, id string) (*db.Task, error)
	GetTaskDetailsByID(ctx context.Context, id string) (*db.DetailedTask, error)
	GetTasksByUserID(ctx context.Context, userID string) ([]*db.DetailedTask, error)
	GetUserDayProgress(ctx context.Context, userID string, day time.Time) (*db.DayProgress, error)
	GetUserTaskHistory(ctx context.Context, userID string, from time.Time, to time.Time) (*db.TaskHistoryRange, error)
	GetUserTaskMetrics(ctx context.Context, userID string, from time.Time, to time.Time) (*db.TaskMetricsRange, error)
	GetUserTodayDetailedTasks(ctx context.Context, userID string) ([]*db.DetailedTask, error)
	UpdateTask(ctx context.Context, task *db.Task) error
	UpdateTaskAndSchedule(ctx context.Context, task *db.Task, schedule *db.ScheduleTask) error
}

type DBRepository struct{}

func NewRepository() *DBRepository {
	return &DBRepository{}
}

func (r *DBRepository) CompleteTask(ctx context.Context, task *db.Task, completion *db.TaskCompletion) error {
	return db.CompleteTask(ctx, task, completion)
}

func (r *DBRepository) CompleteTaskAndSchedule(ctx context.Context, task *db.Task, schedule *db.ScheduleTask, completion *db.TaskCompletion) error {
	return db.CompleteTaskAndSchedule(ctx, task, schedule, completion)
}

func (r *DBRepository) CreateScheduleTask(ctx context.Context, scheduleTask *db.ScheduleTask) error {
	return db.CreateScheduleTask(ctx, scheduleTask)
}

func (r *DBRepository) CreateTaskCompletion(ctx context.Context, completion *db.TaskCompletion) error {
	return db.CreateTaskCompletion(ctx, completion)
}

func (r *DBRepository) CreateTaskForSchedule(ctx context.Context, scheduleTask *db.ScheduleTask) (*db.Task, error) {
	return db.CreateTaskForSchedule(ctx, scheduleTask)
}

func (r *DBRepository) CreateUsersTodayTasks(ctx context.Context, userID string) ([]*db.DetailedTask, error) {
	return db.CreateUsersTodayTasks(ctx, userID)
}

func (r *DBRepository) DeleteTask(ctx context.Context, task *db.Task) error {
	return db.DeleteTask(ctx, task)
}

func (r *DBRepository) GetScheduleByID(ctx context.Context, id string) (*db.ScheduleTask, error) {
	return db.GetScheduleTaskByID(ctx, id)
}

func (r *DBRepository) GetTaskByID(ctx context.Context, id string) (*db.Task, error) {
	return db.GetTaskByID(ctx, id)
}

func (r *DBRepository) GetTaskDetailsByID(ctx context.Context, id string) (*db.DetailedTask, error) {
	return db.GetTaskDetailsByID(ctx, id)
}

func (r *DBRepository) GetTasksByUserID(ctx context.Context, userID string) ([]*db.DetailedTask, error) {
	return db.GetTasksByUserID(ctx, userID)
}

func (r *DBRepository) GetUserDayProgress(ctx context.Context, userID string, day time.Time) (*db.DayProgress, error) {
	return db.GetUserDayProgress(ctx, userID, day)
}

func (r *DBRepository) GetUserTaskHistory(ctx context.Context, userID string, from time.Time, to time.Time) (*db.TaskHistoryRange, error) {
	return db.GetUserTaskHistory(ctx, userID, from, to)
}

func (r *DBRepository) GetUserTaskMetrics(ctx context.Context, userID string, from time.Time, to time.Time) (*db.TaskMetricsRange, error) {
	return db.GetUserTaskMetrics(ctx, userID, from, to)
}

func (r *DBRepository) GetUserTodayDetailedTasks(ctx context.Context, userID string) ([]*db.DetailedTask, error) {
	return db.GetUserTodayDetailedTasks(ctx, userID)
}

func (r *DBRepository) UpdateTask(ctx context.Context, task *db.Task) error {
	return db.UpdateTask(ctx, task)
}

func (r *DBRepository) UpdateTaskAndSchedule(ctx context.Context, task *db.Task, schedule *db.ScheduleTask) error {
	return db.UpdateTaskAndSchedule(ctx, task, schedule)
}
