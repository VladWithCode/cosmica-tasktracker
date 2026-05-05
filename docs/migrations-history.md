# Migration history notes

## Eliminated local migrations `20260501000100` to `20260501000500`

These files were removed from the working tree during FASE 2 before being applied by Goose. They were duplicate local attempts at the same domain expansion that is now represented by the canonical migrations `20260430205000` through `20260430205300`.

The compatible strategy remains: legacy columns stay in place, canonical columns are added beside them, and new code reads canonical columns.

### `20260501000100_drop_detailed_tasks_view.sql`

Approximate intent:

```sql
DROP VIEW IF EXISTS detailed_tasks;
```

Reason removed: duplicated the view-drop step that the canonical task expansion migration handles directly. Keeping it would split one coherent change across multiple later migrations and make rollback order harder to reason about.

### `20260501000200_expand_schedule_tasks.sql`

Approximate intent:

```sql
ALTER TABLE schedule_tasks ADD COLUMN IF NOT EXISTS target_count INT;
ALTER TABLE schedule_tasks ADD COLUMN IF NOT EXISTS frequency_config JSONB;
ALTER TABLE schedule_tasks ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE schedule_tasks ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id);
ALTER TABLE schedule_tasks ALTER COLUMN priority TYPE VARCHAR(20) USING ...;
```

Reason removed: conflicted with the compatible strategy because it changed the legacy `priority` column in place instead of keeping `priority` as integer and adding canonical `priority_level schedule_priority`.

### `20260501000300_expand_tasks.sql`

Approximate intent:

```sql
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS actual_start TIMESTAMPTZ;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS actual_end TIMESTAMPTZ;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS current_count INT NOT NULL DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS target_count INT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS notes TEXT;
```

Reason removed: duplicated the canonical task expansion. It did not add `status_level task_status`, so it was incomplete for the FASE 2 model.

### `20260501000400_create_task_completions.sql`

Approximate intent:

```sql
CREATE TABLE task_completions (...);
CREATE INDEX idx_task_completions_task_id ON task_completions(task_id);
CREATE INDEX idx_task_completions_user_id ON task_completions(user_id);
CREATE INDEX idx_task_completions_completed_at ON task_completions(completed_at);
```

Reason removed: duplicated the canonical `task_completions` migration. The canonical migration also includes append-only triggers that reject updates and deletes.

### `20260501000500_recreate_detailed_tasks_view.sql`

Approximate intent:

```sql
CREATE VIEW detailed_tasks AS
SELECT ...
FROM schedule_tasks st
LEFT JOIN tasks t ON st.id = t.schedule_task_id;
```

Reason removed: duplicated the view recreation in the canonical task expansion. The canonical view maps `tasks.status_level AS status` and `schedule_tasks.priority_level AS priority`.

### Goose verification for removed versions

Command:

```powershell
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -X -P pager=off -h 127.0.0.1 -p 55432 -U postgres -d tasktracker -c "SELECT version_id FROM goose_db_version ORDER BY version_id;"
```

Output:

```text
   version_id
----------------
              0
 20250903232056
 20250903233144
 20250903233441
 20250904233516
 20250905192430
 20250905192438
 20250913060011
 20251030013920
 20251105005625
 20251105012132
 20260430205000
 20260430205100
 20260430205200
 20260430205300
(15 filas)
```

Confirmed: none of the removed `20260501000100` through `20260501000500` versions are registered in `goose_db_version`.

## Reparación del historial Goose

### Broken state found

The local `tasktracker` database already had schema objects from older migrations (`users`, `tasks`, `schedule_tasks`, `detailed_tasks`) but `goose_db_version` did not record all corresponding versions.

The symptom was that `goose up` tried to create `users` again:

```text
goose run: ERROR 20250903233144_add_users_table.sql: failed to run SQL migration:
ERROR: la relación «users» ya existe (SQLSTATE 42P07)
```

Before repair, `goose_db_version` only had:

```text
 id |   version_id   | is_applied |           tstamp
----+----------------+------------+----------------------------
  1 |              0 | t          | 2026-04-30 22:58:33.165696
  2 | 20250903232056 | t          | 2026-04-30 22:58:33.430949
```

### Repair commands executed

The missing versions were inserted into `goose_db_version` only for migrations whose effects were already present in the local database schema.

```powershell
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -h 127.0.0.1 -p 55432 -U postgres -d tasktracker -v ON_ERROR_STOP=1 -c "INSERT INTO goose_db_version (version_id, is_applied) VALUES (20250903233144, true), (20250903233441, true), (20250904233516, true), (20250905192430, true), (20250905192438, true), (20250913060011, true), (20251030013920, true) ON CONFLICT DO NOTHING;"

goose -dir sql/migrations postgres "postgres://postgres@127.0.0.1:55432/tasktracker?sslmode=disable" up
```

The duplicate `20260501000100` through `20260501000500` migration files were removed from the working tree before they were applied.

### Healthy status verification

Command:

```powershell
goose -dir sql/migrations postgres "postgres://postgres@127.0.0.1:55432/tasktracker?sslmode=disable" status
```

Output:

```text
Applied -- 20250903232056_add_updated_at_update_fn.sql
Applied -- 20250903233144_add_users_table.sql
Applied -- 20250903233441_add_tasks_table.sql
Applied -- 20250904233516_add_schedule_table.sql
Applied -- 20250905192430_add_task_textsearch.sql
Applied -- 20250905192438_add_detailed_tasks_view.sql
Applied -- 20250913060011_constraint_tasks_per_date.sql
Applied -- 20251030013920_fix_timestamp_timezone_issues.sql
Applied -- 20251105005625_add_notifications_table.sql
Applied -- 20251105012132_add_task_notifications_table.sql
Applied -- 20260430205000_add_domain_enums.sql
Applied -- 20260430205100_expand_schedule_tasks_domain.sql
Applied -- 20260430205200_expand_tasks_domain.sql
Applied -- 20260430205300_add_task_completions.sql
```
