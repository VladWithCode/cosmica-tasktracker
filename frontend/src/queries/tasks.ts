import type { TTask } from "@/lib/schemas/task";
import type {
    TaskFeedItem,
    TaskHistoryRange,
    TaskMetricsRange,
    TaskStatsRangeInput,
    UpdateTaskInput,
} from "@/types/task";
import { mutationOptions, queryOptions } from "@tanstack/react-query";
import { queryClient } from "./queryClient";
import type { ApiResponse } from "@/types/api";
import { getApiError } from "@/types/api";

export type UpdateTaskPayload = UpdateTaskInput;

interface TaskData {
    task: Partial<TTask>;
}

interface TasksData {
    date?: string;
    tasks: RawTaskResponse[];
}

type RawTaskResponse = Partial<TTask> &
    Partial<TaskFeedItem> & {
        completed_at?: string | null;
        canApplyToSchedule?: boolean;
        canEdit?: boolean;
        can_apply_to_schedule?: boolean;
        can_edit?: boolean;
        created_at?: string;
        current_count?: number;
        duration_minutes?: number | null;
        is_required?: boolean;
        priority_level?: string;
        schedule_end_time?: string | null;
        schedule_id?: string;
        schedule_start_time?: string | null;
        status_level?: string;
        target_count?: number | null;
    };

export const TasksQueryKeys = {
    all: () => ["tasks"] as const,
    listing: () => [...TasksQueryKeys.all(), "listing"] as const,
    today: () => [...TasksQueryKeys.listing(), "today"] as const,
    history: () => [...TasksQueryKeys.listing(), "history"] as const,

    detail: () => [...TasksQueryKeys.all(), "detail"] as const,
    byId: (id: string) => [...TasksQueryKeys.detail(), "byId", id] as const,

    progress: () => [...TasksQueryKeys.all(), "progress"] as const,
    progressByDate: (date: string) => [...TasksQueryKeys.progress(), date] as const,
} as const;

export interface DayProgress {
    date: string;
    total: number;
    completed: number;
    pending: number;
    skipped: number;
    failed: number;
    in_progress: number;
    percentage: number;
}

interface DayProgressData {
    progress: DayProgress;
}

interface TaskHistoryData {
    history: TaskHistoryRange;
}

interface TaskMetricsData {
    metrics: TaskMetricsRange;
}

export const getTasksOpts = queryOptions({
    queryKey: TasksQueryKeys.all(),
    queryFn: getTasks,
});

export const getTodayTasksOpts = queryOptions({
    queryKey: TasksQueryKeys.today(),
    queryFn: getTodayTasks,
    staleTime: 15 * 60 * 1000, // 15 minutes
});

export const getTodayProgressOpts = queryOptions({
    queryKey: TasksQueryKeys.progressByDate("today"),
    queryFn: getTodayProgress,
    staleTime: 60 * 1000,
});

export function getTaskHistoryOpts(range: TaskStatsRangeInput) {
    return queryOptions({
        queryKey: [...TasksQueryKeys.history(), range.from, range.to] as const,
        queryFn: () => getTaskHistory(range),
        staleTime: 60 * 1000,
    });
}

export function getTaskMetricsOpts(range: TaskStatsRangeInput) {
    return queryOptions({
        queryKey: [...TasksQueryKeys.progress(), "metrics", range.from, range.to] as const,
        queryFn: () => getTaskMetrics(range),
        staleTime: 60 * 1000,
    });
}

export async function getTodayProgress(): Promise<DayProgress> {
    const response = await fetch("/api/v1/tasks/progress", {
        method: "GET",
        credentials: "include",
    });
    const data = (await response.json()) as ApiResponse<DayProgressData>;
    if (!response.ok) {
        throw new Error(getApiError(data, "Error al obtener progreso"));
    }
    if (!data.data?.progress) {
        throw new Error("La respuesta no incluyó el progreso");
    }
    return data.data.progress;
}

export async function getTaskHistory(range: TaskStatsRangeInput): Promise<TaskHistoryRange> {
    const params = new URLSearchParams({
        from: range.from,
        to: range.to,
    });
    const response = await fetch(`/api/v1/tasks/history?${params.toString()}`, {
        method: "GET",
        credentials: "include",
    });
    const data = (await response.json()) as ApiResponse<TaskHistoryData>;
    if (!response.ok) {
        throw new Error(getApiError(data, "Error al obtener historial"));
    }
    if (!data.data?.history) {
        throw new Error("La respuesta no incluyó el historial");
    }
    return data.data.history;
}

