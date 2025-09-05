-- +goose Up
-- +goose StatementBegin
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description VARCHAR(512),
    duration INT, -- in milliseconds
    -- Some tasks are meant to appear as pinned in the UI if the user marks them as required
    required BOOLEAN NOT NULL DEFAULT FALSE,
    -- For task with specific start and end dates, the task is considered
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    -- For tasks that repeat, the task is considered to be repeating
    repeating BOOLEAN NOT NULL DEFAULT FALSE,
    repeat_frequency VARCHAR(255), -- daily | weekly | monthly | yearly
    repeat_interval INT, -- in days
    repeat_weekdays INT[], -- 1-7 | 0 = every day
    repeat_end_date TIMESTAMPTZ, -- only used for repeating tasks, stops repeating after this date
    status VARCHAR(255) NOT NULL, -- active | paused | completed | cancelled
    priority INT NOT NULL, -- lower value = higher priority
    once BOOLEAN NOT NULL DEFAULT FALSE, -- if true, the task is considered to be completed once and deleted afterwards

    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE tasks;
-- +goose StatementEnd
