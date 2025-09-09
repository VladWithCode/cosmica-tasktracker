-- +goose Up
-- +goose StatementBegin

-- Schedule tasks are the main source of data of tasks, and are used to define the
-- tasks that are created every day (depending on the parameters of the schedule task).
-- A schedule task may have multiple tasks associated with it if the task is recurring.
CREATE TABLE schedule_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description VARCHAR(512),

    -- For most tasks, user defines start and end times for the task that will be completed
    -- at any time during the day.
    start_time TIME,
    end_time TIME,
    -- For tasks with specific start and end dates
    start_date DATE,
    end_date DATE,
    -- Tasks can be registered with a duration instead of a specific start or end time.
    -- Allowing users to define a task that they may complete at any time during the day
    -- for a specific duration.
    -- Duration is in minutes.
    duration INT,
    -- By default all tasks are not recurring
    repeating BOOLEAN NOT NULL DEFAULT FALSE,
    -- If repeating, one or more of the following fields must be defined and will be
    -- used to determine when to repeat.
    -- Basic repeating.
    -- For weekly and biweekly, repeat_interval will be used to determine the day of the week
    -- to repeat on. All values after the first index are ignored.
    repeat_frequency VARCHAR(255), -- daily | weekly | biweekly | monthly | bimonthly | yearly
    -- If no repeat_frequency is defined, the task will repeat on the specified days.
    repeat_weekdays INT[], -- 0-6, 0 = sunday
    -- Arbitrarly repeating interval in days
    repeat_interval INT,
    -- Repeating tasks may define a date to stop repeating
    repeat_end_date TIMESTAMPTZ,

    -- This is the status for the scheduling of the task. User may change this to
    -- indicate that the task is being worked on, or that it is paused.
    status VARCHAR(255) NOT NULL, -- active | paused | completed | cancelled
    -- Priority is used to determine the order in which tasks are presented to the user
    -- in the UI. This value is used to sort tasks in minimal tasklist view and in the pinned (required)
    -- tasks list.
    priority INT NOT NULL, -- lower value = higher priority
    -- Some tasks may be marked as required, meaning the user wants to give them a special
    -- priority in the UI. This is used to determine which tasks are pinned in the UI.
    required BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_schedule_task_status ON schedule_tasks (status);
CREATE TRIGGER trigger_update_schedule_tasks_updated_at BEFORE UPDATE ON schedule_tasks
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Add schedule_task_id to tasks table referencing the schedule_tasks table
ALTER TABLE tasks ADD COLUMN schedule_task_id UUID REFERENCES schedule_tasks(id);
CREATE INDEX idx_task_schedule_task_id ON tasks (user_id, schedule_task_id);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX idx_task_schedule_task_id;
ALTER TABLE tasks DROP COLUMN schedule_task_id;

DROP TRIGGER trigger_update_schedule_tasks_updated_at ON schedule_tasks;
DROP INDEX idx_schedule_task_status;

DROP TABLE schedule_tasks;
-- +goose StatementEnd
