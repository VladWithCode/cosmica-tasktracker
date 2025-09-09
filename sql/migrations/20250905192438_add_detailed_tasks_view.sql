-- +goose Up
-- +goose StatementBegin
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

-- +goose Down
-- +goose StatementBegin
DROP VIEW detailed_tasks;
-- +goose StatementEnd
