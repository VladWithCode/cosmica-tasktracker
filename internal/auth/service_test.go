package auth

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/vladwithcode/tasktracker/internal/db"
	"golang.org/x/crypto/bcrypt"
)

type mockUserRepository struct {
	created       *db.User
	emailTaken    bool
	stubUser      *db.User
	usernameTaken bool
	updatedHash   string
}

func (m *mockUserRepository) CreateUser(_ context.Context, user *db.User) error {
	userCopy := *user
	m.created = &userCopy
	return nil
}

func (m *mockUserRepository) GetByID(_ context.Context, _ string) (*db.User, error) {
	if m.stubUser != nil {
		return m.stubUser, nil
	}
	return nil, errors.New("not found")
}

func (m *mockUserRepository) GetByUsername(_ context.Context, _ string) (*db.User, error) {
	return nil, errors.New("not implemented")
}

func (m *mockUserRepository) IsEmailTaken(_ context.Context, _ string) (bool, error) {
	return m.emailTaken, nil
}

func (m *mockUserRepository) IsUsernameTaken(_ context.Context, _ string) (bool, error) {
	return m.usernameTaken, nil
}

func (m *mockUserRepository) UpdatePassword(_ context.Context, _ string, hashedPassword string) error {
	m.updatedHash = hashedPassword
	return nil
}

func TestRegisterValidatesUsername(t *testing.T) {
	t.Setenv("JWT_SECRET", strings.Repeat("a", 32))
	service := NewService(&mockUserRepository{})

	_, err := service.Register(context.Background(), RegisterInput{
		Fullname: "Test User",
		Password: "Test1234",
		Username: "ab",
	})

	assertFieldError(t, err, "username")

	_, err = service.Register(context.Background(), RegisterInput{
		Fullname: "Test User",
		Password: "Test1234",
		Username: "bad.name",
	})

	assertFieldError(t, err, "username")
}

func TestRegisterNormalizesUsername(t *testing.T) {
	t.Setenv("JWT_SECRET", strings.Repeat("a", 32))
	repo := &mockUserRepository{}
	service := NewService(repo)

	_, err := service.Register(context.Background(), RegisterInput{
		Fullname: "Test User",
		Password: "Test1234",
		Username: "Mixed_Case-01",
	})
	if err != nil {
		t.Fatalf("Register() error = %v", err)
	}

	if repo.created == nil {
		t.Fatal("expected user to be created")
	}
	if repo.created.Username != "mixed_case-01" {
		t.Fatalf("expected normalized username, got %q", repo.created.Username)
	}
}

func TestRegisterValidatesPassword(t *testing.T) {
	t.Setenv("JWT_SECRET", strings.Repeat("a", 32))
	service := NewService(&mockUserRepository{})

	for _, password := range []string{"short1", "abcdefgh", strings.Repeat("a", 129) + "1"} {
		_, err := service.Register(context.Background(), RegisterInput{
			Fullname: "Test User",
			Password: password,
			Username: "testuser",
		})
		assertFieldError(t, err, "password")
	}
}

func TestRegisterValidatesEmail(t *testing.T) {
	t.Setenv("JWT_SECRET", strings.Repeat("a", 32))
	service := NewService(&mockUserRepository{})

	_, err := service.Register(context.Background(), RegisterInput{
		Email:    "bad-email",
		Fullname: "Test User",
		Password: "Test1234",
		Username: "testuser",
	})

	assertFieldError(t, err, "email")
}

func TestRegisterAllowsOptionalEmail(t *testing.T) {
	t.Setenv("JWT_SECRET", strings.Repeat("a", 32))
	repo := &mockUserRepository{}
	service := NewService(repo)

	_, err := service.Register(context.Background(), RegisterInput{
		Fullname: "Test User",
		Password: "Test1234",
		Username: "testuser",
	})
	if err != nil {
		t.Fatalf("Register() error = %v", err)
	}

	if repo.created == nil {
		t.Fatal("expected user to be created")
	}
	if repo.created.Email != "" {
		t.Fatalf("expected blank email, got %q", repo.created.Email)
	}
}

