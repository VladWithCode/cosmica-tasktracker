import { cn, formatStartTime } from "@/lib/utils";
import { Button } from "../ui/button";
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { CheckIcon, View } from "lucide-react";
import type { TTask } from "@/lib/schemas/task";
import { useMutation } from "@tanstack/react-query";
import { markAsCompletedOpts } from "@/queries/tasks";
import { useCallback } from "react";
import { toast } from "sonner";

export function TaskCard({ task }: { task: TTask }) {
    const isDone = task.status === "completed";
    return (
        <Card
            className={cn(
                "shadow-none rounded-sm",
                isDone && "opacity-65 scale-98",
            )}
        >
            <CardHeader>
                <CardTitle>
                    {task.startTime !== null ? `${formatStartTime(task.startTime)} -` : null}
                    {task.title}
                </CardTitle>
                <CardDescription>
                    {task.description}
                </CardDescription>
                <CardAction className="flex items-center gap-x-2">
                    <Button
                        variant="outline"
                        size="icon"
                        className={cn(isDone && "text-primary")}
                    >
                        <View className="h-4 w-4" />
                        <div className="sr-only">Ver detalles</div>
                    </Button>
                    <MarkAsCompletedBtn taskId={task.id} isDone={isDone} />
                </CardAction>
            </CardHeader>
        </Card>
    );
}

function MarkAsCompletedBtn({ taskId, isDone }: { taskId: string, isDone: boolean }) {
    const markAsCompletedMut = useMutation(markAsCompletedOpts);
    const onClick = useCallback(() => {
        if (isDone) {
            return;
        }

        markAsCompletedMut.mutate({
            taskId,
        }, {
            onSuccess: (data) => toast.success(data.message || "Se completó la tarea correctamente"),
        });
    }, [taskId, isDone]);

    return (
        <Button
            variant="default"
            size="icon"
            disabled={isDone}
            onClick={onClick}
        >
            <CheckIcon className="h-4 w-4" />
            <div className="sr-only">Completar tarea</div>
        </Button>
    );
}
