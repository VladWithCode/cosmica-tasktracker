import type {
    LegacyRepeatFrequency,
    Priority,
    ScheduleFrequency,
} from "@/types/schedule";

export type TaskCategory = "focus" | "wellness" | "movement" | "admin";

export type TaskPriorityValue = Priority;

export type TaskRepeatFrequency = LegacyRepeatFrequency;

export interface CreateTaskPayload {
    title: string;
    description: string;
    startTime: string;
    endTime: string;
    durationMinutes: number;
    priority: TaskPriorityValue;
    required: boolean;
    isRequired: boolean;
    repeating: boolean;
    repeatFrequency: TaskRepeatFrequency;
    repeatWeekdays: number[];
    repeatInterval: number;
    frequency: ScheduleFrequency;
    frequencyConfig: Record<string, unknown>;
    category: TaskCategory;
}