func TestRegisterReturnsConflicts(t *testing.T) {
	t.Setenv("JWT_SECRET", strings.Repeat("a", 32))

	_, err := NewService(&mockUserRepository{usernameTaken: true}).Register(context.Background(), RegisterInput{
		Email:    "test@example.com",
		Fullname: "Test User",
		Password: "Test1234",
		Username: "testuser",
	})
	if !errors.Is(err, ErrUsernameTaken) {
		t.Fatalf("expected ErrUsernameTaken, got %v", err)
	}

	_, err = NewService(&mockUserRepository{emailTaken: true}).Register(context.Background(), RegisterInput{
		Email:    "test@example.com",
		Fullname: "Test User",
		Password: "Test1234",
		Username: "testuser",
	})
	if !errors.Is(err, ErrEmailTaken) {
		t.Fatalf("expected ErrEmailTaken, got %v", err)
	}
}

func TestRegisterHashesPassword(t *testing.T) {
	t.Setenv("JWT_SECRET", strings.Repeat("a", 32))
	repo := &mockUserRepository{}
	service := NewService(repo)

	_, err := service.Register(context.Background(), RegisterInput{
		Email:    "test@example.com",
		Fullname: "Test User",
		Password: "Test1234",
		Username: "testuser",
	})
	if err != nil {
		t.Fatalf("Register() error = %v", err)
	}

	if repo.created.Password == "Test1234" {
		t.Fatal("expected password to be hashed")
	}
	if err := bcrypt.CompareHashAndPassword([]byte(repo.created.Password), []byte("Test1234")); err != nil {
		t.Fatalf("expected valid bcrypt hash: %v", err)
	}
}

func assertFieldError(t *testing.T, err error, field string) {
	t.Helper()

	var validationError *ValidationError
	if !errors.As(err, &validationError) {
		t.Fatalf("expected validation error, got %v", err)
	}
	if validationError.Fields[field] == "" {
		t.Fatalf("expected %s field error, got %#v", field, validationError.Fields)
	}
}

func makeUserWithPassword(t *testing.T, rawPassword string) *db.User {
	t.Helper()
	hash, err := bcrypt.GenerateFromPassword([]byte(rawPassword), 4)
	if err != nil {
		t.Fatalf("bcrypt failed: %v", err)
	}
	return &db.User{ID: "user-1", Username: "tester", Password: string(hash)}
}

func TestChangePasswordRejectsWrongCurrentPassword(t *testing.T) {
	repo := &mockUserRepository{stubUser: makeUserWithPassword(t, "Current1234")}
	service := NewService(repo)

	err := service.ChangePassword(context.Background(), ChangePasswordInput{
		CurrentPassword: "WrongPass9",
		NewPassword:     "NewPass5678",
		UserID:          "user-1",
	})
	if !errors.Is(err, ErrWrongCurrentPassword) {
		t.Fatalf("expected ErrWrongCurrentPassword, got %v", err)
	}
	if repo.updatedHash != "" {
		t.Fatal("password should not be updated on wrong current password")
	}
}

func TestChangePasswordRejectsWeakNewPassword(t *testing.T) {
	repo := &mockUserRepository{stubUser: makeUserWithPassword(t, "Current1234")}
	service := NewService(repo)

	for _, bad := range []string{"short1", "alllowercase", strings.Repeat("a", 129) + "1"} {
		err := service.ChangePassword(context.Background(), ChangePasswordInput{
			CurrentPassword: "Current1234",
			NewPassword:     bad,
			UserID:          "user-1",
		})
		assertFieldError(t, err, "password")
	}
	if repo.updatedHash != "" {
		t.Fatal("password should not be updated on validation failure")
	}
}

func TestChangePasswordUpdatesHash(t *testing.T) {
	repo := &mockUserRepository{stubUser: makeUserWithPassword(t, "Current1234")}
	service := NewService(repo)

	err := service.ChangePassword(context.Background(), ChangePasswordInput{
		CurrentPassword: "Current1234",
		NewPassword:     "NewPass5678",
		UserID:          "user-1",
	})
	if err != nil {
		t.Fatalf("ChangePassword() error = %v", err)
	}
	if repo.updatedHash == "" {
		t.Fatal("expected password hash to be stored")
	}
	if err := bcrypt.CompareHashAndPassword([]byte(repo.updatedHash), []byte("NewPass5678")); err != nil {
		t.Fatalf("stored hash does not match new password: %v", err)
	}
}

func TestChangePasswordRejectsUnknownUser(t *testing.T) {
	repo := &mockUserRepository{} // stubUser nil → GetByID returns error
	service := NewService(repo)

	err := service.ChangePassword(context.Background(), ChangePasswordInput{
		CurrentPassword: "Current1234",
		NewPassword:     "NewPass5678",
		UserID:          "no-such-user",
	})
	if !errors.Is(err, ErrInvalidCredentials) {
		t.Fatalf("expected ErrInvalidCredentials, got %v", err)
	}
}
