package users

import (
	"context"

	"github.com/vladwithcode/tasktracker/internal/db"
)

type Repository interface {
	Create(ctx context.Context, user *db.User) error
	Delete(ctx context.Context, userID string) error
	GetByID(ctx context.Context, id string) (*db.User, error)
	Update(ctx context.Context, user *db.User) error
}

type DBRepository struct{}

func NewRepository() *DBRepository {
	return &DBRepository{}
}

func (r *DBRepository) Create(ctx context.Context, user *db.User) error {
	return db.CreateUser(ctx, user)
}

func (r *DBRepository) Delete(ctx context.Context, userID string) error {
	return db.DeleteUser(ctx, userID)
}

func (r *DBRepository) GetByID(ctx context.Context, id string) (*db.User, error) {
	return db.GetUserByID(ctx, id)
}

func (r *DBRepository) Update(ctx context.Context, user *db.User) error {
	return db.UpdateUser(ctx, user)
}
