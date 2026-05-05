-- +goose Up
-- +goose StatementBegin
CREATE TABLE task_completions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actual_start TIMESTAMPTZ,
    actual_end TIMESTAMPTZ,
    count INT NOT NULL DEFAULT 0,
    notes TEXT
);

CREATE INDEX idx_task_completions_user_completed_at ON task_completions (user_id, completed_at DESC);
CREATE INDEX idx_task_completions_task_id ON task_completions (task_id);

CREATE OR REPLACE FUNCTION prevent_task_completion_mutation()
RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'task_completions is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_task_completion_update
    BEFORE UPDATE ON task_completions
    FOR EACH ROW EXECUTE PROCEDURE prevent_task_completion_mutation();

CREATE TRIGGER prevent_task_completion_delete
    BEFORE DELETE ON task_completions
    FOR EACH ROW EXECUTE PROCEDURE prevent_task_completion_mutation();
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TRIGGER prevent_task_completion_delete ON task_completions;
DROP TRIGGER prevent_task_completion_update ON task_completions;
DROP FUNCTION prevent_task_completion_mutation();

DROP INDEX idx_task_completions_task_id;
DROP INDEX idx_task_completions_user_completed_at;
DROP TABLE task_completions;
-- +goose StatementEnd
