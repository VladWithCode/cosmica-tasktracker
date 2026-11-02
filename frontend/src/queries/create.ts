import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createSchedule, type ScheduleInput } from "@/api/schedules";
import { createOneOffTask, type OneOffTaskInput } from "@/api/tasks";

function useInvalidateAfterCreate() {
    const queryClient = useQueryClient();
    return () => {
        void queryClient.invalidateQueries({ queryKey: ["tasks"] });
        void queryClient.invalidateQueries({ queryKey: ["schedules"] });
        void queryClient.invalidateQueries({ queryKey: ["history"] });
        void queryClient.invalidateQueries({ queryKey: ["metrics"] });
    };
}

export function useCreateOneOff() {
    const invalidate = useInvalidateAfterCreate();
    return useMutation({ mutationFn: (input: OneOffTaskInput) => createOneOffTask(input), onSuccess: invalidate });
}

export function useCreateSchedule() {
    const invalidate = useInvalidateAfterCreate();
    return useMutation({ mutationFn: (input: ScheduleInput) => createSchedule(input), onSuccess: invalidate });
}
