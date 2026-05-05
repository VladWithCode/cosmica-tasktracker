package db

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type SharingAccessLevel string

const (
	SharingAccessLevelView     SharingAccessLevel = "view"
	SharingAccessLevelManage   SharingAccessLevel = "manage"
	SharingAccessLevelPingOnly SharingAccessLevel = "ping_only"
)

const (
	SharingPermissionView   = "view"
	SharingPermissionCreate = "create"
	SharingPermissionPing   = "ping"
)

var ErrInvalidSharingAccessLevel = errors.New("invalid sharing access level")

type SharingUser struct {
	ID       string `json:"id"`
	Username string `json:"username"`
	Fullname string `json:"fullname"`
	Email    string `json:"email,omitempty"`
}

type TaskAccessGrant struct {
	ID              string             `json:"id"`
	OwnerUserID     string             `json:"owner_user_id"`
	GranteeUserID   string             `json:"grantee_user_id"`
	AccessLevel     SharingAccessLevel `json:"access_level"`
	CanView         bool               `json:"can_view"`
	CanCreate       bool               `json:"can_create"`
	CanPing         bool               `json:"can_ping"`
	OwnerUsername   string             `json:"owner_username,omitempty"`
	OwnerFullname   string             `json:"owner_fullname,omitempty"`
	OwnerEmail      string             `json:"owner_email,omitempty"`
	GranteeUsername string             `json:"grantee_username,omitempty"`
	GranteeFullname string             `json:"grantee_fullname,omitempty"`
	GranteeEmail    string             `json:"grantee_email,omitempty"`
	CreatedAt       time.Time          `json:"created_at"`
	UpdatedAt       time.Time          `json:"updated_at"`
	RevokedAt       *time.Time         `json:"revoked_at,omitempty"`
}

type TaskPing struct {
	ID               string    `json:"id"`
	TaskID           string    `json:"task_id"`
	SenderUserID     string    `json:"sender_user_id"`
	RecipientUserID  string    `json:"recipient_user_id"`
	Message          string    `json:"message,omitempty"`
	NotificationSent bool      `json:"notification_sent"`
	CreatedAt        time.Time `json:"created_at"`
}

func NormalizeSharingAccessLevel(value string) (SharingAccessLevel, error) {
	switch SharingAccessLevel(strings.TrimSpace(value)) {
	case SharingAccessLevelView:
		return SharingAccessLevelView, nil
	case SharingAccessLevelManage:
		return SharingAccessLevelManage, nil
	case SharingAccessLevelPingOnly:
		return SharingAccessLevelPingOnly, nil
	default:
		return "", ErrInvalidSharingAccessLevel
	}
}

func ApplySharingAccessLevel(grant *TaskAccessGrant) {
	switch grant.AccessLevel {
	case SharingAccessLevelManage:
		grant.CanView = true
		grant.CanCreate = true
		grant.CanPing = true
	case SharingAccessLevelPingOnly:
		grant.CanView = false
		grant.CanCreate = false
		grant.CanPing = true
	case SharingAccessLevelView:
		grant.CanView = true
		grant.CanCreate = false
		grant.CanPing = false
	}
}

