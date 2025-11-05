-- +goose Up
-- +goose StatementBegin
-- Track which tasks have been notified
CREATE TABLE task_notifications (
    task_id UUID PRIMARY KEY REFERENCES tasks(id) ON DELETE CASCADE,
    sent_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE task_notifications;
-- +goose StatementEnd
