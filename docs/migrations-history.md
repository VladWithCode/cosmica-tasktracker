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

## Migrations added after the FASE 2 cleanup

The following migrations were committed after the cleanup section above and
should be considered part of the canonical schema. They are listed here so the
history document stays consistent with the contents of `sql/migrations/`.

### `20260503090000_normalize_users_email_optional.sql`

Purpose: relax the `users.email` constraint introduced by the original users
table so that an account can be created without supplying an email.

What it does:

- Drops the legacy `users_email_key` UNIQUE constraint.
- Drops the `NOT NULL` requirement on `users.email`.
- Lower-cases existing non-empty emails for consistency.
- Adds a partial unique index `users_email_unique` on `LOWER(email)` that only
  applies when email is non-null and non-empty.

The down migration restores the previous shape, backfilling any newly-empty
emails with `<username>@local.invalid` so the unique constraint can be
re-applied without conflict.

### `20260503091000_add_task_instance_overrides.sql`

Purpose: allow a single `tasks` row to override `title` and `description`
without rewriting the parent `schedule_tasks` row. Used by the FASE 6
"edit instance only" flow.

What it does:

- Drops `detailed_tasks` view (necessary because the view referenced the
  original `tasks` columns).
- Adds nullable `title TEXT` and `description TEXT` columns to `tasks`.
- Recreates `detailed_tasks` so it surfaces `COALESCE(NULLIF(t.title, ''),
  st.title)` and `COALESCE(t.description, st.description)`. The other
  canonical fields (`status_level AS status`, `priority_level AS priority`,
  etc.) keep the same semantics as before.

The down migration restores the previous view shape and drops the new task
columns.

### `20260505090000_add_sharing_permissions_and_pings.sql`

Purpose: introduces the FASE 9 sharing model.

What it does:

- Creates `task_access_grants` with columns `id`, `owner_user_id`,
  `grantee_user_id`, `access_level`, `created_at`, `updated_at`, `revoked_at`.
- Adds a `CHECK (access_level IN ('view','manage','ping_only'))` constraint
  and a `CHECK (owner_user_id <> grantee_user_id)` constraint.
- Adds a partial UNIQUE index on `(owner_user_id, grantee_user_id) WHERE
  revoked_at IS NULL` so a single live grant can exist per pair.
- Adds the `update_task_access_grants_updated_at` trigger that calls the
  shared `update_updated_at_column()` function.
- Creates `task_pings` with `id`, `task_id`, `sender_user_id`,
  `recipient_user_id`, `message`, `notification_sent`, `created_at`, plus
  indexes for sender, recipient, task and `created_at` for the rate-limit
  lookups in `db.RecentTaskPingExists`.

All foreign keys cascade on delete so removing a user/task cleans the
related grants and pings.

## Hand-fix to `20250903233441_add_tasks_table.sql`

The original migration had a trailing comma in the `CREATE TABLE tasks`
column list (after `updated_at TIMESTAMPTZ NOT NULL DEFAULT
CURRENT_TIMESTAMP,`). PostgreSQL refuses to parse that during a clean
`goose up`, so a fresh database setup would fail at this version with a
syntax error.

Fix applied: removed the trailing comma so the migration is valid SQL.

```diff
-    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
+    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
 );
```

Why touch an old migration despite the usual rule of "do not edit
migrations that are already applied somewhere":

- The previously-applied database in development was created tolerantly
  enough that the original syntax went through. Re-running `goose up` on a
  brand-new database (CI, staging, fresh dev clone) would fail at this
  version.
- The fix is a pure syntactic correction. The semantics of the migration
  (resulting `tasks` table shape) are identical before and after the fix.
- No constraint, default, type, name, or column was changed.

Risk: if any environment's `goose_db_version` already records this version
as applied, that environment will keep working unchanged because Goose will
not re-run an already-applied migration. New environments now pass the
syntax check.

This is the only modification ever made to a previously-applied migration in
this repo. Future schema changes should always be additive new migrations.