export async function getTaskMetrics(range: TaskStatsRangeInput): Promise<TaskMetricsRange> {
    const params = new URLSearchParams({
        from: range.from,
        to: range.to,
    });
    const response = await fetch(`/api/v1/tasks/metrics?${params.toString()}`, {
        method: "GET",
        credentials: "include",
    });
    const data = (await response.json()) as ApiResponse<TaskMetricsData>;
    if (!response.ok) {
        throw new Error(getApiError(data, "Error al obtener métricas"));
    }
    if (!data.data?.metrics) {
        throw new Error("La respuesta no incluyó las métricas");
    }
    return data.data.metrics;
}

export function getTaskByIdOpts(taskId: string) {
    return queryOptions({
        queryKey: TasksQueryKeys.byId(taskId),
        queryFn: () => getTaskById(taskId),
        enabled: taskId.length > 0,
    });
}

export async function getTasks() {
    const response = await fetch("/api/v1/tasks", {
        method: "GET",
        credentials: "include",
    });
    const data = (await response.json()) as ApiResponse<TasksData>;
    if (!response.ok) {
        throw new Error(getApiError(data, "Error al obtener tareas"));
    }
    let tasks: TTask[] = data.data?.tasks ? data.data.tasks.map(hydrateTask) : [];

    return { tasks };
}

export async function getTodayTasks() {
    const response = await fetch("/api/v1/tasks/today", {
        method: "GET",
        credentials: "include",
    });
    const data = (await response.json()) as ApiResponse<TasksData>;
    if (!response.ok) {
        throw new Error(getApiError(data, "Error al obtener tareas"));
    }
    const rawTasks = data.data?.tasks ?? [];
    const tasks: TTask[] = rawTasks.map(hydrateTask);
    const feedItems: TaskFeedItem[] = rawTasks.map(toTaskFeedItem);

    return { feedItems, tasks };
}

export async function getTaskById(taskId: string) {
    const response = await fetch(`/api/v1/tasks/${taskId}`, {
        method: "GET",
        credentials: "include",
    });
    const data = (await response.json()) as ApiResponse<TaskData>;
    if (!response.ok) {
        throw new Error(getApiError(data, "Error al obtener la tarea"));
    }

    if (!data.data?.task) {
        throw new Error("La respuesta no incluyó la tarea");
    }

    return { task: hydrateTask(data.data.task) };
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
            queryKey: TasksQueryKeys.history(),
        });
        queryClient.invalidateQueries({
            queryKey: TasksQueryKeys.byId(taskId),
        });
        queryClient.invalidateQueries({
            queryKey: TasksQueryKeys.progress(),
        });
    },
})

export function useCompleteTask() {
    return {
        mutationFn: markTaskAsCompleted,
        onMutate: async ({ taskId }: { taskId: string }) => {
            await queryClient.cancelQueries({ queryKey: TasksQueryKeys.today() });
            const previous = queryClient.getQueryData<Awaited<ReturnType<typeof getTodayTasks>>>(
                TasksQueryKeys.today(),
            );

            if (previous) {
                queryClient.setQueryData(TasksQueryKeys.today(), {
                    ...previous,
                    feedItems: previous.feedItems.map((task) =>
                        task.id === taskId
                            ? {
                                  ...task,
                                  completed_at: new Date().toISOString(),
                                  status_level: "completed" as const,
                              }
                            : task,
                    ),
                    tasks: previous.tasks.map((task) =>
                        task.id === taskId
                            ? {
                                  ...task,
                                  completedAt: new Date(),
                                  status: "completed" as const,
                              }
                            : task,
                    ),
                });
            }

            return { previous };
        },
        onError: (
            _error: Error,
            _variables: { taskId: string },
            context: { previous?: Awaited<ReturnType<typeof getTodayTasks>> } | undefined,
        ) => {
            if (context?.previous) {
                queryClient.setQueryData(TasksQueryKeys.today(), context.previous);
            }
        },
        onSettled: (_data: unknown, _error: Error | null, variables: { taskId: string }) => {
            void queryClient.invalidateQueries({ queryKey: TasksQueryKeys.today() });
            void queryClient.invalidateQueries({ queryKey: TasksQueryKeys.byId(variables.taskId) });
            void queryClient.invalidateQueries({ queryKey: TasksQueryKeys.history() });
            void queryClient.invalidateQueries({ queryKey: TasksQueryKeys.progress() });
        },
    };
}
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
    const data = (await response.json()) as ApiResponse<TaskData>;
    if (!response.ok) {
        throw new Error(getApiError(data, "Error al marcar tarea como completada"));
    }
    return data;
}

