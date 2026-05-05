-- +goose Up
-- +goose StatementBegin
ALTER TABLE schedule_tasks
    ADD COLUMN is_required BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN priority_level schedule_priority NOT NULL DEFAULT 'medium',
    ADD COLUMN schedule_start_time TIME,
    ADD COLUMN schedule_end_time TIME,
    ADD COLUMN duration_minutes INT,
    ADD COLUMN target_count INT,
    ADD COLUMN frequency schedule_frequency NOT NULL DEFAULT 'daily',
    ADD COLUMN frequency_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN category TEXT,
    ADD COLUMN status_level schedule_status NOT NULL DEFAULT 'active',
    ADD COLUMN created_by UUID REFERENCES users(id);

UPDATE schedule_tasks
SET
    is_required = required,
    priority_level = CASE priority
        WHEN 3 THEN 'urgent'::schedule_priority
        WHEN 2 THEN 'high'::schedule_priority
        WHEN 1 THEN 'medium'::schedule_priority
        WHEN 0 THEN 'low'::schedule_priority
        ELSE 'medium'::schedule_priority
    END,
    schedule_start_time = (start_time AT TIME ZONE 'UTC')::time,
    schedule_end_time = (end_time AT TIME ZONE 'UTC')::time,
    duration_minutes = duration,
    frequency = CASE
        WHEN repeat_frequency = 'daily' THEN 'daily'::schedule_frequency
        WHEN repeat_frequency = 'weekly' THEN 'weekly'::schedule_frequency
        WHEN repeat_frequency = 'monthly' THEN 'monthly'::schedule_frequency
        WHEN repeat_frequency IS NOT NULL OR repeat_interval IS NOT NULL OR array_length(repeat_weekdays, 1) IS NOT NULL THEN 'custom'::schedule_frequency
        ELSE 'daily'::schedule_frequency
    END,
    frequency_config = jsonb_strip_nulls(jsonb_build_object(
        'legacyRepeatFrequency', repeat_frequency,
        'repeatWeekdays', COALESCE(to_jsonb(repeat_weekdays), '[]'::jsonb),
        'repeatInterval', repeat_interval,
        'repeatEndDate', repeat_end_date
    )),
    status_level = CASE status
        WHEN 'active' THEN 'active'::schedule_status
        WHEN 'paused' THEN 'paused'::schedule_status
        ELSE 'cancelled'::schedule_status
    END,
    created_by = user_id;

ALTER TABLE schedule_tasks
    ALTER COLUMN created_by SET NOT NULL;

CREATE INDEX idx_schedule_tasks_status_level ON schedule_tasks (status_level);
CREATE INDEX idx_schedule_tasks_priority_level ON schedule_tasks (priority_level);
CREATE INDEX idx_schedule_tasks_created_by ON schedule_tasks (created_by);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX idx_schedule_tasks_created_by;
DROP INDEX idx_schedule_tasks_priority_level;
DROP INDEX idx_schedule_tasks_status_level;

ALTER TABLE schedule_tasks
    DROP COLUMN created_by,
    DROP COLUMN status_level,
    DROP COLUMN category,
    DROP COLUMN frequency_config,
    DROP COLUMN frequency,
    DROP COLUMN target_count,
    DROP COLUMN duration_minutes,
    DROP COLUMN schedule_end_time,
    DROP COLUMN schedule_start_time,
    DROP COLUMN priority_level,
    DROP COLUMN is_required;
-- +goose StatementEnd
