import * as z from "zod/mini";

function map<S extends z.ZodMiniType, O>(schema: S, fn: (value: z.output<S>) => O) {
    return z.pipe(schema, z.transform((value: z.output<S>) => fn(value)));
}

const text = map(z.nullish(z.string()), (value) => value ?? "");
const optionalText = map(z.nullish(z.string()), (value) => (value ? value : null));
const flag = map(z.nullish(z.boolean()), (value) => value ?? false);
const count = map(z.nullish(z.number()), (value) => value ?? 0);
const optionalCount = map(z.nullish(z.number()), (value) => (value === undefined || value === null ? null : value));

export function clockFromWire(value: string | null | undefined): string | null {
    if (!value) return null;
    const clock = /^(\d{2}:\d{2})/.exec(value) ?? /T(\d{2}:\d{2})/.exec(value);
    return clock?.[1] ?? null;
}

export function dateFromWire(value: string | null | undefined): string | null {
    if (!value) return null;
    const date = /^(\d{4}-\d{2}-\d{2})/.exec(value);
    if (!date?.[1] || date[1].startsWith("0000") || date[1].startsWith("0001")) return null;
    return date[1];
}

const clock = map(z.nullish(z.string()), (value) => clockFromWire(value));
const isoDate = map(z.nullish(z.string()), (value) => dateFromWire(value));

export const taskStatuses = ["pending", "in_progress", "completed", "skipped", "failed"] as const;
export type TaskStatus = (typeof taskStatuses)[number];
const taskStatus = map(z.nullish(z.string()), (value): TaskStatus => (taskStatuses as readonly string[]).includes(value ?? "") ? (value as TaskStatus) : "pending");

export type Priority = "urgent" | "medium";
const priority = map(z.nullish(z.string()), (value): Priority => (value === "urgent" || value === "high" ? "urgent" : "medium"));

export const scheduleStatuses = ["active", "paused", "cancelled"] as const;
export type ScheduleStatus = (typeof scheduleStatuses)[number];
const scheduleStatus = map(z.nullish(z.string()), (value): ScheduleStatus => (scheduleStatuses as readonly string[]).includes(value ?? "") ? (value as ScheduleStatus) : "active");

export const repeatFrequencies = ["daily", "weekly", "biweekly", "monthly", "bimonthly", "yearly"] as const;
export type RepeatFrequency = (typeof repeatFrequencies)[number];
const repeatFrequency = map(z.nullish(z.string()), (value): RepeatFrequency | null => (repeatFrequencies as readonly string[]).includes(value ?? "") ? (value as RepeatFrequency) : null);

const frequencyConfig = map(z.nullish(z.record(z.string(), z.unknown())), (value) => value ?? {});

export const userSchema = z.object({ id: z.string(), username: text, fullname: text, email: text, role: text });
export type User = z.output<typeof userSchema>;

export const sessionSchema = z.object({ user: userSchema });

export const profileSchema = z.object({ profile: userSchema });

export const taskItemSchema = map(z.object({
        id: z.string(),
        title: text,
        description: text,
        schedule_id: text,
        priority_level: priority,
        status_level: taskStatus,
        is_required: flag,
        schedule_start_time: clock,
        schedule_end_time: clock,
        duration_minutes: optionalCount,
        target_count: optionalCount,
        current_count: count,
        completed_at: optionalText,
    }), (task) => ({
        id: task.id,
        title: task.title,
        description: task.description,
        scheduleId: task.schedule_id,
        priority: task.priority_level,
        status: task.status_level,
        isRequired: task.is_required,
        startTime: task.schedule_start_time,
        endTime: task.schedule_end_time,
        durationMinutes: task.duration_minutes,
        targetCount: task.target_count,
        currentCount: task.current_count,
        completedAt: task.completed_at,
    }));
export type TaskItem = z.output<typeof taskItemSchema>;

export const dayTasksSchema = map(z.object({ tasks: z.nullish(z.array(taskItemSchema)), date: text, owner_user_id: text }), (data) => ({ tasks: data.tasks ?? [], date: data.date, ownerUserId: data.owner_user_id }));
export type DayTasks = z.output<typeof dayTasksSchema>;

