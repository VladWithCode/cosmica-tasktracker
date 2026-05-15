import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { TTask } from "@/lib/schemas/task";
import { getTasksOpts } from "@/queries/tasks";

export interface ProfileStats {
    focusHours: number;
    goalPercent: number;
    streakDays: number;
    totalTasks: number;
}

export function useProfileStats() {
    const query = useQuery(getTasksOpts);
    const stats = useMemo(
        () => buildProfileStats(query.data?.tasks ?? [], new Date()),
        [query.data?.tasks],
    );

    return {
        ...query,
        data: stats,
    };
}

function buildProfileStats(tasks: TTask[], now: Date): ProfileStats {
    const completedTasks = tasks.filter(isCompleted);
    const totalFocusMinutes = completedTasks.reduce(
        (sum, task) => sum + getTaskDurationMinutes(task),
        0,
    );

    return {
        focusHours: Math.round(totalFocusMinutes / 60),
        goalPercent: toPercent(completedTasks.length, tasks.length),
        streakDays: getCompletionStreak(tasks, now),
        totalTasks: tasks.length,
    };
}

function isCompleted(task: TTask) {
    return task.status === "completed" || task.completedAt !== null;
}

function getTaskDurationMinutes(task: TTask) {
    if (task.duration !== null) {
        return task.duration;
    }

    if (!task.startTime || !task.endTime) {
        return 0;
    }

    const duration = minutesOfDay(task.endTime) - minutesOfDay(task.startTime);
    return Math.max(0, duration);
}

function getCompletionStreak(tasks: TTask[], now: Date) {
    let streak = 0;
    const cursor = new Date(now);
    cursor.setHours(0, 0, 0, 0);

    while (true) {
        const dayTasks = tasks.filter((task) => isSameDate(task.date, cursor));
        const hasCompletedTask = dayTasks.some(isCompleted);
        const hasOpenTask = dayTasks.some((task) => !isCompleted(task));

        if (!hasCompletedTask || hasOpenTask) {
            break;
        }

        streak += 1;
        cursor.setDate(cursor.getDate() - 1);
    }

    return streak;
}

function isSameDate(first: Date, second: Date) {
    return (
        first.getFullYear() === second.getFullYear() &&
        first.getMonth() === second.getMonth() &&
        first.getDate() === second.getDate()
    );
}

function minutesOfDay(date: Date) {
    return date.getHours() * 60 + date.getMinutes();
}

function toPercent(value: number, total: number) {
    if (total === 0) {
        return 0;
    }

    return Math.round((value / total) * 100);
}
