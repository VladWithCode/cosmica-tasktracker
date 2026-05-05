package db

import (
	"context"
	"encoding/json"
	"time"

	"github.com/jackc/pgx/v5"
)

type PushSubscription struct {
	ID       string    `json:"id" db:"id"`
	UserID   string    `json:"user_id" db:"user_id"`
	Endpoint string    `json:"endpoint" db:"endpoint"`
	Keys     Keys      `json:"keys" db:"keys"`
	Created  time.Time `json:"created" db:"created"`
}

type Keys struct {
	P256dh string `json:"p256dh"`
	Auth   string `json:"auth"`
}

func SaveSubscription(ctx context.Context, userID string, sub *PushSubscription) error {
	conn, err := GetConn(ctx)
	if err != nil {
		return err
	}
	defer conn.Release()

	keysJSON, err := json.Marshal(sub.Keys)
	if err != nil {
		return err
	}

	args := pgx.NamedArgs{
		"userID":   userID,
		"endpoint": sub.Endpoint,
		"keys":     keysJSON,
	}
	_, err = conn.Exec(
		ctx,
		`INSERT INTO push_subscriptions (user_id, endpoint, keys) 
		 VALUES (@userID, @endpoint, @keys)
		 ON CONFLICT (user_id, endpoint) DO UPDATE 
		 SET keys = @keys, updated_at = CURRENT_TIMESTAMP`,
		args,
	)

	return err
}

func GetSubscriptionsByUserID(ctx context.Context, userID string) ([]*PushSubscription, error) {
	conn, err := GetConn(ctx)
	if err != nil {
		return nil, err
	}
	defer conn.Release()

	rows, err := conn.Query(
		ctx,
		`SELECT id, user_id, endpoint, keys, created_at 
		 FROM push_subscriptions 
		 WHERE user_id = $1`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var subscriptions []*PushSubscription
	for rows.Next() {
		var sub PushSubscription
		var keysJSON []byte

		err := rows.Scan(&sub.ID, &sub.UserID, &sub.Endpoint, &keysJSON, &sub.Created)
		if err != nil {
			return nil, err
		}

		if err := json.Unmarshal(keysJSON, &sub.Keys); err != nil {
			return nil, err
		}

		subscriptions = append(subscriptions, &sub)
	}

	return subscriptions, nil
}

func DeleteSubscription(ctx context.Context, userID, endpoint string) error {
	conn, err := GetConn(ctx)
	if err != nil {
		return err
	}
	defer conn.Release()

	args := pgx.NamedArgs{
		"userID":   userID,
		"endpoint": endpoint,
	}
	_, err = conn.Exec(
		ctx,
		`DELETE FROM push_subscriptions 
		 WHERE user_id = @userID AND endpoint = @endpoint`,
		args,
	)
	return err
}