export interface IncrementTaskCountInput {
    taskId: string;
    nextCount: number;
    targetCount?: number | null;
}

export async function incrementTaskCount({
    taskId,
    nextCount,
    targetCount,
}: IncrementTaskCountInput) {
    const safeNext = Math.max(0, Math.floor(Number.isFinite(nextCount) ? nextCount : 0));
    const reachesTarget =
        typeof targetCount === "number" && targetCount > 0 && safeNext >= targetCount;
    const body: Record<string, unknown> = {
        currentCount: reachesTarget && typeof targetCount === "number" ? targetCount : safeNext,
    };
    if (reachesTarget) {
        body.status = "completed";
    }
    const response = await fetch(`/api/v1/tasks/${taskId}`, {
        method: "PUT",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });
    const data = (await response.json()) as ApiResponse<TaskData>;
    if (!response.ok) {
        throw new Error(getApiError(data, "No se pudo actualizar el contador"));
    }
    return data;
}

export function useIncrementTaskCount() {
    return {
        mutationFn: incrementTaskCount,
        onMutate: async ({ taskId, nextCount, targetCount }: IncrementTaskCountInput) => {
            await queryClient.cancelQueries({ queryKey: TasksQueryKeys.today() });
            const previous = queryClient.getQueryData<Awaited<ReturnType<typeof getTodayTasks>>>(
                TasksQueryKeys.today(),
            );
            const safeNext = Math.max(0, Math.floor(nextCount));
            const reachesTarget =
                typeof targetCount === "number" && targetCount > 0 && safeNext >= targetCount;
            const clampedCount =
                reachesTarget && typeof targetCount === "number" ? targetCount : safeNext;

            if (previous) {
                queryClient.setQueryData(TasksQueryKeys.today(), {
                    ...previous,
                    feedItems: previous.feedItems.map((task) =>
                        task.id === taskId
                            ? {
                                  ...task,
                                  current_count: clampedCount,
                                  status_level: reachesTarget
                                      ? ("completed" as const)
                                      : task.status_level,
                                  completed_at: reachesTarget
                                      ? new Date().toISOString()
                                      : task.completed_at,
                              }
                            : task,
                    ),
                    tasks: previous.tasks.map((task) =>
                        task.id === taskId
                            ? {
                                  ...task,
                                  currentCount: clampedCount,
                                  status: reachesTarget ? ("completed" as const) : task.status,
                                  completedAt: reachesTarget ? new Date() : task.completedAt,
                              }
                            : task,
                    ),
                });
            }

            return { previous };
        },
        onError: (
            _error: Error,
            _variables: IncrementTaskCountInput,
            context: { previous?: Awaited<ReturnType<typeof getTodayTasks>> } | undefined,
        ) => {
            if (context?.previous) {
                queryClient.setQueryData(TasksQueryKeys.today(), context.previous);
            }
        },
        onSettled: (_data: unknown, _error: Error | null, variables: IncrementTaskCountInput) => {
            void queryClient.invalidateQueries({ queryKey: TasksQueryKeys.today() });
            void queryClient.invalidateQueries({ queryKey: TasksQueryKeys.byId(variables.taskId) });
            void queryClient.invalidateQueries({ queryKey: TasksQueryKeys.history() });
            void queryClient.invalidateQueries({ queryKey: TasksQueryKeys.progress() });
        },
    };
}

export const updateTaskOpts = mutationOptions({
    mutationFn: updateTask,
    onSuccess: (data, variables) => {
        if (!data.data?.task) {
            return;
        }

        const updatedTask = hydrateTask(data.data.task);

        queryClient.setQueryData(TasksQueryKeys.byId(variables.taskId), { task: updatedTask });
        queryClient.invalidateQueries({
            queryKey: TasksQueryKeys.today(),
        });
        queryClient.invalidateQueries({
            queryKey: TasksQueryKeys.all(),
        });
        queryClient.invalidateQueries({
            queryKey: TasksQueryKeys.history(),
        });
        queryClient.invalidateQueries({
            queryKey: TasksQueryKeys.progress(),
        });
    },
});

