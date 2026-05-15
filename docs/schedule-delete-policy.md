# Schedule Delete Policy

`DELETE /api/v1/schedules/:id` is a logical cancellation, not a hard delete.

Policy:

- The schedule row stays in `schedule_tasks`.
- `status_level` and legacy `status` are set to `cancelled`.
- Existing `tasks` rows stay untouched.
- Existing `task_completions` rows stay untouched and remain append-only.
- Cancelled schedules are excluded from task generation because generators only read `status_level = 'active'`.
- Ownership remains required: only the owner or admin-level users can cancel a schedule.

This preserves historical metrics while preventing future task generation for the cancelled routine. A future cleanup can add an archival view or hard-delete path for schedules with no tasks and no completions, but the current product path intentionally favors preserving history.
