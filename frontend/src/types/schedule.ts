export type Priority = "urgent" | "high" | "medium" | "low";

export type ScheduleFrequency = "daily" | "weekly" | "monthly" | "custom";

export type ScheduleStatus = "active" | "paused" | "cancelled";

export type LegacyRepeatFrequency =
    | ""
    | "daily"
    | "weekly"
    | "biweekly"
    | "monthly"
    | "bimonthly"
    | "yearly";

export interface Schedule {
    id: string;
    userId: string;
    createdBy: string;
    title: string;
    description: string;
    startTime: string | null;
    endTime: string | null;
    startDate: string | null;
    endDate: string | null;
    duration: number;
    durationMinutes: number;
    targetCount: number | null;
    required: boolean;
    isRequired: boolean;
    repeating: boolean;
    repeatFrequency: LegacyRepeatFrequency;
    repeatWeekdays: number[];
    repeatInterval: number;
    repeatEndDate: string | null;
    frequency: ScheduleFrequency;
    frequencyConfig: Record<string, unknown>;
    category: string;
    status: ScheduleStatus;
    priority: Priority;
    createdAt: string;
    updatedAt: string;
}

export interface CreateScheduleInput {
    title: string;
    description?: string;
    schedule_start_time?: string | null;
    schedule_end_time?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    duration_minutes?: number | null;
    target_count?: number | null;
    required?: boolean;
    is_required?: boolean;
    repeating?: boolean;
    repeatFrequency?: LegacyRepeatFrequency;
    repeatWeekdays?: number[];
    repeatInterval?: number;
    frequency?: ScheduleFrequency;
    frequency_config?: Record<string, unknown>;
    category?: string;
    status?: ScheduleStatus;
    priority_level?: Priority;
}

export type UpdateScheduleInput = Partial<CreateScheduleInput>;
