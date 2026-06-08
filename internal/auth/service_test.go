package auth

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/vladwithcode/tasktracker/internal/db"
	"golang.org/x/crypto/bcrypt"
)

type mockUserRepository struct {
	created       *db.User
	emailTaken    bool
	stubUser      *db.User
	usernameTaken bool
	updatedHash   string

	// In-memory refresh-token store keyed by hash.
	refreshByHash    map[string]*db.RefreshToken
	revokeAllCalls   []string
	revokeTokenCalls []string
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
	if m.stubUser != nil {
		return m.stubUser, nil
	}
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

func (m *mockUserRepository) InsertRefreshToken(_ context.Context, token *db.RefreshToken) error {
	if m.refreshByHash == nil {
		m.refreshByHash = map[string]*db.RefreshToken{}
	}
	stored := *token
	m.refreshByHash[token.TokenHash] = &stored
	return nil
}

func (m *mockUserRepository) GetRefreshTokenByHash(_ context.Context, tokenHash string) (*db.RefreshToken, error) {
	if rec, ok := m.refreshByHash[tokenHash]; ok {
		return rec, nil
	}
	return nil, errors.New("not found")
}

func (m *mockUserRepository) RevokeRefreshToken(_ context.Context, id string, replacedByID string) error {
	m.revokeTokenCalls = append(m.revokeTokenCalls, id)
	for _, rec := range m.refreshByHash {
		if rec.ID == id {
			now := time.Now()
			rec.RevokedAt = &now
			if replacedByID != "" {
				replaced := replacedByID
				rec.ReplacedByTokenID = &replaced
			}
		}
	}
	return nil
}

func (m *mockUserRepository) RevokeAllUserRefreshTokens(_ context.Context, userID string) error {
	m.revokeAllCalls = append(m.revokeAllCalls, userID)
	now := time.Now()
	for _, rec := range m.refreshByHash {
		if rec.UserID == userID && rec.RevokedAt == nil {
			rec.RevokedAt = &now
		}
	}
	return nil
}

func TestRegisterValidatesUsername(t *testing.T) {
	t.Setenv("JWT_SECRET", strings.Repeat("a", 32))
	service := NewService(&mockUserRepository{})

	_, err := service.Register(context.Background(), RegisterInput{
		Fullname: "Test User",
		Password: "Test1234",
		Username: "ab",
	}, SessionMeta{})

	assertFieldError(t, err, "username")

	_, err = service.Register(context.Background(), RegisterInput{
		Fullname: "Test User",
		Password: "Test1234",
		Username: "bad.name",
	}, SessionMeta{})

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
	}, SessionMeta{})
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
		}, SessionMeta{})
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
	}, SessionMeta{})

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
	}, SessionMeta{})
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
	}, SessionMeta{})
	if !errors.Is(err, ErrUsernameTaken) {
		t.Fatalf("expected ErrUsernameTaken, got %v", err)
	}

	_, err = NewService(&mockUserRepository{emailTaken: true}).Register(context.Background(), RegisterInput{
		Email:    "test@example.com",
		Fullname: "Test User",
		Password: "Test1234",
		Username: "testuser",
	}, SessionMeta{})
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
	}, SessionMeta{})
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

func TestRegisterIssuesRefreshToken(t *testing.T) {
	t.Setenv("JWT_SECRET", strings.Repeat("a", 32))
	repo := &mockUserRepository{}
	service := NewService(repo)

	result, err := service.Register(context.Background(), RegisterInput{
		Fullname: "Test User",
		Password: "Test1234",
		Username: "refreshuser",
	}, SessionMeta{})
	if err != nil {
		t.Fatalf("Register() error = %v", err)
	}
	if result.RefreshToken == "" {
		t.Fatal("expected refresh token in register result")
	}
	if len(repo.refreshByHash) != 1 {
		t.Fatalf("expected 1 persisted refresh token, got %d", len(repo.refreshByHash))
	}
	if _, ok := repo.refreshByHash[HashRefreshToken(result.RefreshToken)]; !ok {
		t.Fatal("expected persisted token hash to match returned raw token")
	}
}

func TestLoginIssuesRefreshToken(t *testing.T) {
	t.Setenv("JWT_SECRET", strings.Repeat("a", 32))
	repo := &mockUserRepository{stubUser: makeUserWithPassword(t, "Current1234")}
	service := NewService(repo)

	result, err := service.Login(context.Background(), LoginInput{
		Username: "tester",
		Password: "Current1234",
	}, SessionMeta{UserAgent: "ua", IP: "1.2.3.4"})
	if err != nil {
		t.Fatalf("Login() error = %v", err)
	}
	if result.Token == "" || result.RefreshToken == "" {
		t.Fatal("expected access and refresh tokens from login")
	}
	rec, ok := repo.refreshByHash[HashRefreshToken(result.RefreshToken)]
	if !ok {
		t.Fatal("expected refresh token persisted")
	}
	if rec.UserAgent != "ua" || rec.IP != "1.2.3.4" {
		t.Fatalf("expected session meta persisted, got ua=%q ip=%q", rec.UserAgent, rec.IP)
	}
}