export async function updateTask({
    actualEnd,
    actualStart,
    apply_to_schedule,
    currentCount,
    date,
    description,
    duration_minutes,
    frequency,
    is_required,
    notes,
    priority_level,
    schedule_end_time,
    schedule_start_time,
    status,
    targetCount,
    taskId,
    title,
}: UpdateTaskPayload) {
    const response = await fetch(`/api/v1/tasks/${taskId}`, {
        method: "PUT",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            actualEnd,
            actualStart,
            apply_to_schedule,
            currentCount,
            date,
            description,
            duration_minutes,
            frequency,
            is_required,
            notes,
            priority_level,
            schedule_end_time,
            schedule_start_time,
            status,
            targetCount,
            title,
        }),
    });
    const data = (await response.json()) as ApiResponse<TaskData>;
    if (!response.ok) {
        throw new Error(getApiError(data, "Error al actualizar tarea"));
    }
    return data;
}

export function hydrateTask(task: Partial<TTask>): TTask {
    const raw = task as RawTaskResponse;
    const date = raw.date ?? new Date().toISOString();
    const createdAt = raw.createdAt ?? raw.created_at ?? new Date().toISOString();
    const updatedAt = raw.updatedAt ?? createdAt;
    const startTime = raw.startTime ?? timeStringToDate(raw.schedule_start_time);
    const endTime = raw.endTime ?? timeStringToDate(raw.schedule_end_time);

    return {
        ...task,
        id: raw.id ?? "",
        scheduleTaskId: raw.scheduleTaskId ?? raw.schedule_id ?? "",
        title: raw.title ?? "",
        description: raw.description ?? null,
        priority: raw.priority ?? (raw.priority_level as TTask["priority"]) ?? "medium",
        status: raw.status ?? (raw.status_level as TTask["status"]) ?? "pending",
        date: new Date(date),
        startTime: startTime ? new Date(startTime) : null,
        endTime: endTime ? new Date(endTime) : null,
        startDate: task.startDate ? new Date(task.startDate) : null,
        endDate: task.endDate ? new Date(task.endDate) : null,
        completedAt: raw.completedAt ? new Date(raw.completedAt) : raw.completed_at ? new Date(raw.completed_at) : null,
        actualStart: task.actualStart ? new Date(task.actualStart) : null,
        actualEnd: task.actualEnd ? new Date(task.actualEnd) : null,
        currentCount: raw.currentCount ?? raw.current_count ?? 0,
        targetCount: raw.targetCount ?? raw.target_count ?? null,
        notes: task.notes ?? null,
        frequency: task.frequency ?? null,
        category: task.category ?? null,
        isRequired: task.isRequired ?? task.required ?? raw.is_required ?? false,
        required: task.required ?? task.isRequired ?? raw.is_required ?? false,
        canEdit: raw.canEdit ?? raw.can_edit ?? true,
        canApplyToSchedule: raw.canApplyToSchedule ?? raw.can_apply_to_schedule ?? true,
        duration: task.duration ?? raw.duration_minutes ?? null,
        createdAt: new Date(createdAt),
        updatedAt: new Date(updatedAt),
    } as TTask;
}

function toTaskFeedItem(task: RawTaskResponse): TaskFeedItem {
    return {
        completed_at: task.completed_at ?? (task.completedAt ? task.completedAt.toISOString() : null),
        created_at: task.created_at ?? task.createdAt?.toISOString() ?? new Date().toISOString(),
        current_count: task.current_count ?? task.currentCount ?? 0,
        description: task.description ?? "",
        duration_minutes: task.duration_minutes ?? task.duration ?? null,
        id: task.id ?? "",
        is_required: task.is_required ?? task.isRequired ?? task.required ?? false,
        priority_level: (task.priority_level ?? task.priority ?? "medium") as TaskFeedItem["priority_level"],
        schedule_end_time: task.schedule_end_time ?? dateToTimeString(task.endTime) ?? null,
        schedule_id: task.schedule_id ?? task.scheduleTaskId ?? "",
        schedule_start_time: task.schedule_start_time ?? dateToTimeString(task.startTime) ?? null,
        status_level: (task.status_level ?? task.status ?? "pending") as TaskFeedItem["status_level"],
        target_count: task.target_count ?? task.targetCount ?? null,
        title: task.title ?? "",
    };
}

function timeStringToDate(value: string | null | undefined) {
    if (!value) {
        return null;
    }
    const date = new Date();
    const [hour, minute] = value.split(":").map(Number);
    date.setHours(hour ?? 0, minute ?? 0, 0, 0);
    return date;
}

function dateToTimeString(value: Date | null | undefined) {
    if (!value) {
        return null;
    }
    return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
}
