-- +goose Up
-- +goose StatementBegin
ALTER TABLE task_pings
    ADD COLUMN read_at TIMESTAMPTZ;

CREATE INDEX task_pings_recipient_read_created_idx
    ON task_pings(recipient_user_id, read_at, created_at DESC);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS task_pings_recipient_read_created_idx;
ALTER TABLE task_pings
    DROP COLUMN IF EXISTS read_at;
-- +goose StatementEnd
