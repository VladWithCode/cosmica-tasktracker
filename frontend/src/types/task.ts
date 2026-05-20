import type { LegacyPriority, ScheduleFrequency } from "./schedule";

/** Re-export as Priority for backward compat — includes legacy "high"/"low" for display. */
export type Priority = LegacyPriority;

export type TaskStatus = "pending" | "in_progress" | "completed" | "skipped" | "failed";

export interface Task {
    id: string;
    userId: string;
    scheduleTaskId: string;
    title: string;
    description: string | null;
    date: Date;
    status: TaskStatus;
    priority: Priority;
    completedAt: Date | null;
    actualStart: Date | null;
    actualEnd: Date | null;
    startTime: Date | null;
    endTime: Date | null;
    startDate: Date | null;
    endDate: Date | null;
    duration: number | null;
    currentCount: number;
    targetCount: number | null;
    notes: string | null;
    frequency: ScheduleFrequency | null;
    category: string | null;
    required: boolean;
    isRequired: boolean;
    canEdit?: boolean;
    canApplyToSchedule?: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface TaskFeedItem {
    completed_at?: string | null;
    created_at: string;
    current_count: number;
    description?: string;
    duration_minutes?: number | null;
    id: string;
    is_required: boolean;
    priority_level: Priority;
    schedule_end_time?: string | null;
    schedule_id: string;
    schedule_start_time?: string | null;
    status_level: TaskStatus;
    target_count?: number | null;
    title: string;
}

export interface TaskHistoryDay {
    date: string;
    total: number;
    completed: number;
    pending: number;
    skipped: number;
    failed: number;
    in_progress: number;
    percentage: number;
}

export interface TaskHistoryRange {
    from: string;
    to: string;
    days: TaskHistoryDay[];
}

export interface TaskMetricsBestDay {
    date: string;
    percentage: number;
}

export interface TaskMetricsRange {
    from: string;
    to: string;
    total: number;
    completed: number;
    pending: number;
    skipped: number;
    failed: number;
    in_progress: number;
    percentage: number;
    days_count: number;
    completions_count: number;
    active_days: number;
    best_day?: TaskMetricsBestDay | null;
    current_streak: number;
}

export interface TaskStatsRangeInput {
    from: string;
    to: string;
}

export interface UpdateTaskInput {
    apply_to_schedule?: boolean;
    date?: string;
    status?: TaskStatus;
    taskId: string;
    actualStart?: string;
    actualEnd?: string;
    currentCount?: number;
    targetCount?: number | null;
    notes?: string;
    title?: string;
    description?: string;
    priority_level?: Priority;
    is_required?: boolean;
    schedule_start_time?: string;
    schedule_end_time?: string;
    duration_minutes?: number | null;
    frequency?: ScheduleFrequency;
}
