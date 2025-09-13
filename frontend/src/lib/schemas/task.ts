export type TTaskStatus = "pending" | "completed" | "overdue" | "cancelled";

// Smaller numbers are higher priority
export type TTaskPriority = 0 | 1 | 2 | 3 | 4 | 5;

export type TTask = {
    id: string;
    userId: string;
    scheduleTaskId: string;
    title: string;
    description: string | null;
    date: Date;
    status: TTaskStatus;
    priority: TTaskPriority;
    completedAt: Date | null;
    startTime: Date | null;
    endTime: Date | null;
    duration: number | null;

    createdAt: Date;
    updatedAt: Date;
};
