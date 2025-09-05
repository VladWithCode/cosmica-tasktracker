// Package db provides access to the database.
package db

import (
	"context"
	"errors"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrNoConnStr = errors.New("required env var DATABASE_URL is not set")
	ErrUUIDFail  = errors.New("failed to generate new uuid")
)

var dbPool *pgxpool.Pool

func Connect(ctx context.Context) (*pgxpool.Pool, error) {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		return nil, ErrNoConnStr
	}
	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		return nil, err
	}

	err = pool.Ping(ctx)
	if err != nil {
		return nil, err
	}

	dbPool = pool

	return pool, nil
}

func GetConn(ctx context.Context) (*pgxpool.Conn, error) {
	return dbPool.Acquire(ctx)
}
