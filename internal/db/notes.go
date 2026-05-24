package db

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

// Note represents a user-scoped text note.
type Note struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

var (
	// ErrNoteNotFound is returned when a note doesn't exist or isn't owned by the user.
	ErrNoteNotFound = errors.New("note not found")
	// ErrNoteContentEmpty is returned when note content is empty/whitespace.
	ErrNoteContentEmpty = errors.New("note content cannot be empty")
)

// GetNotesByDate returns all notes for the given user whose created_at falls
// within the provided local date (truncated to day). Results ordered created_at DESC.
func GetNotesByDate(ctx context.Context, userID string, date time.Time) ([]Note, error) {
	conn, err := GetConn(ctx)
	if err != nil {
		return nil, err
	}
	defer conn.Release()

	rows, err := conn.Query(ctx,
		`SELECT id, user_id, content, created_at, updated_at
		 FROM notes
		 WHERE user_id = $1
		   AND DATE(created_at) = DATE($2::timestamptz)
		 ORDER BY created_at DESC`,
		userID, date,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	notes := []Note{}
	for rows.Next() {
		var n Note
		if err := rows.Scan(&n.ID, &n.UserID, &n.Content, &n.CreatedAt, &n.UpdatedAt); err != nil {
			return nil, err
		}
		notes = append(notes, n)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return notes, nil
}

// CreateNote inserts a new note for the user. Content is trimmed; empty rejected.
func CreateNote(ctx context.Context, userID string, content string) (*Note, error) {
	trimmed := strings.TrimSpace(content)
	if trimmed == "" {
		return nil, ErrNoteContentEmpty
	}

	conn, err := GetConn(ctx)
	if err != nil {
		return nil, err
	}
	defer conn.Release()

	var n Note
	err = conn.QueryRow(ctx,
		`INSERT INTO notes (user_id, content)
		 VALUES ($1, $2)
		 RETURNING id, user_id, content, created_at, updated_at`,
		userID, trimmed,
	).Scan(&n.ID, &n.UserID, &n.Content, &n.CreatedAt, &n.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &n, nil
}

// UpdateNote updates the content of a note. Caller must own the note.
// Returns ErrNoteNotFound if note doesn't exist or owner mismatch.
func UpdateNote(ctx context.Context, noteID string, userID string, content string) (*Note, error) {
	trimmed := strings.TrimSpace(content)
	if trimmed == "" {
		return nil, ErrNoteContentEmpty
	}

	conn, err := GetConn(ctx)
	if err != nil {
		return nil, err
	}
	defer conn.Release()

	var n Note
	err = conn.QueryRow(ctx,
		`UPDATE notes
		 SET content = $1
		 WHERE id = $2 AND user_id = $3
		 RETURNING id, user_id, content, created_at, updated_at`,
		trimmed, noteID, userID,
	).Scan(&n.ID, &n.UserID, &n.Content, &n.CreatedAt, &n.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNoteNotFound
		}
		return nil, err
	}
	return &n, nil
}

// DeleteNote deletes a note. Caller must own it.
// Returns ErrNoteNotFound if note missing or owner mismatch.
func DeleteNote(ctx context.Context, noteID string, userID string) error {
	conn, err := GetConn(ctx)
	if err != nil {
		return err
	}
	defer conn.Release()

	cmd, err := conn.Exec(ctx,
		`DELETE FROM notes WHERE id = $1 AND user_id = $2`,
		noteID, userID,
	)
	if err != nil {
		return err
	}
	if cmd.RowsAffected() == 0 {
		return ErrNoteNotFound
	}
	return nil
}
