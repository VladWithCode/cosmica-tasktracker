import { cn, formatStartTime } from "@/lib/utils";
import type { TTask } from "@/lib/schemas/task";
import { useMutation } from "@tanstack/react-query";
import { markAsCompletedOpts } from "@/queries/tasks";
import { useCallback } from "react";
import { toast } from "sonner";
import { MaterialIcon } from "../ui/MaterialIcon";
import { Link } from "@tanstack/react-router";

export function TaskCard({ task }: { task: TTask }) {
    const isDone = task.status === "completed";
    const isProblem = task.status === "failed" || task.status === "skipped";

    return (
        <article
            className={cn(
                "group rounded-xl border bg-surface-container-low p-4 transition-all duration-300 hover:-translate-y-1",
                isDone &&
                    "border-outline-variant/10 opacity-70 hover:shadow-[0_10px_30px_rgba(129,236,255,0.08)]",
                !isDone &&
                    !isProblem &&
                    "border-outline-variant/20 hover:border-primary/30 hover:shadow-[0_10px_40px_rgba(116,89,247,0.14)]",
                isProblem && "border-error-dim/30 bg-error-container/10",
            )}
        >
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        {task.startTime !== null ? (
                            <span className="rounded-md border border-outline-variant/15 bg-surface px-2 py-1 font-label text-xs font-semibold text-on-surface-variant">
                                {formatStartTime(task.startTime)}
                            </span>
                        ) : null}
                        {task.required ? (
                            <span className="rounded-full bg-primary/10 px-2 py-1 font-label text-[10px] font-bold uppercase tracking-widest text-primary">
                                Requerida
                            </span>
                        ) : null}
                    </div>
                    <h3
                        className={cn(
                            "mt-3 font-headline text-lg font-bold text-on-surface",
                            isDone && "text-on-surface-variant line-through",
                            isProblem && "text-error",
                        )}
                    >
                        {task.title}
                    </h3>
                    {task.description ? (
                        <p className="mt-1 line-clamp-2 text-sm text-on-surface-variant">
                            {task.description}
                        </p>
                    ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    <Link
                        aria-label="Ver detalles"
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-outline-variant/15 bg-surface-container-highest text-on-surface-variant transition-all duration-300 hover:text-primary active:scale-95"
                        params={{ id: task.id }}
                        to="/tasks/$id"
                    >
                        <MaterialIcon name="visibility" className="text-base" />
                    </Link>
                    <MarkAsCompletedBtn taskId={task.id} isDone={isDone} />
                </div>
            </div>
        </article>
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
        <button
            disabled={isDone}
            onClick={onClick}
            aria-label="Completar tarea"
            className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full transition-all duration-300 active:scale-95",
                isDone
                    ? "bg-tertiary/10 text-tertiary"
                    : "bg-gradient-to-br from-primary to-primary-dim text-on-primary shadow-[0_0_16px_rgba(175,162,255,0.32)] hover:scale-105",
            )}
            type="button"
        >
            <MaterialIcon name={isDone ? "done_all" : "check"} filled className="text-base" />
        </button>
    );
}
