package auth

import (
	"context"
	"errors"
	"net/mail"
	"regexp"
	"strings"
	"unicode"

	"github.com/google/uuid"
	"github.com/vladwithcode/tasktracker/internal/db"
	"golang.org/x/crypto/bcrypt"
)

var ErrInvalidCredentials = errors.New("invalid credentials")
var ErrUsernameTaken = errors.New("username taken")
var ErrEmailTaken = errors.New("email taken")
var ErrWrongCurrentPassword = errors.New("current password is incorrect")

var usernamePattern = regexp.MustCompile(`^[a-z0-9_-]{3,32}$`)

type LoginInput struct {
	Password string
	Username string
}

type LoginResult struct {
	Token string
	User  *db.User
}

type RegisterInput struct {
	Email    string
	Fullname string
	Password string
	Username string
}

type RegisterResult struct {
	Token string
	User  *db.User
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

func (s *Service) Login(ctx context.Context, input LoginInput) (*LoginResult, error) {
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

	return &LoginResult{
		Token: token,
		User:  user,
	}, nil
}

func (s *Service) Register(ctx context.Context, input RegisterInput) (*RegisterResult, error) {
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

	return &RegisterResult{
		Token: token,
		User:  user,
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