export const taskDetailSchema = map(z.object({
        id: z.string(),
        userId: text,
        scheduleTaskId: text,
        title: text,
        description: text,
        date: isoDate,
        status: taskStatus,
        priority: priority,
        isRequired: flag,
        required: flag,
        completedAt: optionalText,
        actualStart: optionalText,
        actualEnd: optionalText,
        startTime: clock,
        endTime: clock,
        startDate: isoDate,
        endDate: isoDate,
        duration: optionalCount,
        currentCount: count,
        targetCount: optionalCount,
        notes: text,
        frequency: text,
        category: text,
        canEdit: flag,
        canApplyToSchedule: flag,
    }), (task) => ({
        id: task.id,
        userId: task.userId,
        scheduleId: task.scheduleTaskId,
        title: task.title,
        description: task.description,
        date: task.date,
        status: task.status,
        priority: task.priority,
        isRequired: task.isRequired || task.required,
        completedAt: task.completedAt,
        actualStart: task.actualStart,
        actualEnd: task.actualEnd,
        startTime: task.startTime,
        endTime: task.endTime,
        startDate: task.startDate,
        endDate: task.endDate,
        durationMinutes: task.duration,
        currentCount: task.currentCount,
        targetCount: task.targetCount,
        notes: task.notes,
        frequency: task.frequency,
        category: task.category,
        canEdit: task.canEdit,
        canApplyToSchedule: task.canApplyToSchedule,
    }));
export type TaskDetail = z.output<typeof taskDetailSchema>;

export const taskDetailResponseSchema = z.object({ task: taskDetailSchema });

const dayStatsSchema = map(z.object({
        date: text,
        total: count,
        completed: count,
        pending: count,
        skipped: count,
        failed: count,
        in_progress: count,
        percentage: count,
    }),
    ({ in_progress, ...day }) => ({ ...day, inProgress: in_progress }));
export type DayStats = z.output<typeof dayStatsSchema>;

export const progressResponseSchema = z.object({ progress: dayStatsSchema });

export const historyResponseSchema = map(z.object({ history: z.object({ from: text, to: text, days: z.nullish(z.array(dayStatsSchema)) }) }), ({ history }) => ({ from: history.from, to: history.to, days: history.days ?? [] }));
export type History = z.output<typeof historyResponseSchema>;

export const metricsResponseSchema = map(z.object({
        metrics: z.object({
            from: text,
            to: text,
            total: count,
            completed: count,
            pending: count,
            skipped: count,
            failed: count,
            in_progress: count,
            percentage: count,
            days_count: count,
            completions_count: count,
            active_days: count,
            best_day: z.nullish(z.object({ date: text, percentage: count })),
            current_streak: count,
        }),
    }), ({ metrics }) => ({
        from: metrics.from,
        to: metrics.to,
        total: metrics.total,
        completed: metrics.completed,
        pending: metrics.pending,
        skipped: metrics.skipped,
        failed: metrics.failed,
        inProgress: metrics.in_progress,
        percentage: metrics.percentage,
        daysCount: metrics.days_count,
        completionsCount: metrics.completions_count,
        activeDays: metrics.active_days,
        bestDay: metrics.best_day ?? null,
        currentStreak: metrics.current_streak,
    }));
export type Metrics = z.output<typeof metricsResponseSchema>;

export const scheduleSchema = map(z.object({
        id: z.string(),
        userId: text,
        createdBy: text,
        title: text,
        description: text,
        startTime: clock,
        endTime: clock,
        startDate: isoDate,
        endDate: isoDate,
        durationMinutes: optionalCount,
        targetCount: optionalCount,
        isRequired: flag,
        required: flag,
        repeating: flag,
        repeatFrequency: repeatFrequency,
        repeatWeekdays: map(z.nullish(z.array(z.number())), (value) => value ?? []),
        repeatInterval: count,
        frequency: text,
        frequencyConfig: frequencyConfig,
        category: text,
        status: scheduleStatus,
        priority: priority,
    }), ({ required, ...schedule }) => ({ ...schedule, isRequired: schedule.isRequired || required }));
export type Schedule = z.output<typeof scheduleSchema>;

export const schedulesResponseSchema = map(z.object({ schedules: z.nullish(z.array(scheduleSchema)) }), (data) => data.schedules ?? []);
export const scheduleResponseSchema = map(z.object({ schedule: scheduleSchema }), (data) => data.schedule);

