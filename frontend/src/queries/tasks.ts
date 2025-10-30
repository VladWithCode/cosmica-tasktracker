import type { TTask } from "@/lib/schemas/task";
import { queryOptions } from "@tanstack/react-query";

export const TasksQueryKeys = {
    all: () => ["tasks"] as const,
    listing: () => [...TasksQueryKeys.all(), "listing"] as const,
    today: () => [...TasksQueryKeys.listing(), "today"] as const,
    history: () => [...TasksQueryKeys.listing(), "history"] as const,

    detail: () => [...TasksQueryKeys.all(), "detail"] as const,
    byId: () => [...TasksQueryKeys.detail(), "byId"] as const,
} as const;

export const getTasksOpts = queryOptions({
    queryKey: TasksQueryKeys.all(),
    queryFn: getTasks,
});

export const getTodayTasksOpts = queryOptions({
    queryKey: TasksQueryKeys.today(),
    queryFn: getTodayTasks,
    staleTime: 15 * 60 * 1000, // 15 minutes
});

export async function getTasks() {
    const response = await fetch("/api/v1/tasks", {
        method: "GET",
        credentials: "include",
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || "Error al obtener tareas");
    }
    let tasks: TTask[] = data.tasks ? data.tasks.map(hydrateTask) : [];

    return { tasks };
}

export async function getTodayTasks() {
    const response = await fetch("/api/v1/tasks/today", {
        method: "GET",
        credentials: "include",
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || "Error al obtener tareas");
    }
    let tasks: TTask[] = data.tasks ? data.tasks.map(hydrateTask) : [];

    return { tasks };
}

export function hydrateTask(task: Partial<TTask>): TTask {
    return {
        ...task,
        date: new Date(task.date!),
        startTime: task.startTime ? new Date(task.startTime) : null,
        endTime: task.endTime ? new Date(task.endTime) : null,
        endDate: task.endDate ? new Date(task.endDate) : null,
        completedAt: task.completedAt ? new Date(task.completedAt) : null,
        createdAt: new Date(task.createdAt!),
        updatedAt: new Date(task.updatedAt!),
    } as TTask;
}
