import type { RepeatFrequency, Schedule } from "@/api/schemas";
import type { CreateValues } from "@/features/create/createForm";
import { weekdayOptions } from "./repeat";
import { formatClock, todayISO } from "./date";
import { formatDuration } from "./tasks";

export function isOneOffSchedule(schedule: Schedule): boolean {
    return schedule.frequencyConfig.singleInstance === true || schedule.frequency === "custom";
}

export function isWaterSchedule(schedule: Pick<Schedule, "frequencyConfig">): boolean {
    return "waterUnit" in schedule.frequencyConfig || "waterReminder" in schedule.frequencyConfig;
}

const repeatLabels: Record<RepeatFrequency, string> = {
    daily: "Diario",
    weekly: "Semanal",
    biweekly: "Cada 2 semanas",
    monthly: "Mensual",
    bimonthly: "Cada 2 meses",
    yearly: "Anual",
};

const intervalNouns: Partial<Record<RepeatFrequency, string>> = { daily: "días", weekly: "semanas", monthly: "meses" };

export function repeatSummary(schedule: Schedule): string {
    const parts: string[] = [];
    const frequency = schedule.repeatFrequency;
    if (frequency) {
        const noun = intervalNouns[frequency];
        parts.push(noun && schedule.repeatInterval > 1 ? `Cada ${schedule.repeatInterval} ${noun}` : repeatLabels[frequency]);
        if ((frequency === "weekly" || frequency === "biweekly") && schedule.repeatWeekdays.length) {
            const days = weekdayOptions.filter((day) => schedule.repeatWeekdays.includes(day.value));
            parts[0] = days.length === 7 ? "Todos los días" : days.map((day) => day.short).join(" ");
            if (frequency === "biweekly") parts[0] = `${parts[0]} · cada 2 semanas`;
            if (frequency === "weekly" && schedule.repeatInterval > 1) parts[0] = `${parts[0]} · cada ${schedule.repeatInterval} semanas`;
        }
    }
    if (schedule.startTime) parts.push(formatClock(schedule.startTime));
    if (schedule.durationMinutes && !schedule.endTime) parts.push(formatDuration(schedule.durationMinutes));
    return parts.join(" · ") || "Sin horario";
}

export function goalSummary(schedule: Schedule): string | null {
    if (schedule.targetCount === null) return null;
    return isWaterSchedule(schedule) ? `${schedule.targetCount} L` : `${schedule.targetCount} veces`;
}

export function scheduleToValues(schedule: Schedule): CreateValues {
    const water = isWaterSchedule(schedule);
    const timeMode = schedule.startTime ? "time" : schedule.durationMinutes ? "duration" : "anytime";
    return {
        kind: "routine",
        title: schedule.title,
        description: schedule.description,
        date: schedule.startDate ?? todayISO(),
        hasEndDate: Boolean(schedule.endDate),
        endDate: schedule.endDate ?? "",
        timeMode,
        startTime: schedule.startTime ?? "",
        endTime: schedule.endTime ?? "",
        durationMinutes: schedule.durationMinutes ? String(schedule.durationMinutes) : "",
        repeat: schedule.repeatFrequency ?? "daily",
        weekdays: schedule.repeatWeekdays,
        interval: Math.max(1, schedule.repeatInterval),
        goal: schedule.targetCount === null ? "none" : water ? "water" : "count",
        targetCount: schedule.targetCount === null ? "" : String(schedule.targetCount),
        waterReminder: schedule.frequencyConfig.waterReminder === true,
        urgent: schedule.priority === "urgent",
        isRequired: schedule.isRequired,
        category: schedule.category,
        ownerId: "",
    };
}

export function compareSchedules(a: Schedule, b: Schedule): number {
    if (a.startTime && b.startTime && a.startTime !== b.startTime) return a.startTime < b.startTime ? -1 : 1;
    if (a.startTime && !b.startTime) return -1;
    if (!a.startTime && b.startTime) return 1;
    return a.title.localeCompare(b.title, "es");
}