func SearchSharingUsers(ctx context.Context, actorUserID string, query string, limit int) ([]SharingUser, error) {
	conn, err := GetConn(ctx)
	if err != nil {
		return nil, err
	}
	defer conn.Release()

	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	if limit <= 0 || limit > 20 {
		limit = 10
	}
	search := "%" + strings.ToLower(strings.TrimSpace(query)) + "%"
	rows, err := conn.Query(
		ctx,
		`SELECT id, username, fullname, email
		 FROM users
		 WHERE id <> $1
		   AND (
			 LOWER(username) LIKE $2
			 OR LOWER(fullname) LIKE $2
			 OR (email IS NOT NULL AND LOWER(email) LIKE $2)
		   )
		 ORDER BY username ASC
		 LIMIT $3`,
		actorUserID,
		search,
		limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	users := []SharingUser{}
	for rows.Next() {
		var user SharingUser
		var email sql.NullString
		if err := rows.Scan(&user.ID, &user.Username, &user.Fullname, &email); err != nil {
			return nil, err
		}
		if email.Valid {
			user.Email = email.String
		}
		users = append(users, user)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return users, nil
}

func GetUserByUsernameOrEmail(ctx context.Context, identifier string) (*User, error) {
	conn, err := GetConn(ctx)
	if err != nil {
		return nil, err
	}
	defer conn.Release()

	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	normalized := strings.ToLower(strings.TrimSpace(identifier))
	row := conn.QueryRow(
		ctx,
		`SELECT id, fullname, password, username, role, email
		 FROM users
		 WHERE LOWER(username) = $1
		    OR (email IS NOT NULL AND LOWER(email) = $1)`,
		normalized,
	)
	return scanUser(row)
}

func GetActiveTaskAccessGrantByPair(ctx context.Context, ownerUserID string, granteeUserID string) (*TaskAccessGrant, error) {
	conn, err := GetConn(ctx)
	if err != nil {
		return nil, err
	}
	defer conn.Release()

	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	row := conn.QueryRow(ctx, taskAccessGrantSelectSQL()+`
		WHERE g.owner_user_id = $1 AND g.grantee_user_id = $2 AND g.revoked_at IS NULL`,
		ownerUserID,
		granteeUserID,
	)
	return scanTaskAccessGrant(row)
}

func CreateTaskAccessGrant(ctx context.Context, grant *TaskAccessGrant) error {
	conn, err := GetConn(ctx)
	if err != nil {
		return err
	}
	defer conn.Release()

	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	if grant.ID == "" {
		grant.ID = uuid.Must(uuid.NewV7()).String()
	}
	ApplySharingAccessLevel(grant)
	_, err = conn.Exec(
		ctx,
		`INSERT INTO task_access_grants (
			id, owner_user_id, grantee_user_id, access_level, can_view, can_create, can_ping
		) VALUES (
			@id, @ownerUserID, @granteeUserID, @accessLevel, @canView, @canCreate, @canPing
		)`,
		pgx.NamedArgs{
			"id":            grant.ID,
			"ownerUserID":   grant.OwnerUserID,
			"granteeUserID": grant.GranteeUserID,
			"accessLevel":   grant.AccessLevel,
			"canView":       grant.CanView,
			"canCreate":     grant.CanCreate,
			"canPing":       grant.CanPing,
		},
	)
	return err
}

func ListTaskAccessGrantsByOwner(ctx context.Context, ownerUserID string) ([]*TaskAccessGrant, error) {
	return listTaskAccessGrants(ctx, `g.owner_user_id = $1 AND g.revoked_at IS NULL`, ownerUserID)
}

func ListTaskAccessGrantsForGrantee(ctx context.Context, granteeUserID string) ([]*TaskAccessGrant, error) {
	return listTaskAccessGrants(ctx, `g.grantee_user_id = $1 AND g.revoked_at IS NULL`, granteeUserID)
}

func listTaskAccessGrants(ctx context.Context, where string, userID string) ([]*TaskAccessGrant, error) {
	conn, err := GetConn(ctx)
	if err != nil {
		return nil, err
	}
	defer conn.Release()

	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	rows, err := conn.Query(
		ctx,
		taskAccessGrantSelectSQL()+` WHERE `+where+` ORDER BY g.created_at DESC`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	grants := []*TaskAccessGrant{}
	for rows.Next() {
		grant, err := scanTaskAccessGrant(rows)
		if err != nil {
			return nil, err
		}
		grants = append(grants, grant)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return grants, nil
}

func RevokeTaskAccessGrant(ctx context.Context, ownerUserID string, grantID string) (bool, error) {
	conn, err := GetConn(ctx)
	if err != nil {
		return false, err
	}
	defer conn.Release()

	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	tag, err := conn.Exec(
		ctx,
		`UPDATE task_access_grants
		 SET revoked_at = CURRENT_TIMESTAMP
		 WHERE id = $1 AND owner_user_id = $2 AND revoked_at IS NULL`,
		grantID,
		ownerUserID,
	)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() > 0, nil
}

func UserHasTaskPermission(ctx context.Context, ownerUserID string, granteeUserID string, permission string) (bool, error) {
	if ownerUserID == granteeUserID {
		return true, nil
	}

	conn, err := GetConn(ctx)
	if err != nil {
		return false, err
	}
	defer conn.Release()

	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	var allowed bool
	err = conn.QueryRow(
		ctx,
		`SELECT EXISTS (
			SELECT 1
			FROM task_access_grants
			WHERE owner_user_id = $1
			  AND grantee_user_id = $2
			  AND revoked_at IS NULL
			  AND CASE $3
				WHEN 'view' THEN can_view
				WHEN 'create' THEN can_create
				WHEN 'ping' THEN can_ping
				ELSE FALSE
			  END
		)`,
		ownerUserID,
		granteeUserID,
		permission,
	).Scan(&allowed)
	return allowed, err
}

func RecentTaskPingExists(ctx context.Context, taskID string, senderUserID string, recipientUserID string, since time.Time) (bool, error) {
	conn, err := GetConn(ctx)
	if err != nil {
		return false, err
	}
	defer conn.Release()

	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	var exists bool
	err = conn.QueryRow(
		ctx,
		`SELECT EXISTS (
			SELECT 1
			FROM task_pings
			WHERE task_id = $1
			  AND sender_user_id = $2
			  AND recipient_user_id = $3
			  AND created_at >= $4
		)`,
		taskID,
		senderUserID,
		recipientUserID,
		since,
	).Scan(&exists)
	return exists, err
}

func CreateTaskPing(ctx context.Context, ping *TaskPing) error {
	conn, err := GetConn(ctx)
	if err != nil {
		return err
	}
	defer conn.Release()

	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	if ping.ID == "" {
		ping.ID = uuid.Must(uuid.NewV7()).String()
	}
	if ping.CreatedAt.IsZero() {
		ping.CreatedAt = time.Now()
	}
	_, err = conn.Exec(
		ctx,
		`INSERT INTO task_pings (
			id, task_id, sender_user_id, recipient_user_id, message, notification_sent, created_at
		) VALUES (
			@id, @taskID, @senderUserID, @recipientUserID, @message, @notificationSent, @createdAt
		)`,
		pgx.NamedArgs{
			"id":               ping.ID,
			"taskID":           ping.TaskID,
			"senderUserID":     ping.SenderUserID,
			"recipientUserID":  ping.RecipientUserID,
			"message":          nullableString(ping.Message),
			"notificationSent": ping.NotificationSent,
			"createdAt":        ping.CreatedAt,
		},
	)
	return err
}

func CountTaskPings(ctx context.Context, taskID string, senderUserID string) (int, error) {
	conn, err := GetConn(ctx)
	if err != nil {
		return 0, err
	}
	defer conn.Release()

	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	var count int
	err = conn.QueryRow(
		ctx,
		`SELECT COUNT(*)
		 FROM task_pings
		 WHERE task_id = $1 AND sender_user_id = $2`,
		taskID,
		senderUserID,
	).Scan(&count)
	return count, err
}

func taskAccessGrantSelectSQL() string {
	return `SELECT
		g.id,
		g.owner_user_id,
		g.grantee_user_id,
		g.access_level,
		g.can_view,
		g.can_create,
		g.can_ping,
		owner.username,
		owner.fullname,
		owner.email,
		grantee.username,
		grantee.fullname,
		grantee.email,
		g.created_at,
		g.updated_at,
		g.revoked_at
	FROM task_access_grants g
	INNER JOIN users owner ON owner.id = g.owner_user_id
	INNER JOIN users grantee ON grantee.id = g.grantee_user_id`
}

func scanTaskAccessGrant(scanner interface {
	Scan(dest ...interface{}) error
}) (*TaskAccessGrant, error) {
	var grant TaskAccessGrant
	var ownerEmail, granteeEmail sql.NullString
	var revokedAt sql.NullTime
	err := scanner.Scan(
		&grant.ID,
		&grant.OwnerUserID,
		&grant.GranteeUserID,
		&grant.AccessLevel,
		&grant.CanView,
		&grant.CanCreate,
		&grant.CanPing,
		&grant.OwnerUsername,
		&grant.OwnerFullname,
		&ownerEmail,
		&grant.GranteeUsername,
		&grant.GranteeFullname,
		&granteeEmail,
		&grant.CreatedAt,
		&grant.UpdatedAt,
		&revokedAt,
	)
	if err != nil {
		return nil, err
	}
	if ownerEmail.Valid {
		grant.OwnerEmail = ownerEmail.String
	}
	if granteeEmail.Valid {
		grant.GranteeEmail = granteeEmail.String
	}
	if revokedAt.Valid {
		grant.RevokedAt = &revokedAt.Time
	}
	return &grant, nil
}
