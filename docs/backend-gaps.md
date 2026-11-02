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

### 1. "Solo hoy" cannot change time, priority, required or category

- **User impact:** editing a single day's task can only change title,
  description and count goal. Moving today's run from 18:30 to 20:00 without
  changing the routine is impossible.
- **Where:** `tasks.Service.Update` (`internal/tasks/service.go`) applies
  `StartTime`, `EndTime`, `DurationMinutes`, `Priority`, `IsRequired` and
  `Category` only when `apply_to_schedule` is true. `tasks` has no columns for
  them; `detailed_tasks` reads them from `schedule_tasks`.
- **Client today:** those fields appear only under "Toda la rutina".
- **Backend change:** add nullable override columns on `tasks`
  (`start_time`, `end_time`, `duration_minutes`, `priority_level`,
  `is_required`, `category`) and `COALESCE` them in `detailed_tasks`, like
  `title` and `description` already do
  (`20260503091000_add_task_instance_overrides.sql`).

### 2. A routine's task cannot be removed from one day

- **User impact:** deleting today's instance of a routine has no lasting
  effect.
- **Where:** `DELETE /tasks/:id` removes the row, but
  `CreateUsersTodayTasks` / `CreateUserTasksForDate`
  (`internal/db/tasks.go`) recreate any missing instance on the next
  `/tasks/today` or `/tasks/day` call.
- **Client today:** "Eliminar" shows only for one-off tasks. Routine tasks use
  "Omitir" (`skipped`), which counts against the day's percentage.
- **Backend change:** soft-delete (a `dismissed` status, or a
  `task_exclusions(schedule_task_id, date)` table that the generators check),
  and decide whether dismissed tasks count in progress.

### 3. Shared "manage" users can create routines but not edit, pause or cancel them

- **User impact:** someone with `manage` access can add a routine for the
  owner, then cannot fix a typo in it or pause it.
- **Where:** `schedules.Service.Update`, `setStatus` and `Delete`
  (`internal/schedules/service.go`) use `canAccessSchedule`, which allows only
  the owner and admins. `CreateSchedule` checks `SharingPermissionCreate`.
- **Client today:** Rutinas for another owner is read-only.
- **Backend change:** accept `SharingPermissionEdit` (or `Create`) in those
  three paths.

### 4. Progreso is only available for the signed-in user

- **User impact:** viewing a shared owner's history, streak or metrics is
  impossible.
- **Where:** `GET /tasks/history`, `/tasks/metrics` and `/tasks/progress`
  (`internal/routes/tasks.go`) read `sessionAuth.ID` and take no
  `owner_user_id`.
- **Client today:** Progreso always shows "Mis tareas", even when another
  owner is selected. Hoy computes the ring from the day list, which works for
  any owner.
- **Backend change:** accept `owner_user_id` with the same `CanViewOwner`
  check that `/tasks/day` uses.

### 5. One-off tasks cannot be created for another person

- **User impact:** "Para" (create for someone who shared with you) is only
  available for routines.
- **Where:** `POST /tasks` (`CreateTask`) binds `db.ScheduleTask` and always
  uses `sessionAuth.ID`; it has no `owner_user_id` or permission check.
  Routing a one-off through `POST /schedules` does not work either: a
  `custom` schedule never generates a task (`shouldRepeatToday`).
- **Client today:** owner choice hidden for "Una vez".
- **Backend change:** accept `owner_user_id` in `POST /tasks` with the
  `SharingPermissionCreate` check from `CreateSchedule`.

### 6. Task notes cannot be cleared

- **User impact:** once a task has a note, deleting its text does not save.
- **Where:** `updateTaskRequest.Notes` is a plain `string`;
  `tasks.Service.Update` only writes it when non-empty.
- **Client today:** an emptied note field is not sent; the old note returns
  on reload.
- **Backend change:** make `Notes` a `*string` (as `CurrentCount` already is)
  so an explicit `""` clears it.

### 7. Notes can only be written for today

- **User impact:** cannot add a note to a past day from the Notas calendar.
- **Where:** `POST /notes` takes only `content`; `db.CreateNote` stamps
  `now()`.
- **Client today:** the add button is shown only when today is selected.
- **Backend change:** optional `date` on `POST /notes`.

### 8. Changing a share's access level needs revoke and re-invite

- **User impact:** switching someone from "view" to "manage" sends them a
  second invitation and briefly removes access.
- **Where:** `POST /sharing/grants` returns `409 active_grant_exists` for an
  existing pair; there is no `PUT /sharing/grants/:id`.
- **Client today:** the level is fixed after invite; Perfil offers revoke,
  then a new invite.
- **Backend change:** `PUT /sharing/grants/:id` with `access_level`.

### 9. The day feed lacks fields the list needs

- **User impact:** none visible; costs an extra request per screen.
- **Where:** `db.TaskFeedItem` (`internal/db/tasks.go`) has no
  `frequency_config` or `category`.
- **Client today:** Hoy also loads `GET /schedules` and joins by
  `schedule_id` to detect water routines.
- **Backend change:** add `frequency_config` and `category` to
  `TaskFeedItem`.

### 10. No per-routine history

- **User impact:** a routine's detail cannot show its recent completions or
  streak.
- **Where:** no endpoint reads `task_completions` by `schedule_task_id`.
- **Client today:** routine detail shows configuration only.
- **Backend change:** `GET /schedules/:id/history?from&to`.

### 11. Profile update has no validation

- **User impact:** a duplicate or malformed email returns a generic "Error
  inesperado" instead of a field message.
- **Where:** `users.Service.UpdateProfile` (`internal/users/service.go`)
  writes `fullname` and `email` without the checks `validateRegisterInput`
  runs, and `UpdateProfile` maps every error to 500.
- **Client today:** validates name (2–80) and email format before sending;
  a duplicate email still shows the generic message.
- **Backend change:** reuse the register validation and return
  `422 validation_error` / `409 email_taken` like `HandleRegister`.

### 12. Admin console

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
  window has passed into `skipped` at serve time. The client shows it under
  "Terminadas".
- **Repeat for non-repeating schedules.** `POST /schedules` defaults
  `frequency` to `daily`, so a non-repeating schedule still generates daily.
  The client always sends routines as repeating and sends one-off work to
  `POST /tasks`.

## Closed

- **Push notification buttons in English** (closed 2026-11-02). Task
  reminder actions in `internal/notifications/scheduler.go` now read
  "Ver tarea" / "Completar". Action IDs (`view`, `complete`) unchanged.
