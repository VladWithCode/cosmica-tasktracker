# Backend gaps found by the new client

Features the new client (`docs/redesign-apple.md`) cannot offer, or offers in
a reduced form, because the backend API does not support them yet. Each entry
says what the user cannot do, where the limit lives, what the client does
today, and what backend change would remove the limit.

Update this file when a gap is found or closed. Keep entries ordered by user
impact (highest first).

Last updated: 2026-11-02

---

## Open

### 1. Notes can only be written for today

- **User impact:** cannot add a note to a past day from the Notas calendar.
- **Where:** `POST /notes` takes only `content`; `db.CreateNote` stamps
  `now()`.
- **Client today:** the add button is shown only when today is selected.
- **Backend change:** optional `date` on `POST /notes`.
- **Status:** deferred (decision 2026-11-02).

### 2. Admin console

- **User impact:** no UI for managing users.
- **Where:** `POST/PUT/DELETE /users` exist, but there is no `GET /users`;
  `POST /admin` and `GET /system` are stubs (`internal/routes/users.go`).
- **Client today:** out of scope (decision 2026-11-02).
- **Backend change:** `GET /users` with paging, real `/admin` and `/system`
  handlers.

---

## Behaviour to know (not blocking)

- **Viewing a day writes rows.** `GET /tasks/day` calls
  `CreateUserTasksForDate`, which creates missing instances for any date on or
  after a routine's start, past or future. Browsing the calendar therefore
  creates tasks, and past days opened for the first time get instances with
  serve-time status (usually `skipped`).
- **Missed tasks auto-skip.** `determineTaskStatus` turns a pending task whose
  window has passed into `skipped` at serve time, using the instance's own
  times when "Solo hoy" changed them. The client shows it under "Terminadas".
- **Dismissed tasks count.** `dismissed` stays in `total`, so it lowers the
  day's percentage and breaks a streak, like `skipped`. Stats report it
  apart (`dismissed`, `dismissal_rate`).
- **Instance overrides cannot unset a value.** A "Solo hoy" edit can change a
  time, duration, priority, required flag or category for one day, but cannot
  remove a time the routine has. "Toda la rutina" clears the day's overrides.
- **Repeat for non-repeating schedules.** `POST /schedules` defaults
  `frequency` to `daily`, so a non-repeating schedule still generates daily.
  The client always sends routines as repeating and sends one-off work to
  `POST /tasks`.

## Closed

- **"Solo hoy" cannot change time, priority, required or category** (closed
  2026-11-02). `tasks` has nullable override columns
  (`20261102120000_add_task_schedule_overrides.sql`) that `detailed_tasks`
  `COALESCE`s over the schedule. Applying to the routine clears them.
- **A routine's task cannot be removed from one day** (closed 2026-11-02).
  New `dismissed` task status (`20261102120100_add_dismissed_task_status.sql`).
  Generators and serve-time inference never overwrite it, reminders skip it,
  and `DELETE /tasks/:id` on a routine instance dismisses instead of deleting.
  Progress, history and metrics report `dismissed`; metrics add
  `dismissal_rate`. The client shows it in orange and warns from 3 dismissals
  and 20% of the range.
- **Shared "manage" users can create routines but not edit, pause or cancel
  them** (closed 2026-11-02). `schedules.Service` accepts
  `SharingPermissionEdit`; managers may also send `apply_to_schedule` on task
  edits.
- **Progreso is only available for the signed-in user** (closed 2026-11-02).
  `/tasks/history`, `/tasks/metrics` and `/tasks/progress` accept
  `owner_user_id` with the view-permission check.
- **One-off tasks cannot be created for another person** (closed 2026-11-02).
  `POST /tasks` accepts `owner_user_id` with the create-permission check and
  records the creator in `created_by`.
- **Task notes cannot be cleared** (closed 2026-11-02). `notes` is a
  `*string`; an explicit `""` clears the note.
- **Changing a share's access level needs revoke and re-invite** (closed
  2026-11-02). `PUT /sharing/grants/:id` with `access_level`.
- **The day feed lacks fields the list needs** (closed 2026-11-02).
  `TaskFeedItem` carries `category` and `frequency_config`; Hoy and Calendario
  no longer load `GET /schedules`.
- **No per-routine history** (closed 2026-11-02).
  `GET /schedules/:id/history?from&to` returns occurrences, counts, current
  and best streak.
- **Profile update has no validation** (closed 2026-11-02). Shares the
  register name and email rules; returns `422 validation_error` with fields or
  `409 email_taken`.
- **Push notification buttons in English** (closed 2026-11-02). Task
  reminder actions in `internal/notifications/scheduler.go` now read
  "Ver tarea" / "Completar". Action IDs (`view`, `complete`) unchanged.
