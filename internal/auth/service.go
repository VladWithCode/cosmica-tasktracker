package auth

import (
	"context"
	"errors"
	"net/mail"
	"regexp"
	"strings"
	"time"
	"unicode"

	"github.com/google/uuid"
	"github.com/vladwithcode/tasktracker/internal/db"
	"golang.org/x/crypto/bcrypt"
)

var ErrInvalidCredentials = errors.New("invalid credentials")
var ErrUsernameTaken = errors.New("username taken")
var ErrEmailTaken = errors.New("email taken")
var ErrWrongCurrentPassword = errors.New("current password is incorrect")
var ErrInvalidRefreshToken = errors.New("invalid refresh token")

// SessionMeta carries optional context about the client opening a session.
type SessionMeta struct {
	UserAgent string
	IP        string
}

var usernamePattern = regexp.MustCompile(`^[a-z0-9_-]{3,32}$`)

type LoginInput struct {
	Password string
	Username string
}

type LoginResult struct {
	Token        string
	RefreshToken string
	User         *db.User
}

type RefreshResult struct {
	Token        string
	RefreshToken string
	User         *db.User
}

type RegisterInput struct {
	Email    string
	Fullname string
	Password string
	Username string
}

type RegisterResult struct {
	Token        string
	RefreshToken string
	User         *db.User
}

type FieldErrors map[string]string

type ValidationError struct {
	Fields  FieldErrors
	Message string
}

func (e *ValidationError) Error() string {
	return e.Message
}

type Service struct {
	repo UserRepository
}

