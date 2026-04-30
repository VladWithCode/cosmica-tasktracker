export type TaskCategory = "focus" | "wellness" | "movement" | "admin";

export type TaskPriorityValue = 0 | 1 | 2 | 3;

export type TaskRepeatFrequency =
    | ""
    | "daily"
    | "weekly"
    | "biweekly"
    | "monthly"
    | "bimonthly"
    | "yearly";

export interface CreateTaskPayload {
    title: string;
    description: string;
    startTime: string;
    endTime: string;
    priority: TaskPriorityValue;
    required: boolean;
    repeating: boolean;
    repeatFrequency: TaskRepeatFrequency;
    repeatWeekdays: number[];
    repeatInterval: number;
}
