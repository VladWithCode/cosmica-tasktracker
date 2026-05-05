import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getTaskHistoryOpts, getTaskMetricsOpts } from "@/queries/tasks";
import type { TaskHistoryDay, TaskStatsRangeInput } from "@/types/task";

export interface DailyStat {
    label: string;
    date: Date;
    total: number;
    completed: number;
    pending: number;
    skipped: number;
    failed: number;
    inProgress: number;
    completionPercent: number;
}

export interface WeeklyStats {
    activeDays: number;
    bestDay: {
        date: string;
        percentage: number;
    } | null;
    completed: number;
    completionPercent: number;
    completionsCount: number;
    currentStreak: number;
    dailyStats: DailyStat[];
    daysCount: number;
    failed: number;
    from: string;
    inProgress: number;
    pending: number;
    rangeLabel: string;
    skipped: number;
    to: string;
    totalTasks: number;
}

export function useWeeklyStats() {
    const range = useMemo(() => getDefaultStatsRange(), []);
    const historyQuery = useQuery(getTaskHistoryOpts(range));
    const metricsQuery = useQuery(getTaskMetricsOpts(range));

    const stats = useMemo(() => {
        if (!historyQuery.data || !metricsQuery.data) {
            return null;
        }

        return {
            activeDays: metricsQuery.data.active_days,
            bestDay: metricsQuery.data.best_day ?? null,
            completed: metricsQuery.data.completed,
            completionPercent: metricsQuery.data.percentage,
            completionsCount: metricsQuery.data.completions_count,
            currentStreak: metricsQuery.data.current_streak,
            dailyStats: historyQuery.data.days.map(toDailyStat),
            daysCount: metricsQuery.data.days_count,
            failed: metricsQuery.data.failed,
            from: metricsQuery.data.from,
            inProgress: metricsQuery.data.in_progress,
            pending: metricsQuery.data.pending,
            rangeLabel: formatRangeLabel(metricsQuery.data.from, metricsQuery.data.to),
            skipped: metricsQuery.data.skipped,
            to: metricsQuery.data.to,
            totalTasks: metricsQuery.data.total,
        } satisfies WeeklyStats;
    }, [historyQuery.data, metricsQuery.data]);

    return {
        data: stats,
        error: historyQuery.error ?? metricsQuery.error,
        isError: historyQuery.isError || metricsQuery.isError,
        isLoading: historyQuery.isLoading || metricsQuery.isLoading,
        refetch: () => {
            void historyQuery.refetch();
            void metricsQuery.refetch();
        },
    };
}

function getDefaultStatsRange(): TaskStatsRangeInput {
    const to = toDateOnly(new Date());
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - 6);

    return {
        from: toDateOnly(fromDate),
        to,
    };
}

function toDailyStat(day: TaskHistoryDay): DailyStat {
    return {
        label: formatDayLabel(day.date),
        date: parseDateOnly(day.date),
        total: day.total,
        completed: day.completed,
        pending: day.pending,
        skipped: day.skipped,
        failed: day.failed,
        inProgress: day.in_progress,
        completionPercent: day.percentage,
    };
}

function toDateOnly(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function parseDateOnly(value: string) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
}

function formatDayLabel(value: string) {
    const formatter = new Intl.DateTimeFormat("es-MX", {
        weekday: "short",
    });
    return formatter.format(parseDateOnly(value)).replace(".", "").toUpperCase();
}

function formatRangeLabel(from: string, to: string) {
    const formatter = new Intl.DateTimeFormat("es-MX", {
        day: "numeric",
        month: "short",
    });
    return `${formatter.format(parseDateOnly(from))} - ${formatter.format(parseDateOnly(to))}`;
}
