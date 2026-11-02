import type { TaskItem, TaskStatus } from "@/api/schemas";
import { haptic } from "@/lib/haptics";
import { statusForCount } from "@/lib/tasks";
import { useUpdateTask } from "@/queries/tasks";

export function useTaskActions(task: TaskItem) {
    const update = useUpdateTask(task.id);
    const done = task.status === "completed";

    const setStatus = (status: TaskStatus) => {
        if (status === "completed") haptic();
        update.mutate({ status });
    };

    const setCount = (count: number) => {
        const status = statusForCount(count, task.targetCount, task.status);
        if (status === "completed" && task.status !== "completed") haptic();
        update.mutate({ currentCount: count, ...(status !== task.status ? { status } : {}) });
    };

    const toggle = () => {
        if (task.targetCount !== null && !done) {
            setCount(task.targetCount);
            return;
        }
        setStatus(done ? "pending" : "completed");
    };

    return { done, setStatus, setCount, toggle };
}
