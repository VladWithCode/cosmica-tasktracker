-- +goose NO TRANSACTION
-- +goose Up
ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'dismissed';

-- +goose Down
-- Postgres cannot drop an enum value. Rows go back to 'skipped', the closest
-- earlier status; the 'dismissed' label stays in the type unused.
UPDATE tasks SET status_level = 'skipped', status = 'skipped' WHERE status_level = 'dismissed';
