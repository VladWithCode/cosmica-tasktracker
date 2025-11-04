-- +goose Up
-- +goose StatementBegin
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) NOT NULL,
    -- This date refers to the date the task is meant to be completed.
    -- Normally, this is "today's date" since the task are expected to be completed
    -- on the same day.
    -- Past tasks can be differentiated in history through this field.
    date TIMESTAMPTZ NOT NULL,
    -- This is the status of the task. User may change this to indicate that the task
    -- is being worked on, or that it is paused.
    status VARCHAR(255) NOT NULL, -- pending | completed | overdue | cancelled
    completed_at TIME,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
);

CREATE TRIGGER trigger_update_tasks_updated_at BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TRIGGER trigger_update_tasks_updated_at ON tasks;

DROP TABLE tasks;
-- +goose StatementEnd
