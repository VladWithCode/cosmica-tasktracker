package db

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"golang.org/x/crypto/bcrypt"
)

type User struct {
	ID       string `db:"id" json:"id"`
	Fullname string `db:"fullname" json:"fullname" binding:"required"`
	Password string `db:"password" json:"password" binding:"required"`
	Username string `db:"username" json:"username" binding:"required"`
	Role     string `db:"role" json:"role"`
	Email    string `db:"email" json:"email,omitempty"`

	CreatedAt time.Time `db:"created_at" json:"createdAt,omitzero"`
	UpdatedAt time.Time `db:"updated_at" json:"updatedAt,omitzero"`
}

// ValidatePass compares the provided string against the user's password
// returns an error if the passwords don't match
// returns nil otherwise
func (u *User) ValidatePass(pw string) error {
	return bcrypt.CompareHashAndPassword([]byte(u.Password), []byte(pw))
}

// HashPass hashes the provided password
// and updates the user's password to the hashed value
func (u *User) HashPass(pw string) error {
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(pw), BcryptCost)

	if err != nil {
		return err
	}

	u.Password = string(hashedPassword)

	return nil
}

const (
	BcryptCost     int    = 12
	RoleSuperAdmin string = "superadmin"
	RoleAdmin      string = "admin"
	RoleUser       string = "user"
)

func CreateUser(ctx context.Context, user *User) error {
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(user.Password), BcryptCost)

	if err != nil {
		return err
	}

	userCopy := *user
	userCopy.Password = string(hashedPassword)

	return InsertUser(ctx, &userCopy)
}

func InsertUser(ctx context.Context, user *User) error {
	conn, err := GetConn(ctx)
	if err != nil {
		return err
	}
	defer conn.Release()
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	_, err = conn.Exec(
		ctx,
		"INSERT INTO users (id, fullname, password, username, role, email) VALUES ($1, $2, $3, $4, $5, $6)",
		user.ID,
		user.Fullname,
		user.Password,
		user.Username,
		user.Role,
		nullableText(user.Email),
	)

	return err
}

func GetUserByID(ctx context.Context, id string) (*User, error) {
	conn, err := GetConn(ctx)
	if err != nil {
		return nil, err
	}
	defer conn.Release()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	row := conn.QueryRow(
		ctx,
		"SELECT id, fullname, password, username, role, email FROM users WHERE id = $1",
		id,
	)
	return scanUser(row)
}

func GetUserByUsername(ctx context.Context, username string) (*User, error) {
	conn, err := GetConn(ctx)
	if err != nil {
		return nil, err
	}
	defer conn.Release()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	row := conn.QueryRow(
		ctx,
		"SELECT id, fullname, password, username, role, email FROM users WHERE username = $1",
		username,
	)
	return scanUser(row)
}

func UserExistsByUsername(ctx context.Context, username string) (bool, error) {
	conn, err := GetConn(ctx)
	if err != nil {
		return false, err
	}
	defer conn.Release()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	var exists bool
	err = conn.QueryRow(
		ctx,
		"SELECT EXISTS (SELECT 1 FROM users WHERE LOWER(username) = LOWER($1))",
		username,
	).Scan(&exists)

	return exists, err
}

func UserExistsByEmail(ctx context.Context, email string) (bool, error) {
	if strings.TrimSpace(email) == "" {
		return false, nil
	}

	conn, err := GetConn(ctx)
	if err != nil {
		return false, err
	}
	defer conn.Release()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	var exists bool
	err = conn.QueryRow(
		ctx,
		"SELECT EXISTS (SELECT 1 FROM users WHERE email IS NOT NULL AND email <> '' AND LOWER(email) = LOWER($1))",
		email,
	).Scan(&exists)

	return exists, err
}

func UpdateUser(ctx context.Context, user *User) error {
	conn, err := GetConn(ctx)
	if err != nil {
		return err
	}
	defer conn.Release()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	_, err = conn.Exec(
		ctx,
		"UPDATE users SET fullname = $1, password = $2, username = $3, role = $4, email = $5 WHERE id = $6",
		user.Fullname,
		user.Password,
		user.Username,
		user.Role,
		nullableText(user.Email),
		user.ID,
	)

	if err != nil {
		return err
	}

	return nil
}

func TxVerifyUserEmail(ctx context.Context, tx pgx.Tx, userID string) error {
	tag, err := tx.Exec(
		ctx,
		"UPDATE users SET email_verified = TRUE WHERE id = $1",
		userID,
	)

	if err != nil {
		return err
	}

	if tag.RowsAffected() == 0 {
		return fmt.Errorf("no se encontró usuario con id %v", userID)
	}

	return nil
}

func VerifyUserEmail(ctx context.Context, userID string) error {
	conn, err := GetConn(ctx)
	if err != nil {
		return err
	}
	defer conn.Release()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	tag, err := conn.Exec(
		ctx,
		"UPDATE users SET email_verified = TRUE WHERE id = $1",
		userID,
	)

	if err != nil {
		return err
	}

	if tag.RowsAffected() == 0 {
		return fmt.Errorf("no se encontró usuario con id %v", userID)
	}

	return nil
}

func DeleteUser(ctx context.Context, userID string) error {
	conn, err := GetConn(ctx)
	if err != nil {
		return err
	}
	defer conn.Release()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	_, err = conn.Exec(ctx, `DELETE FROM users WHERE id = $1`, userID)

	return err
}

func nullableText(value string) interface{} {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}

	return trimmed
}

func scanUser(row pgx.Row) (*User, error) {
	var user User
	var email pgtype.Text

	err := row.Scan(
		&user.ID,
		&user.Fullname,
		&user.Password,
		&user.Username,
		&user.Role,
		&email,
	)

	if err != nil {
		return nil, err
	}

	if email.Valid {
		user.Email = email.String
	}

	return &user, nil
}
