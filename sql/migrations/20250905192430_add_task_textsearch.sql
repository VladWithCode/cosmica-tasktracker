-- +goose Up
-- +goose StatementBegin

-- Add tsvector column for full-text search
ALTER TABLE schedule_tasks ADD COLUMN search_vector tsvector;

-- Create function to update schedule_tasks search vector
CREATE OR REPLACE FUNCTION update_schedule_tasks_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    -- Combine title and description with different weights
    NEW.search_vector := 
        setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update search vector
CREATE TRIGGER update_schedule_tasks_search_vector
    BEFORE INSERT OR UPDATE ON schedule_tasks
    FOR EACH ROW EXECUTE FUNCTION update_schedule_tasks_search_vector();

-- Update existing records
UPDATE schedule_tasks SET search_vector = 
    setweight(to_tsvector('spanish', COALESCE(title, '')), 'A') ||
    setweight(to_tsvector('spanish', COALESCE(description, '')), 'B');

-- Create GIN index for fast full-text search
CREATE INDEX idx_schedule_tasks_search_vector ON schedule_tasks USING gin(search_vector);

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

DROP INDEX IF EXISTS idx_schedule_tasks_search_vector;
DROP TRIGGER IF EXISTS update_schedule_tasks_search_vector ON schedule_tasks;
DROP FUNCTION IF EXISTS update_schedule_tasks_search_vector();
ALTER TABLE schedule_tasks DROP COLUMN IF EXISTS search_vector;
-- +goose StatementEnd
