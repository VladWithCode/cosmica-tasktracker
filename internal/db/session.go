package db

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

// RefreshToken is a persisted opaque refresh-token session. The raw token is
// never stored; only its hash lives in TokenHash. Rotation links an old token
// to its successor through ReplacedByTokenID so that reuse of a rotated token
// can be detected.
type RefreshToken struct {
	ID                string
	UserID            string
	TokenHash         string
	ExpiresAt         time.Time
	RevokedAt         *time.Time
	ReplacedByTokenID *string
	CreatedAt         time.Time
	UserAgent         string
	IP                string
}

// IsActive reports whether the token can still be used: not revoked and not
// past its expiry.
func (t *RefreshToken) IsActive(now time.Time) bool {
	if t.RevokedAt != nil {
		return false
	}
	return now.Before(t.ExpiresAt)
}

// InsertRefreshToken persists a new refresh-token session.
func InsertRefreshToken(ctx context.Context, token *RefreshToken) error {
	conn, err := GetConn(ctx)
	if err != nil {
		return err
	}
	defer conn.Release()

	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	_, err = conn.Exec(
		ctx,
		`INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, user_agent, ip)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		token.ID,
		token.UserID,
		token.TokenHash,
		token.ExpiresAt,
		nullableText(token.UserAgent),
		nullableText(token.IP),
	)
	return err
}

// GetRefreshTokenByHash returns the refresh token matching the given hash, or
// pgx.ErrNoRows when none exists.
func GetRefreshTokenByHash(ctx context.Context, tokenHash string) (*RefreshToken, error) {
	conn, err := GetConn(ctx)
	if err != nil {
		return nil, err
	}
	defer conn.Release()

	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	row := conn.QueryRow(
		ctx,
		`SELECT id, user_id, token_hash, expires_at, revoked_at, replaced_by_token_id, created_at, user_agent, ip
		 FROM refresh_tokens WHERE token_hash = $1`,
		tokenHash,
	)
	return scanRefreshToken(row)
}

// RevokeRefreshToken marks a token revoked and optionally records the successor
// that replaced it. Passing an empty replacedByID leaves the link NULL.
func RevokeRefreshToken(ctx context.Context, id string, replacedByID string) error {
	conn, err := GetConn(ctx)
	if err != nil {
		return err
	}
	defer conn.Release()

	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	_, err = conn.Exec(
		ctx,
		`UPDATE refresh_tokens
		 SET revoked_at = COALESCE(revoked_at, now()), replaced_by_token_id = $2
		 WHERE id = $1`,
		id,
		nullableText(replacedByID),
	)
	return err
}

// RevokeAllUserRefreshTokens revokes every still-active token for a user. Used
// for reuse detection (revoke the whole family) and as a hard logout-all.
func RevokeAllUserRefreshTokens(ctx context.Context, userID string) error {
	conn, err := GetConn(ctx)
	if err != nil {
		return err
	}
	defer conn.Release()

	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	_, err = conn.Exec(
		ctx,
		`UPDATE refresh_tokens
		 SET revoked_at = now()
		 WHERE user_id = $1 AND revoked_at IS NULL`,
		userID,
	)
	return err
}

func scanRefreshToken(row pgx.Row) (*RefreshToken, error) {
	var (
		token      RefreshToken
		revokedAt  pgtype.Timestamptz
		replacedBy pgtype.Text
		userAgent  pgtype.Text
		ip         pgtype.Text
	)

	err := row.Scan(
		&token.ID,
		&token.UserID,
		&token.TokenHash,
		&token.ExpiresAt,
		&revokedAt,
		&replacedBy,
		&token.CreatedAt,
		&userAgent,
		&ip,
	)
	if err != nil {
		return nil, err
	}

	if revokedAt.Valid {
		t := revokedAt.Time
		token.RevokedAt = &t
	}
	if replacedBy.Valid {
		token.ReplacedByTokenID = &replacedBy.String
	}
	if userAgent.Valid {
		token.UserAgent = userAgent.String
	}
	if ip.Valid {
		token.IP = ip.String
	}

	return &token, nil
}
