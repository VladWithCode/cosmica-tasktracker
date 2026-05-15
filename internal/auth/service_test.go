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
	usernameTaken bool
}

func (m *mockUserRepository) CreateUser(_ context.Context, user *db.User) error {
	userCopy := *user
	m.created = &userCopy
	return nil
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
