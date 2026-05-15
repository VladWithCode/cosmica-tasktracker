-- +goose Up
-- +goose StatementBegin
DROP VIEW detailed_tasks;

ALTER TABLE tasks
    ADD COLUMN title TEXT,
    ADD COLUMN description TEXT;

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
    COALESCE(NULLIF(t.title, ''), st.title) AS title,
    COALESCE(t.description, st.description) AS description,
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

ALTER TABLE tasks
    DROP COLUMN description,
    DROP COLUMN title;

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
