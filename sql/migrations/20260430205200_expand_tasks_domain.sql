-- +goose Up
-- +goose StatementBegin
DROP VIEW detailed_tasks;

ALTER TABLE tasks
    ADD COLUMN actual_start TIMESTAMPTZ,
    ADD COLUMN actual_end TIMESTAMPTZ,
    ADD COLUMN current_count INT NOT NULL DEFAULT 0,
    ADD COLUMN target_count INT,
    ADD COLUMN notes TEXT,
    ADD COLUMN status_level task_status NOT NULL DEFAULT 'pending';

UPDATE tasks
SET status_level = CASE status
    WHEN 'completed' THEN 'completed'::task_status
    WHEN 'overdue' THEN 'failed'::task_status
    WHEN 'cancelled' THEN 'skipped'::task_status
    ELSE 'pending'::task_status
END;

UPDATE tasks
SET
    actual_end = COALESCE(actual_end, completed_at),
    target_count = schedule_tasks.target_count
FROM schedule_tasks
WHERE tasks.schedule_task_id = schedule_tasks.id;

CREATE INDEX idx_tasks_status_level ON tasks (status_level);

CREATE VIEW detailed_tasks AS
SELECT
    t.id,
    t.date,
    t.status_level AS status,
    t.completed_at,
    t.actual_start,
    t.actual_end,
    t.current_count,
    COALESCE(t.target_count, st.target_count) AS target_count,
    t.notes,
    st.id AS schedule_task_id,
    st.user_id,
    st.created_by,
    st.title,
    st.description,
    st.schedule_start_time AS start_time,
    st.duration_minutes AS duration,
    st.schedule_end_time AS end_time,
    st.start_date,
    st.end_date,
    st.repeating,
    st.repeat_frequency,
    st.repeat_weekdays,
    st.repeat_interval,
    st.repeat_end_date,
    st.frequency,
    st.frequency_config,
    st.category,
    st.priority_level AS priority,
    st.is_required AS required,
    st.is_required,
    st.search_vector,
    st.status_level AS schedule_status,
    st.created_at AS schedule_created_at,
    st.updated_at AS schedule_updated_at,
    COALESCE(t.created_at, st.created_at) AS created_at,
    COALESCE(t.updated_at, st.updated_at) AS updated_at
FROM schedule_tasks st
LEFT JOIN tasks t ON st.id = t.schedule_task_id;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP VIEW detailed_tasks;

DROP INDEX idx_tasks_status_level;

ALTER TABLE tasks
    DROP COLUMN status_level,
    DROP COLUMN notes,
    DROP COLUMN target_count,
    DROP COLUMN current_count,
    DROP COLUMN actual_end,
    DROP COLUMN actual_start;

CREATE VIEW detailed_tasks AS
SELECT
    t.id,
    t.date,
    t.status,
    t.completed_at,
    st.id AS schedule_task_id,
    st.user_id,
    st.title,
    st.description,
    st.start_time,
    st.duration,
    st.end_time,
    st.start_date,
    st.end_date,
    st.repeating,
    st.repeat_frequency,
    st.repeat_weekdays,
    st.repeat_interval,
    st.repeat_end_date,
    st.priority,
    st.required,
    st.search_vector,
    st.status AS schedule_status,
    st.created_at AS schedule_created_at,
    st.updated_at AS schedule_updated_at,
    COALESCE(t.created_at, st.created_at) AS created_at,
    COALESCE(t.updated_at, st.updated_at) AS updated_at
FROM schedule_tasks st
LEFT JOIN tasks t ON st.id = t.schedule_task_id;
-- +goose StatementEnd
