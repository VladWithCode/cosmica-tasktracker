export interface TaskCompletion {
    id: string;
    taskId: string;
    userId: string;
    completedAt: string;
    actualStart: string | null;
    actualEnd: string | null;
    count: number;
    notes: string | null;
}
