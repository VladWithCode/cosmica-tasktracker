# TaskTracker data model

## Compatibility strategy

The current schema keeps legacy columns for backward compatibility and adds canonical columns for new code. New backend and frontend code must read business state from the canonical columns. Legacy columns are written only as mirrors while the app still needs compatibility with older queries or payloads.

Do not rename or drop legacy columns in feature work. A later cleanup migration can remove them after all code paths and deployments are confirmed to use only canonical fields.

## `schedule_tasks`

| Purpose | Column | Type | Rule |
| --- | --- | --- | --- |
| Legacy priority | `priority` | `integer` | Do not use in new code. Kept as a compatibility mirror. |
| Canonical priority | `priority_level` | `schedule_priority` enum | Use this as source of truth. Values: `urgent`, `high`, `medium`, `low`. |
| Legacy schedule status | `status` | `varchar` | Do not use in new code. Kept as a compatibility mirror. |
| Canonical schedule status | `status_level` | `schedule_status` enum | Use this as source of truth. Values: `active`, `paused`, `cancelled`. |

Other canonical schedule fields added for the domain model:

- `is_required`
- `schedule_start_time`
- `schedule_end_time`
- `duration_minutes`
- `target_count`
- `frequency`
- `frequency_config`
- `category`
- `created_by`

## `tasks`

| Purpose | Column | Type | Rule |
| --- | --- | --- | --- |
| Legacy task status | `status` | `varchar` | Do not use in new code. Kept as a compatibility mirror. |
| Canonical task status | `status_level` | `task_status` enum | Use this as source of truth. Values: `pending`, `in_progress`, `completed`, `skipped`, `failed`. |

`tasks` intentionally has no priority column. If task priority is needed, join through `tasks.schedule_task_id = schedule_tasks.id` and read `schedule_tasks.priority_level`.

Other canonical task fields added for the domain model:

- `actual_start`
- `actual_end`
- `current_count`
- `target_count`
- `notes`

## `task_completions`

`task_completions` is the append-only completion history table for metrics and history. It stores:

- `task_id`
- `user_id`
- `completed_at`
- `actual_start`
- `actual_end`
- `count`
- `notes`

The table has database triggers that reject `UPDATE` and `DELETE`, so completed task history is immutable.

## Synchronization rules

Synchronization is currently handled in repository/database write logic, not by database triggers:

- `internal/db/schedule.go`
  - `CreateScheduleTask` writes both `priority` and `priority_level`.
  - `CreateScheduleTask` writes both `status` and `status_level`.
  - `UpdateScheduleTask` mirrors canonical priority/status into the legacy columns.
  - `SetScheduleTaskStatus` mirrors canonical schedule status into legacy `status`.
- `internal/db/tasks.go`
  - Task inserts write both `status` and `status_level`.
  - `UpdateTask` mirrors canonical task status into legacy `status`.

Reads for new code use canonical fields:

- `scheduleSelectSQL` selects `priority_level` and `status_level`.
- `taskSelectSQL` selects `status_level`.
- `detailed_tasks` exposes `status` and `priority` as view aliases backed by `tasks.status_level` and `schedule_tasks.priority_level`.

## Future cleanup plan

Do a cleanup only after the app is stable on the canonical columns:

1. Verify no production code reads `schedule_tasks.priority`, `schedule_tasks.status`, or `tasks.status`.
2. Add observability or tests around create/update flows to prove canonical columns are complete.
3. Stop writing legacy mirrors in repository/database write logic.
4. Create a dedicated cleanup migration to drop legacy columns or rename canonical columns, depending on the final API contract.
5. Update this document and all API documentation in the same cleanup PR.
