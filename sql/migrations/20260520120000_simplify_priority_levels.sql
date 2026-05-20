-- +goose Up
-- Map legacy priority levels to the simplified two-level system.
UPDATE schedule_tasks SET priority_level = 'urgent' WHERE priority_level = 'high';
UPDATE schedule_tasks SET priority_level = 'medium' WHERE priority_level = 'low';
UPDATE schedule_tasks SET priority = 1 WHERE priority_level = 'urgent';
UPDATE schedule_tasks SET priority = 2 WHERE priority_level = 'medium';

-- +goose Down
-- Cannot restore original high/low distinction; leave all as urgent/medium.
-- This is a one-way data simplification.
