-- +goose Up
-- +goose StatementBegin
ALTER TABLE tasks ADD CONSTRAINT schedule_task_per_date UNIQUE (schedule_task_id, date);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE tasks DROP CONSTRAINT schedule_task_per_date;
-- +goose StatementEnd
