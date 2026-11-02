import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { errorMessage } from "@/api/client";
import { getSchedules } from "@/api/schedules";
import type { DayTasks, TaskDetail, TaskItem } from "@/api/schemas";
import { deleteTask, getDayTasks, getTask, getTodayTasks, pingTask, updateTask, type TaskUpdate } from "@/api/tasks";
import { toast } from "@/stores/toast";
import { queryKeys } from "./keys";

export function useTodayTasks(ownerId: string | null) {
    return useQuery({ queryKey: queryKeys.today(ownerId), queryFn: () => getTodayTasks(ownerId ?? undefined) });
}

export function useDayTasks(ownerId: string | null, date: string) {
    return useQuery({ queryKey: queryKeys.day(ownerId, date), queryFn: () => getDayTasks(date, ownerId ?? undefined) });
}

export function useTask(id: string | undefined) {
    return useQuery({ queryKey: queryKeys.task(id ?? ""), queryFn: () => getTask(id ?? ""), enabled: Boolean(id) });
}

export function useSchedules(ownerId: string | null) {
    return useQuery({ queryKey: queryKeys.schedules(ownerId), queryFn: () => getSchedules(ownerId ?? undefined) });
}

function patchItem(item: TaskItem, update: TaskUpdate): TaskItem {
    return {
        ...item,
        status: update.status ?? item.status,
        currentCount: update.currentCount ?? item.currentCount,
        title: update.title ?? item.title,
        description: update.description ?? item.description,
        targetCount: update.targetCount ?? item.targetCount,
        completedAt: update.status === "completed" ? (item.completedAt ?? new Date().toISOString()) : update.status ? null : item.completedAt,
    };
}

function itemFromDetail(item: TaskItem, detail: TaskDetail): TaskItem {
    return {
        ...item,
        title: detail.title,
        description: detail.description,
        status: detail.status,
        priority: detail.priority,
        isRequired: detail.isRequired,
        startTime: detail.startTime,
        endTime: detail.endTime,
        durationMinutes: detail.durationMinutes,
        targetCount: detail.targetCount,
        currentCount: detail.currentCount,
        completedAt: detail.completedAt,
    };
}

function mapTaskLists(queryClient: QueryClient, id: string, map: (item: TaskItem) => TaskItem) {
    queryClient.setQueriesData<DayTasks>({ queryKey: queryKeys.tasks }, (data) =>
        data ? { ...data, tasks: data.tasks.map((item) => (item.id === id ? map(item) : item)) } : data,
    );
}

export function useUpdateTask(id: string) {
    const queryClient = useQueryClient();
    return useMutation({
        scope: { id: `task:${id}` },
        mutationFn: (update: TaskUpdate) => updateTask(id, update),
        onMutate: async (update) => {
            await queryClient.cancelQueries({ queryKey: queryKeys.tasks });
            const lists = queryClient.getQueriesData<DayTasks>({ queryKey: queryKeys.tasks });
            const detail = queryClient.getQueryData<TaskDetail>(queryKeys.task(id));
            mapTaskLists(queryClient, id, (item) => patchItem(item, update));
            if (detail) {
                queryClient.setQueryData<TaskDetail>(queryKeys.task(id), {
                    ...detail,
                    status: update.status ?? detail.status,
                    currentCount: update.currentCount ?? detail.currentCount,
                    notes: update.notes ?? detail.notes,
                });
            }
            return { lists, detail };
        },
        onError: (error, _update, context) => {
            for (const [key, data] of context?.lists ?? []) queryClient.setQueryData(key, data);
            if (context?.detail) queryClient.setQueryData(queryKeys.task(id), context.detail);
            toast.error(errorMessage(error));
        },
        onSuccess: (detail, update) => {
            queryClient.setQueryData(queryKeys.task(id), detail);
            mapTaskLists(queryClient, id, (item) => itemFromDetail(item, detail));
            if (update.applyToSchedule) void queryClient.invalidateQueries({ queryKey: ["schedules"] });
        },
        onSettled: () => {
            void queryClient.invalidateQueries({ queryKey: ["history"] });
            void queryClient.invalidateQueries({ queryKey: ["metrics"] });
            void queryClient.invalidateQueries({ queryKey: ["progress"] });
        },
    });
}

export function useDeleteTask() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => deleteTask(id),
        onSuccess: (_result, id) => {
            queryClient.setQueriesData<DayTasks>({ queryKey: queryKeys.tasks }, (data) =>
                data ? { ...data, tasks: data.tasks.filter((item) => item.id !== id) } : data,
            );
            queryClient.removeQueries({ queryKey: queryKeys.task(id) });
            void queryClient.invalidateQueries({ queryKey: ["history"] });
        },
        onError: (error) => toast.error(errorMessage(error)),
    });
}

export function usePingTask() {
    return useMutation({
        mutationFn: ({ id, message }: { id: string; message: string }) => pingTask(id, message),
        onSuccess: () => toast.show("Recordatorio enviado"),
        onError: (error) => toast.error(errorMessage(error)),
    });
}
