import type { TaskItem, TaskStatus } from "@/api/schemas";
import { formatClock, minutesOfDay } from "./date";

export type SectionId = "required" | "morning" | "afternoon" | "evening" | "anytime";

export type TaskSection = { id: SectionId; title: string; tasks: TaskItem[] };

const sectionTitles: Record<SectionId, string> = {
    required: "Imprescindibles",
    morning: "Mañana",
    afternoon: "Tarde",
    evening: "Noche",
    anytime: "Cualquier hora",
};

const sectionOrder: SectionId[] = ["required", "morning", "afternoon", "evening", "anytime"];

export function isDone(status: TaskStatus): boolean {
    return status === "completed" || status === "skipped" || status === "failed";
}

function sectionFor(task: TaskItem): SectionId {
    if (task.isRequired) return "required";
    if (!task.startTime) return "anytime";
    const minutes = minutesOfDay(task.startTime);
    if (minutes < 12 * 60) return "morning";
    if (minutes < 19 * 60) return "afternoon";
    return "evening";
}

export function compareTasks(a: TaskItem, b: TaskItem): number {
    if (a.startTime && b.startTime && a.startTime !== b.startTime) return a.startTime < b.startTime ? -1 : 1;
    if (a.startTime && !b.startTime) return -1;
    if (!a.startTime && b.startTime) return 1;
    if (a.priority !== b.priority) return a.priority === "urgent" ? -1 : 1;
    return a.title.localeCompare(b.title, "es");
}

export function pendingVital(tasks: TaskItem[]): TaskItem[] {
    return tasks.filter((task) => task.isRequired && !isDone(task.status)).sort(compareTasks);
}

export function groupTasks(tasks: TaskItem[], options: { vitalSeparately?: boolean } = {}): { sections: TaskSection[]; done: TaskItem[] } {
    const buckets = new Map<SectionId, TaskItem[]>();
    const done: TaskItem[] = [];
    for (const task of tasks) {
        if (isDone(task.status)) {
            done.push(task);
            continue;
        }
        if (options.vitalSeparately && task.isRequired) continue;
        const id = sectionFor(task);
        buckets.set(id, [...(buckets.get(id) ?? []), task]);
    }
    const sections = sectionOrder
        .filter((id) => buckets.has(id))
        .map((id) => ({ id, title: sectionTitles[id], tasks: (buckets.get(id) ?? []).sort(compareTasks) }));
    return { sections, done: done.sort(compareTasks) };
}

export type DaySummary = { total: number; completed: number; percentage: number; required: number; requiredCompleted: number };

export function summarize(tasks: TaskItem[]): DaySummary {
    const completed = tasks.filter((task) => task.status === "completed").length;
    const required = tasks.filter((task) => task.isRequired);
    return {
        total: tasks.length,
        completed,
        percentage: tasks.length ? Math.round((completed * 1000) / tasks.length) / 10 : 0,
        required: required.length,
        requiredCompleted: required.filter((task) => task.status === "completed").length,
    };
}

export function scheduleLabel(task: Pick<TaskItem, "startTime" | "endTime" | "durationMinutes">): string {
    const parts: string[] = [];
    if (task.startTime) parts.push(task.endTime ? `${formatClock(task.startTime)} – ${formatClock(task.endTime)}` : formatClock(task.startTime));
    if (task.durationMinutes && !task.endTime) parts.push(formatDuration(task.durationMinutes));
    return parts.join(" · ") || "Cualquier hora";
}

export function formatDuration(minutes: number): string {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

export const statusLabels: Record<TaskStatus, string> = {
    pending: "Pendiente",
    in_progress: "En curso",
    completed: "Completada",
    skipped: "Omitida",
    failed: "Fallida",
};

export function statusForCount(count: number, target: number | null, current: TaskStatus): TaskStatus {
    if (target === null) return current;
    if (count >= target) return "completed";
    if (current === "completed") return count > 0 ? "in_progress" : "pending";
    return current;
}
