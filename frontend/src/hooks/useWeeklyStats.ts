import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { TTask } from "@/lib/schemas/task";
import { getTasksOpts } from "@/queries/tasks";

const WEEKLY_GOAL_PERCENT = 80;
const WEEK_DAYS = ["L", "M", "X", "J", "V", "S", "D"] as const;

export interface DailyStat {
    label: string;
    date: Date;
    total: number;
    onTime: number;
    late: number;
    completed: number;
    failed: number;
    completionPercent: number;
    onTimePercent: number;
    latePercent: number;
    failedPercent: number;
}

export interface WeeklyStats {
    weekLabel: string;
    onTimePercent: number;
    latePercent: number;
    failedPercent: number;
    completionPercent: number;
    weeklyGoalPercent: number;
    dailyStats: DailyStat[];
    consistencyPercent: number;
    consistencyDelta: number;
    averageDelayMinutes: number;
    averageDelayDeltaMinutes: number;
    totalTasks: number;
}

export function useWeeklyStats() {
    const query = useQuery(getTasksOpts);

    const stats = useMemo(() => {
        return query.data?.tasks ? buildWeeklyStats(query.data.tasks, new Date()) : null;
    }, [query.data?.tasks]);

    return {
        ...query,
        data: stats,
    };
}

function buildWeeklyStats(tasks: TTask[], now: Date): WeeklyStats {
    const weekStart = startOfWeek(now);
    const weekEnd = endOfWeek(weekStart);
    const previousWeekStart = addDays(weekStart, -7);
    const previousWeekEnd = addDays(weekEnd, -7);
    const weekTasks = filterTasksByRange(tasks, weekStart, weekEnd);
    const previousWeekTasks = filterTasksByRange(tasks, previousWeekStart, previousWeekEnd);
    const completedTasks = weekTasks.filter(isCompleted);
    const failedTasks = weekTasks.filter((task) => isFailed(task, now));
    const lateCompletedTasks = completedTasks.filter((task) => getDelayMinutes(task) > 0);
    const onTimeCompletedTasks = completedTasks.filter((task) => getDelayMinutes(task) === 0);
    const resolvedCount = onTimeCompletedTasks.length + lateCompletedTasks.length + failedTasks.length;
    const dailyStats = buildDailyStats(weekTasks, weekStart, now);
    const previousDailyStats = buildDailyStats(previousWeekTasks, previousWeekStart, now);
    const consistencyPercent = getConsistencyPercent(dailyStats);
    const previousConsistencyPercent = getConsistencyPercent(previousDailyStats);
    const averageDelayMinutes = getAverageDelayMinutes(lateCompletedTasks);
    const previousAverageDelayMinutes = getAverageDelayMinutes(
        previousWeekTasks.filter((task) => isCompleted(task) && getDelayMinutes(task) > 0),
    );

    return {
        weekLabel: formatWeekRange(weekStart, weekEnd),
        onTimePercent: toPercent(onTimeCompletedTasks.length, resolvedCount),
        latePercent: toPercent(lateCompletedTasks.length, resolvedCount),
        failedPercent: toPercent(failedTasks.length, resolvedCount),
        completionPercent: toPercent(completedTasks.length, weekTasks.length),
        weeklyGoalPercent: WEEKLY_GOAL_PERCENT,
        dailyStats,
        consistencyPercent,
        consistencyDelta: consistencyPercent - previousConsistencyPercent,
        averageDelayMinutes,
        averageDelayDeltaMinutes: averageDelayMinutes - previousAverageDelayMinutes,
        totalTasks: weekTasks.length,
    };
}

function buildDailyStats(tasks: TTask[], weekStart: Date, now: Date): DailyStat[] {
    return WEEK_DAYS.map((label, dayIndex) => {
        const date = addDays(weekStart, dayIndex);
        const dayTasks = tasks.filter((task) => isSameDate(task.date, date));
        const completedTasks = dayTasks.filter(isCompleted);
        const onTime = completedTasks.filter((task) => getDelayMinutes(task) === 0).length;
        const late = completedTasks.filter((task) => getDelayMinutes(task) > 0).length;
        const completed = completedTasks.length;
        const failed = dayTasks.filter((task) => isFailed(task, now)).length;
        const resolved = onTime + late + failed;

        return {
            label,
            date,
            total: dayTasks.length,
            onTime,
            late,
            completed,
            failed,
            completionPercent: toPercent(completed, dayTasks.length),
            onTimePercent: toPercent(onTime, resolved),
            latePercent: toPercent(late, resolved),
            failedPercent: toPercent(failed, resolved),
        };
    });
}

function filterTasksByRange(tasks: TTask[], start: Date, end: Date) {
    return tasks.filter((task) => task.date >= start && task.date <= end);
}

function startOfWeek(date: Date) {
    const nextDate = new Date(date);
    nextDate.setHours(0, 0, 0, 0);
    const day = nextDate.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    nextDate.setDate(nextDate.getDate() + mondayOffset);
    return nextDate;
}

function endOfWeek(weekStart: Date) {
    const nextDate = addDays(weekStart, 6);
    nextDate.setHours(23, 59, 59, 999);
    return nextDate;
}

function addDays(date: Date, days: number) {
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + days);
    return nextDate;
}

function isSameDate(first: Date, second: Date) {
    return (
        first.getFullYear() === second.getFullYear() &&
        first.getMonth() === second.getMonth() &&
        first.getDate() === second.getDate()
    );
}

function isCompleted(task: TTask) {
    return task.status === "completed" || task.completedAt !== null;
}

function isFailed(task: TTask, now: Date) {
    if (task.status === "cancelled" || task.status === "overdue") {
        return true;
    }

    if (isCompleted(task)) {
        return false;
    }

    const dueAt = task.endTime ? mergeDateAndTime(task.date, task.endTime) : endOfDate(task.date);
    return dueAt.getTime() < now.getTime();
}

function mergeDateAndTime(date: Date, time: Date) {
    const dueAt = new Date(date);
    dueAt.setHours(time.getHours(), time.getMinutes(), time.getSeconds(), time.getMilliseconds());
    return dueAt;
}

function endOfDate(date: Date) {
    const dueAt = new Date(date);
    dueAt.setHours(23, 59, 59, 999);
    return dueAt;
}

function getDelayMinutes(task: TTask) {
    if (!task.completedAt || !task.endTime) {
        return 0;
    }

    const delay = minutesOfDay(task.completedAt) - minutesOfDay(task.endTime);
    return Math.max(0, delay);
}

function minutesOfDay(date: Date) {
    return date.getHours() * 60 + date.getMinutes();
}

function getAverageDelayMinutes(tasks: TTask[]) {
    if (tasks.length === 0) {
        return 0;
    }

    const totalDelay = tasks.reduce((sum, task) => sum + getDelayMinutes(task), 0);
    return Math.round(totalDelay / tasks.length);
}

function getConsistencyPercent(dailyStats: DailyStat[]) {
    const daysWithTasks = dailyStats.filter((day) => day.total > 0);
    if (daysWithTasks.length === 0) {
        return 0;
    }

    const consistentDays = daysWithTasks.filter(
        (day) => day.completionPercent >= WEEKLY_GOAL_PERCENT,
    );
    return toPercent(consistentDays.length, daysWithTasks.length);
}

function toPercent(value: number, total: number) {
    if (total === 0) {
        return 0;
    }

    return Math.round((value / total) * 100);
}

function formatWeekRange(start: Date, end: Date) {
    const formatter = new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
    });

    return `${formatter.format(start)} - ${formatter.format(end)}`;
}