func TestRefreshSessionRotatesToken(t *testing.T) {
	t.Setenv("JWT_SECRET", strings.Repeat("a", 32))
	repo := &mockUserRepository{stubUser: makeUserWithPassword(t, "Current1234")}
	service := NewService(repo)

	login, err := service.Login(context.Background(), LoginInput{
		Username: "tester",
		Password: "Current1234",
	}, SessionMeta{})
	if err != nil {
		t.Fatalf("Login() error = %v", err)
	}

	refreshed, err := service.RefreshSession(context.Background(), login.RefreshToken, SessionMeta{})
	if err != nil {
		t.Fatalf("RefreshSession() error = %v", err)
	}
	if refreshed.Token == "" {
		t.Fatal("expected new access token")
	}
	if refreshed.RefreshToken == login.RefreshToken {
		t.Fatal("expected rotated refresh token to differ from original")
	}

	// Old token must now be revoked and linked to its successor.
	old := repo.refreshByHash[HashRefreshToken(login.RefreshToken)]
	if old.RevokedAt == nil {
		t.Fatal("expected old refresh token to be revoked after rotation")
	}
	if old.ReplacedByTokenID == nil {
		t.Fatal("expected old token to link to its replacement")
	}

	// New token must be active and usable again.
	if _, err := service.RefreshSession(context.Background(), refreshed.RefreshToken, SessionMeta{}); err != nil {
		t.Fatalf("expected rotated token to be usable, got %v", err)
	}
}

func TestRefreshSessionRejectsReusedToken(t *testing.T) {
	t.Setenv("JWT_SECRET", strings.Repeat("a", 32))
	repo := &mockUserRepository{stubUser: makeUserWithPassword(t, "Current1234")}
	service := NewService(repo)

	login, err := service.Login(context.Background(), LoginInput{
		Username: "tester",
		Password: "Current1234",
	}, SessionMeta{})
	if err != nil {
		t.Fatalf("Login() error = %v", err)
	}

	// First rotation succeeds, revoking the original token.
	if _, err := service.RefreshSession(context.Background(), login.RefreshToken, SessionMeta{}); err != nil {
		t.Fatalf("first refresh error = %v", err)
	}

	// Reusing the now-revoked original token must fail and trigger family revoke.
	_, err = service.RefreshSession(context.Background(), login.RefreshToken, SessionMeta{})
	if !errors.Is(err, ErrInvalidRefreshToken) {
		t.Fatalf("expected ErrInvalidRefreshToken on reuse, got %v", err)
	}
	if len(repo.revokeAllCalls) == 0 {
		t.Fatal("expected reuse to revoke the whole token family")
	}
}

func TestRefreshSessionRejectsExpiredToken(t *testing.T) {
	t.Setenv("JWT_SECRET", strings.Repeat("a", 32))
	repo := &mockUserRepository{stubUser: makeUserWithPassword(t, "Current1234")}
	service := NewService(repo)

	login, err := service.Login(context.Background(), LoginInput{
		Username: "tester",
		Password: "Current1234",
	}, SessionMeta{})
	if err != nil {
		t.Fatalf("Login() error = %v", err)
	}

	// Force expiry in the stored record.
	rec := repo.refreshByHash[HashRefreshToken(login.RefreshToken)]
	rec.ExpiresAt = time.Now().Add(-time.Hour)

	_, err = service.RefreshSession(context.Background(), login.RefreshToken, SessionMeta{})
	if !errors.Is(err, ErrInvalidRefreshToken) {
		t.Fatalf("expected ErrInvalidRefreshToken for expired token, got %v", err)
	}
}

func TestRefreshSessionRejectsUnknownToken(t *testing.T) {
	t.Setenv("JWT_SECRET", strings.Repeat("a", 32))
	service := NewService(&mockUserRepository{})

	_, err := service.RefreshSession(context.Background(), "totally-unknown-token", SessionMeta{})
	if !errors.Is(err, ErrInvalidRefreshToken) {
		t.Fatalf("expected ErrInvalidRefreshToken for unknown token, got %v", err)
	}

	_, err = service.RefreshSession(context.Background(), "", SessionMeta{})
	if !errors.Is(err, ErrInvalidRefreshToken) {
		t.Fatalf("expected ErrInvalidRefreshToken for empty token, got %v", err)
	}
}

func TestLogoutRevokesRefreshToken(t *testing.T) {
	t.Setenv("JWT_SECRET", strings.Repeat("a", 32))
	repo := &mockUserRepository{stubUser: makeUserWithPassword(t, "Current1234")}
	service := NewService(repo)

	login, err := service.Login(context.Background(), LoginInput{
		Username: "tester",
		Password: "Current1234",
	}, SessionMeta{})
	if err != nil {
		t.Fatalf("Login() error = %v", err)
	}

	if err := service.Logout(context.Background(), login.RefreshToken); err != nil {
		t.Fatalf("Logout() error = %v", err)
	}

	rec := repo.refreshByHash[HashRefreshToken(login.RefreshToken)]
	if rec.RevokedAt == nil {
		t.Fatal("expected refresh token revoked after logout")
	}

	// The revoked token can no longer refresh.
	if _, err := service.RefreshSession(context.Background(), login.RefreshToken, SessionMeta{}); !errors.Is(err, ErrInvalidRefreshToken) {
		t.Fatalf("expected revoked token to fail refresh, got %v", err)
	}
}

func TestLogoutWithoutTokenIsNoop(t *testing.T) {
	service := NewService(&mockUserRepository{})
	if err := service.Logout(context.Background(), ""); err != nil {
		t.Fatalf("expected no error logging out without a token, got %v", err)
	}
}

func TestGenerateRefreshTokenIsRandomAndHashable(t *testing.T) {
	a, err := GenerateRefreshToken()
	if err != nil {
		t.Fatalf("GenerateRefreshToken() error = %v", err)
	}
	b, err := GenerateRefreshToken()
	if err != nil {
		t.Fatalf("GenerateRefreshToken() error = %v", err)
	}
	if a == b {
		t.Fatal("expected distinct refresh tokens")
	}
	if a == "" || len(a) < 32 {
		t.Fatalf("expected non-trivial token, got %q", a)
	}
	if HashRefreshToken(a) == a {
		t.Fatal("expected hash to differ from raw token")
	}
	if HashRefreshToken(a) != HashRefreshToken(a) {
		t.Fatal("expected hash to be deterministic")
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