export const sharingAccessLevels = ["view", "manage", "ping_only"] as const;
export type SharingAccessLevel = (typeof sharingAccessLevels)[number];
const accessLevel = map(z.nullish(z.string()), (value): SharingAccessLevel => (sharingAccessLevels as readonly string[]).includes(value ?? "") ? (value as SharingAccessLevel) : "view");

export const grantSchema = map(z.object({
        id: z.string(),
        owner_user_id: text,
        grantee_user_id: text,
        access_level: accessLevel,
        can_view: flag,
        can_create: flag,
        can_edit_tasks: flag,
        can_ping: flag,
        owner_username: text,
        owner_fullname: text,
        grantee_username: text,
        grantee_fullname: text,
        created_at: text,
    }), (grant) => ({
        id: grant.id,
        ownerUserId: grant.owner_user_id,
        granteeUserId: grant.grantee_user_id,
        accessLevel: grant.access_level,
        canView: grant.can_view,
        canCreate: grant.can_create,
        canEditTasks: grant.can_edit_tasks,
        canPing: grant.can_ping,
        owner: { username: grant.owner_username, fullname: grant.owner_fullname },
        grantee: { username: grant.grantee_username, fullname: grant.grantee_fullname },
        createdAt: grant.created_at,
    }));
export type Grant = z.output<typeof grantSchema>;

export const grantsResponseSchema = map(z.object({ grants: z.nullish(z.array(grantSchema)) }), (data) => data.grants ?? []);
export const grantResponseSchema = map(z.object({ grant: grantSchema }), (data) => data.grant);

export const sharingUserSchema = z.object({ id: z.string(), username: text, fullname: text, email: text });
export type SharingUser = z.output<typeof sharingUserSchema>;
export const sharingUsersResponseSchema = map(z.object({ users: z.nullish(z.array(sharingUserSchema)) }), (data) => data.users ?? []);

export const invitationSchema = map(z.object({
        id: z.string(),
        grant_id: text,
        owner_user_id: text,
        owner_username: text,
        owner_fullname: text,
        access_level: accessLevel,
        read_at: optionalText,
        created_at: text,
    }), (item) => ({
        id: item.id,
        grantId: item.grant_id,
        ownerUserId: item.owner_user_id,
        owner: { username: item.owner_username, fullname: item.owner_fullname },
        accessLevel: item.access_level,
        readAt: item.read_at,
        createdAt: item.created_at,
    }));
export type Invitation = z.output<typeof invitationSchema>;
export const invitationsResponseSchema = map(z.object({ invitations: z.nullish(z.array(invitationSchema)) }), (data) => data.invitations ?? []);

export const inboxItemSchema = map(z.object({
        id: z.string(),
        task_id: text,
        task_title: text,
        sender_user_id: text,
        sender_username: text,
        sender_fullname: text,
        message: text,
        created_at: text,
        read_at: optionalText,
    }), (item) => ({
        id: item.id,
        taskId: item.task_id,
        taskTitle: item.task_title,
        senderUserId: item.sender_user_id,
        sender: { username: item.sender_username, fullname: item.sender_fullname },
        message: item.message,
        createdAt: item.created_at,
        readAt: item.read_at,
    }));
export type InboxItem = z.output<typeof inboxItemSchema>;
export const inboxResponseSchema = map(z.object({ items: z.nullish(z.array(inboxItemSchema)) }), (data) => data.items ?? []);

export const noteSchema = map(z.object({ id: z.string(), user_id: text, content: text, created_at: text, updated_at: text }), (note) => ({
        id: note.id,
        content: note.content,
        createdAt: note.created_at,
        updatedAt: note.updated_at,
    }));
export type Note = z.output<typeof noteSchema>;
export const notesResponseSchema = map(z.object({ notes: z.nullish(z.array(noteSchema)), date: text }), (data) => ({ notes: data.notes ?? [], date: data.date }));
export const noteResponseSchema = map(z.object({ note: noteSchema }), (data) => data.note);
export const notesHistoryResponseSchema = map(z.object({
        history: z.object({ from: text, to: text, days: z.nullish(z.array(z.object({ date: text, total: count }))) }),
    }), ({ history }) => ({ from: history.from, to: history.to, days: history.days ?? [] }));
export type NotesHistory = z.output<typeof notesHistoryResponseSchema>;

export const vapidKeySchema = map(z.object({ publicKey: z.optional(z.string()), public_key: z.optional(z.string()), key: z.optional(z.string()) }), (data) => data.publicKey ?? data.public_key ?? data.key ?? "");
