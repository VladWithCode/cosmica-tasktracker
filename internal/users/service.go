package users

import (
	"context"
	"database/sql"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/vladwithcode/tasktracker/internal/auth"
	"github.com/vladwithcode/tasktracker/internal/db"
)

var (
	ErrForbidden = errors.New("user access forbidden")
	ErrNotFound  = errors.New("user not found")
)

type Profile struct {
	ID       string `json:"id"`
	Username string `json:"username"`
	Fullname string `json:"fullname"`
	Email    string `json:"email,omitempty"`
	Role     string `json:"role"`
}

type UpdateProfileInput struct {
	Email    string `json:"email"`
	Fullname string `json:"fullname"`
}

type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) GetProfile(ctx context.Context, userID string) (*Profile, error) {
	user, err := s.repo.GetByID(ctx, userID)
	if err != nil {
		return nil, normalizeNotFound(err)
	}

	return profileFromUser(user), nil
}

func (s *Service) UpdateProfile(ctx context.Context, userID string, input UpdateProfileInput) (*Profile, error) {
	user, err := s.repo.GetByID(ctx, userID)
	if err != nil {
		return nil, normalizeNotFound(err)
	}

	user.Fullname = input.Fullname
	user.Email = input.Email

	if err := s.repo.Update(ctx, user); err != nil {
		return nil, err
	}

	return profileFromUser(user), nil
}

func (s *Service) CreateUser(ctx context.Context, input *db.User, role string) (*Profile, error) {
	input.ID = uuid.Must(uuid.NewV7()).String()
	input.Role = role

	if err := s.repo.Create(ctx, input); err != nil {
		return nil, err
	}

	return profileFromUser(input), nil
}

func (s *Service) DeleteUser(ctx context.Context, authData *auth.Auth, userID string) (bool, error) {
	user, err := s.repo.GetByID(ctx, userID)
	if err != nil {
		return false, normalizeNotFound(err)
	}

	isSameUser := user.ID == authData.ID
	userIsSuperAdmin := user.Role == db.RoleSuperAdmin
	loggedHasAdminPrivilege := authData.HasAccess(auth.AccessLevelAdmin)
	loggedHasSuperPrivilege := authData.HasAccess(auth.AccessLevelSuperAdmin)

	if !isSameUser && (!loggedHasAdminPrivilege || userIsSuperAdmin && !loggedHasSuperPrivilege) {
		return false, ErrForbidden
	}

	if err := s.repo.Delete(ctx, userID); err != nil {
		return false, err
	}

	return isSameUser, nil
}

func profileFromUser(user *db.User) *Profile {
	return &Profile{
		ID:       user.ID,
		Username: user.Username,
		Fullname: user.Fullname,
		Email:    user.Email,
		Role:     user.Role,
	}
}

func normalizeNotFound(err error) error {
	if errors.Is(err, sql.ErrNoRows) || errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}

	return err
}
