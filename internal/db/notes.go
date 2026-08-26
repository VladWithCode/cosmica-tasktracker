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

// NoteHistoryDay is the note count for a single local calendar day.
type NoteHistoryDay struct {
	Date  string `json:"date"`
	Total int    `json:"total"`
}

// NoteHistoryRange is the per-day note activity over an inclusive date range.
type NoteHistoryRange struct {
	From string           `json:"from"`
	To   string           `json:"to"`
	Days []NoteHistoryDay `json:"days"`
}

// GetNotesHistory returns the note count per day for the given user over the
// inclusive range [from, to]. Days without notes are omitted. Days are bucketed
// with the same DATE(created_at) expression GetNotesByDate filters on, so a
// day's count always matches the notes that day's listing returns.
func GetNotesHistory(ctx context.Context, userID string, from time.Time, to time.Time) (*NoteHistoryRange, error) {
	conn, err := GetConn(ctx)
	if err != nil {
		return nil, err
	}
	defer conn.Release()

	rows, err := conn.Query(ctx,
		`SELECT DATE(created_at) AS day, COUNT(*) AS total
		 FROM notes
		 WHERE user_id = $1
		   AND DATE(created_at) BETWEEN $2::date AND $3::date
		 GROUP BY DATE(created_at)
		 ORDER BY day ASC`,
		userID, from, to,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	history := &NoteHistoryRange{
		From: from.Format("2006-01-02"),
		To:   to.Format("2006-01-02"),
		Days: []NoteHistoryDay{},
	}
	for rows.Next() {
		var day time.Time
		var total int
		if err := rows.Scan(&day, &total); err != nil {
			return nil, err
		}
		history.Days = append(history.Days, NoteHistoryDay{
			Date:  day.Format("2006-01-02"),
			Total: total,
		})
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return history, nil
}

// GetNoteByID fetches a single note owned by userID.
// Returns ErrNoteNotFound if missing or owner mismatch.
func GetNoteByID(ctx context.Context, noteID string, userID string) (*Note, error) {
	conn, err := GetConn(ctx)
	if err != nil {
		return nil, err
	}
	defer conn.Release()

	var n Note
	err = conn.QueryRow(ctx,
		`SELECT id, user_id, content, created_at, updated_at
		 FROM notes
		 WHERE id = $1 AND user_id = $2`,
		noteID, userID,
	).Scan(&n.ID, &n.UserID, &n.Content, &n.CreatedAt, &n.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNoteNotFound
		}
		return nil, err
	}
	return &n, nil
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