func NewService(repo UserRepository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Login(ctx context.Context, input LoginInput, meta SessionMeta) (*LoginResult, error) {
	user, err := s.repo.GetByUsername(ctx, input.Username)
	if err != nil {
		return nil, ErrInvalidCredentials
	}

	if err := user.ValidatePass(input.Password); err != nil {
		return nil, ErrInvalidCredentials
	}

	token, err := CreateToken(user)
	if err != nil {
		return nil, err
	}

	refreshRaw, _, err := s.issueRefreshToken(ctx, user.ID, meta)
	if err != nil {
		return nil, err
	}

	return &LoginResult{
		Token:        token,
		RefreshToken: refreshRaw,
		User:         user,
	}, nil
}

// issueRefreshToken generates a new opaque refresh token, persists its hash and
// returns the raw token plus the stored record.
func (s *Service) issueRefreshToken(ctx context.Context, userID string, meta SessionMeta) (string, *db.RefreshToken, error) {
	raw, err := GenerateRefreshToken()
	if err != nil {
		return "", nil, err
	}

	rec := &db.RefreshToken{
		ID:        uuid.NewString(),
		UserID:    userID,
		TokenHash: HashRefreshToken(raw),
		ExpiresAt: time.Now().Add(RefreshTokenTTL),
		UserAgent: meta.UserAgent,
		IP:        meta.IP,
	}
	if err := s.repo.InsertRefreshToken(ctx, rec); err != nil {
		return "", nil, err
	}

	return raw, rec, nil
}

// RefreshSession validates a raw refresh token, rotates it (revoking the old
// token and issuing a new one linked as its successor) and returns a fresh
// access token. A revoked token presented again is treated as reuse/compromise
// and revokes the entire token family for that user.
func (s *Service) RefreshSession(ctx context.Context, rawRefresh string, meta SessionMeta) (*RefreshResult, error) {
	if strings.TrimSpace(rawRefresh) == "" {
		return nil, ErrInvalidRefreshToken
	}

	rec, err := s.repo.GetRefreshTokenByHash(ctx, HashRefreshToken(rawRefresh))
	if err != nil {
		return nil, ErrInvalidRefreshToken
	}

	now := time.Now()

	// Reuse detection: a previously revoked token is being presented again.
	// Treat as compromise and revoke every active token for the user.
	if rec.RevokedAt != nil {
		_ = s.repo.RevokeAllUserRefreshTokens(ctx, rec.UserID)
		return nil, ErrInvalidRefreshToken
	}

	if !now.Before(rec.ExpiresAt) {
		return nil, ErrInvalidRefreshToken
	}

	user, err := s.repo.GetByID(ctx, rec.UserID)
	if err != nil {
		return nil, ErrInvalidRefreshToken
	}

	// Rotate: issue the successor first, then revoke the old token linking it
	// to its replacement.
	newRaw, newRec, err := s.issueRefreshToken(ctx, rec.UserID, meta)
	if err != nil {
		return nil, err
	}
	if err := s.repo.RevokeRefreshToken(ctx, rec.ID, newRec.ID); err != nil {
		return nil, err
	}

	token, err := CreateToken(user)
	if err != nil {
		return nil, err
	}

	return &RefreshResult{
		Token:        token,
		RefreshToken: newRaw,
		User:         user,
	}, nil
}

// Logout revokes the refresh token represented by rawRefresh, if it exists. A
// missing or unknown token is not an error: logout is idempotent.
func (s *Service) Logout(ctx context.Context, rawRefresh string) error {
	if strings.TrimSpace(rawRefresh) == "" {
		return nil
	}

	rec, err := s.repo.GetRefreshTokenByHash(ctx, HashRefreshToken(rawRefresh))
	if err != nil {
		return nil
	}

	return s.repo.RevokeRefreshToken(ctx, rec.ID, "")
}

func (s *Service) Register(ctx context.Context, input RegisterInput, meta SessionMeta) (*RegisterResult, error) {
	normalized := normalizeRegisterInput(input)

	if fields := validateRegisterInput(normalized); len(fields) > 0 {
		return nil, &ValidationError{
			Fields:  fields,
			Message: "Revisa los campos del formulario",
		}
	}

	usernameTaken, err := s.repo.IsUsernameTaken(ctx, normalized.Username)
	if err != nil {
		return nil, err
	}
	if usernameTaken {
		return nil, ErrUsernameTaken
	}

	emailTaken, err := s.repo.IsEmailTaken(ctx, normalized.Email)
	if err != nil {
		return nil, err
	}
	if emailTaken {
		return nil, ErrEmailTaken
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(normalized.Password), db.BcryptCost)
	if err != nil {
		return nil, err
	}

	user := &db.User{
		ID:       uuid.NewString(),
		Fullname: normalized.Fullname,
		Password: string(hashedPassword),
		Username: normalized.Username,
		Role:     db.RoleUser,
		Email:    normalized.Email,
	}

	if err := s.repo.CreateUser(ctx, user); err != nil {
		return nil, err
	}

	token, err := CreateToken(user)
	if err != nil {
		return nil, err
	}

	refreshRaw, _, err := s.issueRefreshToken(ctx, user.ID, meta)
	if err != nil {
		return nil, err
	}

	return &RegisterResult{
		Token:        token,
		RefreshToken: refreshRaw,
		User:         user,
	}, nil
}

type ChangePasswordInput struct {
	CurrentPassword string
	NewPassword     string
	UserID          string
}

func (s *Service) ChangePassword(ctx context.Context, input ChangePasswordInput) error {
	user, err := s.repo.GetByID(ctx, input.UserID)
	if err != nil {
		return ErrInvalidCredentials
	}

	if err := user.ValidatePass(input.CurrentPassword); err != nil {
		return ErrWrongCurrentPassword
	}

	fields := validatePassword(input.NewPassword)
	if len(fields) > 0 {
		return &ValidationError{Fields: fields, Message: "La nueva contraseña es inválida"}
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(input.NewPassword), db.BcryptCost)
	if err != nil {
		return err
	}

	return s.repo.UpdatePassword(ctx, input.UserID, string(hashedPassword))
}

func validatePassword(password string) FieldErrors {
	fields := FieldErrors{}
	n := len(password)
	if n == 0 {
		fields["password"] = "La contraseña es requerida"
	} else if n < 8 {
		fields["password"] = "La contraseña debe tener al menos 8 caracteres"
	} else if n > 128 {
		fields["password"] = "La contraseña no puede pasar de 128 caracteres"
	} else if !hasLetterAndNumber(password) {
		fields["password"] = "La contraseña debe incluir al menos una letra y un número"
	}
	return fields
}

func normalizeRegisterInput(input RegisterInput) RegisterInput {
	return RegisterInput{
		Email:    strings.ToLower(strings.TrimSpace(input.Email)),
		Fullname: strings.TrimSpace(input.Fullname),
		Password: input.Password,
		Username: strings.ToLower(strings.TrimSpace(input.Username)),
	}
}

func validateRegisterInput(input RegisterInput) FieldErrors {
	fields := FieldErrors{}

	if input.Username == "" {
		fields["username"] = "El usuario es requerido"
	} else if !usernamePattern.MatchString(input.Username) {
		fields["username"] = "Usa 3-32 caracteres: a-z, 0-9, _ o -"
	}

	passwordLength := len(input.Password)
	if input.Password == "" {
		fields["password"] = "La contraseña es requerida"
	} else if passwordLength < 8 {
		fields["password"] = "La contraseña debe tener al menos 8 caracteres"
	} else if passwordLength > 128 {
		fields["password"] = "La contraseña no puede pasar de 128 caracteres"
	} else if !hasLetterAndNumber(input.Password) {
		fields["password"] = "La contraseña debe incluir al menos una letra y un número"
	}

	fullnameLength := len([]rune(input.Fullname))
	if input.Fullname == "" {
		fields["fullname"] = "El nombre completo es requerido"
	} else if fullnameLength < 2 || fullnameLength > 80 {
		fields["fullname"] = "El nombre debe tener entre 2 y 80 caracteres"
	}

	if input.Email != "" {
		address, err := mail.ParseAddress(input.Email)
		if err != nil || strings.ToLower(address.Address) != input.Email {
			fields["email"] = "Ingresa un correo válido"
		}
	}

	return fields
}

func hasLetterAndNumber(value string) bool {
	var hasLetter bool
	var hasNumber bool

	for _, char := range value {
		if unicode.IsLetter(char) {
			hasLetter = true
		}
		if unicode.IsNumber(char) {
			hasNumber = true
		}
	}

	return hasLetter && hasNumber
}
