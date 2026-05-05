import { useMutation } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { queryClient } from "@/queries/queryClient";
import { TasksQueryKeys } from "@/queries/tasks";
import { createSchedule } from "@/services/schedules";
import type { CreateScheduleInput } from "@/types/schedule";

export function useCreateSchedule() {
    const router = useRouter();

    return useMutation({
        mutationFn: (payload: CreateScheduleInput) => createSchedule(payload),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: TasksQueryKeys.all() });
            await queryClient.invalidateQueries({ queryKey: TasksQueryKeys.today() });
            toast.success("Rutina creada");
            void router.navigate({ to: "/tasks" });
        },
    });
}
