import { api } from "./client";
import { scheduleResponseSchema, schedulesResponseSchema, type Priority, type RepeatFrequency, type Schedule } from "./schemas";

export type ScheduleInput = {
    title: string;
    description?: string;
    startDate?: string;
    endDate?: string;
    startTime?: string;
    endTime?: string;
    durationMinutes?: number;
    targetCount?: number;
    repeatFrequency: RepeatFrequency;
    repeatWeekdays?: number[];
    repeatInterval?: number;
    priority: Priority;
    isRequired: boolean;
    category?: string;
    frequencyConfig?: Record<string, unknown>;
    ownerUserId?: string;
};

const frequencyFor: Record<RepeatFrequency, string> = {
    daily: "daily",
    weekly: "weekly",
    biweekly: "weekly",
    monthly: "monthly",
    bimonthly: "monthly",
    yearly: "custom",
};

export function toScheduleBody(input: ScheduleInput): Record<string, unknown> {
    const body: Record<string, unknown> = {
        title: input.title,
        description: input.description ?? "",
        start_date: input.startDate,
        end_date: input.endDate,
        schedule_start_time: input.startTime ?? null,
        schedule_end_time: input.endTime ?? null,
        duration_minutes: input.durationMinutes ?? null,
        target_count: input.targetCount ?? null,
        repeating: true,
        repeatFrequency: input.repeatFrequency,
        repeatWeekdays: input.repeatWeekdays ?? [],
        repeatInterval: Math.max(1, input.repeatInterval ?? 1),
        frequency: frequencyFor[input.repeatFrequency],
        frequency_config: input.frequencyConfig ?? {},
        priority_level: input.priority,
        is_required: input.isRequired,
        category: input.category ?? "",
        owner_user_id: input.ownerUserId,
    };
    return Object.fromEntries(Object.entries(body).filter(([, value]) => value !== undefined));
}

export function getSchedules(ownerUserId?: string): Promise<Schedule[]> {
    return api("/api/v1/schedules", { query: { owner_user_id: ownerUserId }, schema: schedulesResponseSchema });
}

export function getSchedule(id: string): Promise<Schedule> {
    return api(`/api/v1/schedules/${encodeURIComponent(id)}`, { schema: scheduleResponseSchema });
}

export function createSchedule(input: ScheduleInput): Promise<Schedule> {
    return api("/api/v1/schedules", { method: "POST", body: toScheduleBody(input), schema: scheduleResponseSchema });
}

export function updateSchedule(id: string, input: ScheduleInput): Promise<Schedule> {
    return api(`/api/v1/schedules/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: toScheduleBody(input),
        schema: scheduleResponseSchema,
    });
}

export function setSchedulePaused(id: string, paused: boolean): Promise<Schedule> {
    return api(`/api/v1/schedules/${encodeURIComponent(id)}/${paused ? "pause" : "resume"}`, {
        method: "POST",
        schema: scheduleResponseSchema,
    });
}

export async function cancelSchedule(id: string): Promise<void> {
    await api(`/api/v1/schedules/${encodeURIComponent(id)}`, { method: "DELETE" });
}
