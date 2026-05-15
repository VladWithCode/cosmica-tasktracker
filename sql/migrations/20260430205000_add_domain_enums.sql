-- +goose Up
-- +goose StatementBegin
CREATE TYPE schedule_priority AS ENUM ('urgent', 'high', 'medium', 'low');
CREATE TYPE schedule_frequency AS ENUM ('daily', 'weekly', 'monthly', 'custom');
CREATE TYPE schedule_status AS ENUM ('active', 'paused', 'cancelled');
CREATE TYPE task_status AS ENUM ('pending', 'in_progress', 'completed', 'skipped', 'failed');
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TYPE task_status;
DROP TYPE schedule_status;
DROP TYPE schedule_frequency;
DROP TYPE schedule_priority;
-- +goose StatementEnd
