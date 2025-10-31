import type { TTask } from "@/lib/schemas/task";
import { mutationOptions, queryOptions } from "@tanstack/react-query";
import { queryClient } from "./queryClient";

export const TasksQueryKeys = {
    all: () => ["tasks"] as const,
    listing: () => [...TasksQueryKeys.all(), "listing"] as const,
    today: () => [...TasksQueryKeys.listing(), "today"] as const,
    history: () => [...TasksQueryKeys.listing(), "history"] as const,

    detail: () => [...TasksQueryKeys.all(), "detail"] as const,
    byId: (id: string) => [...TasksQueryKeys.detail(), "byId", id] as const,
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

// Mutations
export const markAsCompletedOpts = mutationOptions({
    mutationFn: markTaskAsCompleted,
    onSuccess: (_, variables) => {
        const { taskId } = variables;

        queryClient.invalidateQueries({
            queryKey: TasksQueryKeys.today(),
        });
        queryClient.invalidateQueries({
            queryKey: TasksQueryKeys.byId(taskId),
        });
    },
})
export async function markTaskAsCompleted({ taskId }: { taskId: string }) {
    const response = await fetch(`/api/v1/tasks/${taskId}`, {
        method: "PUT",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            status: "completed",
        }),
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || "Error al marcar tarea como completada");
    }
    return data;
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
