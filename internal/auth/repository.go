package auth

import (
	"context"

	"github.com/vladwithcode/tasktracker/internal/db"
)

type UserRepository interface {
	CreateUser(ctx context.Context, user *db.User) error
	GetByID(ctx context.Context, id string) (*db.User, error)
	GetByUsername(ctx context.Context, username string) (*db.User, error)
	IsEmailTaken(ctx context.Context, email string) (bool, error)
	IsUsernameTaken(ctx context.Context, username string) (bool, error)
	UpdatePassword(ctx context.Context, userID string, hashedPassword string) error

	// Refresh-token session storage.
	InsertRefreshToken(ctx context.Context, token *db.RefreshToken) error
	GetRefreshTokenByHash(ctx context.Context, tokenHash string) (*db.RefreshToken, error)
	RevokeRefreshToken(ctx context.Context, id string, replacedByID string) error
	RevokeAllUserRefreshTokens(ctx context.Context, userID string) error
}

type DBUserRepository struct{}

func NewUserRepository() *DBUserRepository {
	return &DBUserRepository{}
}

func (r *DBUserRepository) GetByID(ctx context.Context, id string) (*db.User, error) {
	return db.GetUserByID(ctx, id)
}

func (r *DBUserRepository) UpdatePassword(ctx context.Context, userID string, hashedPassword string) error {
	return db.UpdateUserPassword(ctx, userID, hashedPassword)
}

func (r *DBUserRepository) GetByUsername(ctx context.Context, username string) (*db.User, error) {
	return db.GetUserByUsername(ctx, username)
}

func (r *DBUserRepository) CreateUser(ctx context.Context, user *db.User) error {
	return db.InsertUser(ctx, user)
}

func (r *DBUserRepository) IsUsernameTaken(ctx context.Context, username string) (bool, error) {
	return db.UserExistsByUsername(ctx, username)
}

func (r *DBUserRepository) IsEmailTaken(ctx context.Context, email string) (bool, error) {
	return db.UserExistsByEmail(ctx, email)
}

func (r *DBUserRepository) InsertRefreshToken(ctx context.Context, token *db.RefreshToken) error {
	return db.InsertRefreshToken(ctx, token)
}

func (r *DBUserRepository) GetRefreshTokenByHash(ctx context.Context, tokenHash string) (*db.RefreshToken, error) {
	return db.GetRefreshTokenByHash(ctx, tokenHash)
}

func (r *DBUserRepository) RevokeRefreshToken(ctx context.Context, id string, replacedByID string) error {
	return db.RevokeRefreshToken(ctx, id, replacedByID)
}

func (r *DBUserRepository) RevokeAllUserRefreshTokens(ctx context.Context, userID string) error {
	return db.RevokeAllUserRefreshTokens(ctx, userID)
}
