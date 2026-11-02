import { api } from "./client";
import {
    dayTasksSchema,
    historyResponseSchema,
    metricsResponseSchema,
    progressResponseSchema,
    taskDetailResponseSchema,
    type DayTasks,
    type Priority,
    type TaskDetail,
    type TaskStatus,
} from "./schemas";

export function getTodayTasks(ownerUserId?: string): Promise<DayTasks> {
    return api("/api/v1/tasks/today", { query: { owner_user_id: ownerUserId }, schema: dayTasksSchema });
}

export function getDayTasks(date: string, ownerUserId?: string): Promise<DayTasks> {
    return api("/api/v1/tasks/day", { query: { date, owner_user_id: ownerUserId }, schema: dayTasksSchema });
}

export async function getTask(id: string): Promise<TaskDetail> {
    return (await api(`/api/v1/tasks/${encodeURIComponent(id)}`, { schema: taskDetailResponseSchema })).task;
}

export async function getProgress(date?: string) {
    return (await api("/api/v1/tasks/progress", { query: { date }, schema: progressResponseSchema })).progress;
}

export function getHistory(from: string, to: string) {
    return api("/api/v1/tasks/history", { query: { from, to }, schema: historyResponseSchema });
}

export function getMetrics(from: string, to: string) {
    return api("/api/v1/tasks/metrics", { query: { from, to }, schema: metricsResponseSchema });
}

export type TaskUpdate = {
    status?: TaskStatus;
    currentCount?: number;
    notes?: string;
    actualStart?: string;
    actualEnd?: string;
    title?: string;
    description?: string;
    startTime?: string;
    endTime?: string;
    durationMinutes?: number;
    targetCount?: number;
    priority?: Priority;
    isRequired?: boolean;
    category?: string;
    applyToSchedule?: boolean;
};

export function toTaskUpdateBody(update: TaskUpdate): Record<string, unknown> {
    const body: Record<string, unknown> = {
        status_level: update.status,
        current_count: update.currentCount,
        notes: update.notes,
        actualStart: update.actualStart,
        actualEnd: update.actualEnd,
        title: update.title,
        description: update.description,
        schedule_start_time: update.startTime,
        schedule_end_time: update.endTime,
        duration_minutes: update.durationMinutes,
        target_count: update.targetCount,
        priority_level: update.priority,
        is_required: update.isRequired,
        category: update.category,
        apply_to_schedule: update.applyToSchedule,
    };
    return Object.fromEntries(Object.entries(body).filter(([, value]) => value !== undefined));
}

export async function updateTask(id: string, update: TaskUpdate): Promise<TaskDetail> {
    const response = await api(`/api/v1/tasks/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: toTaskUpdateBody(update),
        schema: taskDetailResponseSchema,
    });
    return response.task;
}

export async function deleteTask(id: string): Promise<void> {
    await api(`/api/v1/tasks/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function pingTask(id: string, message: string): Promise<void> {
    await api(`/api/v1/tasks/${encodeURIComponent(id)}/ping`, { method: "POST", body: { message } });
}

export type OneOffTaskInput = {
    title: string;
    description?: string;
    date: string;
    startTime?: string;
    endTime?: string;
    durationMinutes?: number;
    targetCount?: number;
    priority: Priority;
    isRequired: boolean;
    category?: string;
};

function literalUtc(date: string, clock = "00:00"): string {
    return `${date}T${clock}:00Z`;
}

export function toOneOffBody(input: OneOffTaskInput): Record<string, unknown> {
    const body: Record<string, unknown> = {
        title: input.title,
        description: input.description,
        startDate: literalUtc(input.date),
        startTime: input.startTime ? literalUtc(input.date, input.startTime) : undefined,
        endTime: input.endTime ? literalUtc(input.date, input.endTime) : undefined,
        durationMinutes: input.durationMinutes,
        targetCount: input.targetCount,
        priority: input.priority,
        isRequired: input.isRequired,
        required: input.isRequired,
        category: input.category,
        repeating: false,
        frequency: "custom",
        frequencyConfig: { singleInstance: true },
    };
    return Object.fromEntries(Object.entries(body).filter(([, value]) => value !== undefined));
}

export async function createOneOffTask(input: OneOffTaskInput): Promise<TaskDetail> {
    const response = await api("/api/v1/tasks", {
        method: "POST",
        body: toOneOffBody(input),
        schema: taskDetailResponseSchema,
    });
    return response.task;
}
