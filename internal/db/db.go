// Package db provides access to the database.
package db

import (
	"context"
	"errors"
	"os"
	"time"

	"github.com/jackc/pgx/v5"
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

	poolConfig, err := pgxpool.ParseConfig(dbURL)
	if err != nil {
		return nil, err
	}

	poolConfig.AfterConnect = func(ctx context.Context, conn *pgx.Conn) error {
		setCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
		defer cancel()
		_, err := conn.Exec(setCtx, "SET timezone TO 'America/Mexico_City'")
		return err
	}

	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
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
