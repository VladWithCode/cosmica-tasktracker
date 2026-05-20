import { mutationOptions, queryOptions } from "@tanstack/react-query";
import {
    cancelSchedule,
    listSchedules,
    pauseSchedule,
    resumeSchedule,
} from "@/services/schedules";
import { queryClient } from "./queryClient";

export const schedulesQueryKey = ["schedules"] as const;

export const getSchedulesOpts = queryOptions({
    queryKey: schedulesQueryKey,
    queryFn: () => listSchedules(),
    staleTime: 30_000,
});

function invalidateSchedules() {
    void queryClient.invalidateQueries({ queryKey: schedulesQueryKey });
}

export const pauseScheduleOpts = mutationOptions({
    mutationFn: (id: string) => pauseSchedule(id),
    onSuccess: invalidateSchedules,
});

export const resumeScheduleOpts = mutationOptions({
    mutationFn: (id: string) => resumeSchedule(id),
    onSuccess: invalidateSchedules,
});

export const cancelScheduleOpts = mutationOptions({
    mutationFn: (id: string) => cancelSchedule(id),
    onSuccess: invalidateSchedules,
});
