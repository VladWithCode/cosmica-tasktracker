import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { errorMessage } from "@/api/client";
import { cancelSchedule, getSchedule, getSchedules, setSchedulePaused, updateSchedule, type ScheduleInput } from "@/api/schedules";
import type { Schedule } from "@/api/schemas";
import { toast } from "@/stores/toast";
import { queryKeys } from "./keys";

export function useSchedules(ownerId: string | null) {
    return useQuery({ queryKey: queryKeys.schedules(ownerId), queryFn: () => getSchedules(ownerId ?? undefined) });
}

export function useSchedule(id: string) {
    const queryClient = useQueryClient();
    return useQuery({
        queryKey: queryKeys.schedule(id),
        queryFn: () => getSchedule(id),
        initialData: () =>
            queryClient
                .getQueriesData<Schedule[]>({ queryKey: ["schedules"] })
                .flatMap(([, list]) => list ?? [])
                .find((schedule) => schedule.id === id),
    });
}

function useAfterScheduleChange() {
    const queryClient = useQueryClient();
    return (schedule?: Schedule) => {
        if (schedule) queryClient.setQueryData(queryKeys.schedule(schedule.id), schedule);
        void queryClient.invalidateQueries({ queryKey: ["schedules"] });
        void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    };
}

export function useUpdateSchedule(id: string) {
    const after = useAfterScheduleChange();
    return useMutation({
        mutationFn: (input: ScheduleInput) => updateSchedule(id, input),
        onSuccess: (schedule) => after(schedule),
    });
}

export function useSetSchedulePaused() {
    const queryClient = useQueryClient();
    const after = useAfterScheduleChange();
    return useMutation({
        mutationFn: ({ id, paused }: { id: string; paused: boolean }) => setSchedulePaused(id, paused),
        onMutate: async ({ id, paused }) => {
            await queryClient.cancelQueries({ queryKey: ["schedules"] });
            const lists = queryClient.getQueriesData<Schedule[]>({ queryKey: ["schedules"] });
            const status = paused ? "paused" : "active";
            queryClient.setQueriesData<Schedule[]>({ queryKey: ["schedules"] }, (list) =>
                list?.map((schedule) => (schedule.id === id ? { ...schedule, status } : schedule)),
            );
            queryClient.setQueryData<Schedule>(queryKeys.schedule(id), (schedule) => (schedule ? { ...schedule, status } : schedule));
            return { lists };
        },
        onError: (error, { id }, context) => {
            for (const [key, data] of context?.lists ?? []) queryClient.setQueryData(key, data);
            void queryClient.invalidateQueries({ queryKey: queryKeys.schedule(id) });
            toast.error(errorMessage(error));
        },
        onSuccess: (schedule, { paused }) => {
            after(schedule);
            toast.show(paused ? "Rutina en pausa" : "Rutina reanudada");
        },
    });
}

export function useCancelSchedule() {
    const queryClient = useQueryClient();
    const after = useAfterScheduleChange();
    return useMutation({
        mutationFn: (id: string) => cancelSchedule(id),
        onSuccess: (_result, id) => {
            queryClient.removeQueries({ queryKey: queryKeys.schedule(id) });
            after();
        },
        onError: (error) => toast.error(errorMessage(error)),
    });
}
