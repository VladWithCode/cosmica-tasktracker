import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import {
    CounterTaskProgress,
    isCounterTask,
} from "@/components/tasks/CounterTaskProgress";
import { DayProgress } from "@/components/tasks/DayProgress";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { cn } from "@/lib/utils";
import { sortTasksForFeed } from "@/lib/taskSort";
import {
    getTodayTasksOpts,
    useCompleteTask,
    useIncrementTaskCount,
} from "@/queries/tasks";
import type { TaskFeedItem } from "@/types/task";

export const Route = createFileRoute("/tasks/")({
    component: RouteComponent,
});

interface HourBucketData {
    hour: number | null;
    label: string;
    tasks: TaskFeedItem[];
}

function RouteComponent() {
    const { data, error, isError, isLoading, refetch } = useQuery(getTodayTasksOpts);
    const tasks = data?.feedItems ?? [];
    const buckets = useMemo(() => buildBuckets(tasks), [tasks]);
    const formattedDate = new Date().toLocaleDateString("es-MX", {
        day: "2-digit",
        month: "long",
        weekday: "long",
    });

    return (
        <AppShell title="Hoy">
            <main className="relative mx-auto min-h-full max-w-4xl px-6 pb-36 pt-8">
                <div className="pointer-events-none absolute left-1/2 top-16 h-80 w-80 -translate-x-1/2 rounded-full bg-primary/5 blur-[120px]" />
                <section className="relative mb-8">
                    <p className="font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                        {formattedDate}
                    </p>
                    <h2 className="mt-2 font-display text-4xl font-extrabold tracking-tight text-on-surface">
                        Hoy
                    </h2>
                </section>

                <DayProgress />

                {isLoading ? <TasksLoadingState /> : null}
                {isError ? <TasksErrorState error={error} onRetry={() => void refetch()} /> : null}
                {!isLoading && !isError && tasks.length === 0 ? <TasksEmptyState /> : null}
                {!isLoading && !isError && tasks.length > 0 ? (
                    <section className="relative space-y-5">
                        {buckets.map((bucket) => (
                            <HourBucket
                                bucket={bucket}
                                key={bucket.hour === null ? "unscheduled" : bucket.hour}
                            />
                        ))}
                    </section>
                ) : null}
            </main>
        </AppShell>
    );
}

function HourBucket({ bucket }: { bucket: HourBucketData }) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [showAllModal, setShowAllModal] = useState(false);
    const sortedTasks = useMemo(() => sortTasksForFeed(bucket.tasks), [bucket.tasks]);
    const visibleTasks = isExpanded ? sortedTasks.slice(0, 5) : [nextPendingTask(sortedTasks)];
    const currentHour = new Date().getHours();
    const isCurrentHour = bucket.hour === currentHour;
    const allComplete = sortedTasks.every((task) => task.status_level === "completed");

    return (
        <article className="grid grid-cols-[4rem_1fr] gap-4 md:grid-cols-[5rem_1fr]">
            <button
                className={cn(
                    "flex min-h-20 flex-col items-center justify-center rounded-xl border border-outline-variant/10 bg-surface-container-low p-2 transition-all duration-300 hover:-translate-y-1 active:scale-95",
                    isCurrentHour ? "text-primary ring-1 ring-primary/30" : "text-on-surface-variant",
                )}
                onClick={() => setIsExpanded((current) => !current)}
                type="button"
            >
                <span className="font-display text-lg font-bold tabular-nums">{bucket.label}</span>
                <MaterialIcon
                    name={isExpanded ? "expand_less" : "expand_more"}
                    className="mt-1 text-lg"
                />
            </button>
            <div className="space-y-3">
                {!isExpanded && allComplete ? <CompletedHourCard /> : null}
                {!isExpanded && !allComplete && visibleTasks[0] ? (
                    <TaskCard task={visibleTasks[0]} />
                ) : null}
                {isExpanded
                    ? visibleTasks.map((task) => <TaskCard key={task.id} task={task} />)
                    : null}
                {isExpanded && sortedTasks.length > 5 ? (
                    <button
                        className="rounded-full border border-outline-variant/15 bg-surface-container-highest px-4 py-2 text-sm font-bold text-primary transition-all duration-300 hover:-translate-y-1 active:scale-95"
                        onClick={() => setShowAllModal(true)}
                        type="button"
                    >
                        Ver todas ({sortedTasks.length})
                    </button>
                ) : null}
            </div>
            {showAllModal ? (
                <TaskListModal
                    label={bucket.label}
                    onClose={() => setShowAllModal(false)}
                    tasks={sortedTasks}
                />
            ) : null}
        </article>
    );
}

function TaskCard({ task }: { task: TaskFeedItem }) {
    const router = useRouter();
    const completeTaskMutation = useMutation(useCompleteTask());
    const incrementCountMutation = useMutation(useIncrementTaskCount());
    const isCompleted = task.status_level === "completed";
    const isCompletable = task.status_level === "pending" || task.status_level === "in_progress";
    const isCounter = isCounterTask(task);
    const targetCount = task.target_count ?? null;
    const currentCount = task.current_count ?? 0;
    const counterReached =
        isCounter && targetCount !== null && currentCount >= targetCount;

    const completeTask = () => {
        completeTaskMutation.mutate(
            { taskId: task.id },
            {
                onError: (mutationError) => {
                    toast.error(mutationError.message || "No se pudo completar la tarea");
                },
                onSuccess: () => toast.success("Tarea completada"),
            },
        );
    };

    const incrementCounter = () => {
        if (!isCounter || !targetCount) {
            return;
        }
        const nextCount = Math.min(currentCount + 1, targetCount);
        if (nextCount === currentCount) {
            return;
        }
        incrementCountMutation.mutate(
            { taskId: task.id, nextCount, targetCount },
            {
                onError: (mutationError) => {
                    toast.error(
                        mutationError.message || "No se pudo registrar la unidad",
                    );
                },
                onSuccess: () => {
                    if (nextCount >= targetCount) {
                        toast.success("Contador completo");
                    }
                },
            },
        );
    };

    const counterMutationPending = incrementCountMutation.isPending;
    const incrementDisabled =
        !isCompletable || counterReached || counterMutationPending;

    return (
        <article
            className={cn(
                "group relative overflow-hidden rounded-xl border border-outline-variant/10 bg-surface-container-low p-4 pl-5 transition-all duration-300 hover:-translate-y-1 active:scale-[0.99]",
                task.is_required && "ring-1 ring-primary/30 shadow-[0_0_24px_rgba(175,162,255,0.12)]",
                isCompleted && "opacity-70",
            )}
        >
            <div className={cn("absolute left-0 top-0 h-full w-1", priorityBar(task.priority_level))} />
            <div className="flex items-center justify-between gap-4">
                <button
                    className="min-w-0 flex-1 rounded-md text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    onClick={() => void router.navigate({ to: "/tasks/$id", params: { id: task.id } })}
                    type="button"
                >
                    <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate font-headline text-base font-medium text-on-surface">
                            {task.title}
                        </h3>
                        {task.is_required ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 font-label text-[10px] font-bold uppercase tracking-widest text-primary">
                                <MaterialIcon name="priority_high" className="text-xs" />
                                Vital
                            </span>
                        ) : null}
                        {isCounter ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-tertiary/20 bg-tertiary/10 px-2 py-0.5 font-label text-[10px] font-bold uppercase tracking-widest text-tertiary">
                                <MaterialIcon name="repeat" className="text-xs" />
                                {currentCount}/{targetCount}
                            </span>
                        ) : null}
                    </div>
                    <p className="mt-1 font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                        {task.schedule_start_time ?? "Sin horario"}
                    </p>
                </button>
                <div className="flex shrink-0 items-center gap-2">
                    {isCounter ? (
                        <button
                            aria-label={
                                counterReached
                                    ? "Contador completo"
                                    : "Sumar una unidad al contador"
                            }
                            className={cn(
                                "flex h-11 min-w-[3rem] items-center justify-center gap-1 rounded-full border border-outline-variant/15 px-3 font-label text-xs font-extrabold uppercase tracking-widest transition-all duration-300 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60",
                                counterReached
                                    ? "bg-tertiary/10 text-tertiary"
                                    : "bg-surface-container-highest text-on-surface hover:text-primary",
                            )}
                            disabled={incrementDisabled}
                            onClick={incrementCounter}
                            type="button"
                        >
                            <MaterialIcon
                                filled
                                name={
                                    counterMutationPending
                                        ? "progress_activity"
                                        : counterReached
                                          ? "check_circle"
                                          : "add"
                                }
                                className={cn(
                                    "text-base",
                                    counterMutationPending && "animate-spin",
                                )}
                            />
                            <span aria-hidden="true">+1</span>
                        </button>
                    ) : null}
                    <button
                        aria-label={isCompleted ? "Tarea completada" : "Completar tarea"}
                        className={cn(
                            "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-outline-variant/15 transition-all duration-300 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                            isCompleted
                                ? "bg-tertiary/10 text-tertiary"
                                : "bg-surface-container-highest text-on-surface-variant hover:text-tertiary",
                        )}
                        disabled={!isCompletable || completeTaskMutation.isPending}
                        onClick={completeTask}
                        type="button"
                    >
                        <MaterialIcon
                            filled={isCompleted}
                            name={
                                completeTaskMutation.isPending
                                    ? "progress_activity"
                                    : isCompleted
                                      ? "check_circle"
                                      : "radio_button_unchecked"
                            }
                            className={cn(completeTaskMutation.isPending && "animate-spin")}
                        />
                    </button>
                </div>
            </div>
            {isCounter ? (
                <div className="mt-3">
                    <CounterTaskProgress
                        category={null}
                        compact
                        currentCount={currentCount}
                        description={task.description ?? null}
                        status={task.status_level}
                        targetCount={targetCount}
                        title={task.title}
                    />
                </div>
            ) : null}
        </article>
    );
}

function TaskListModal({
    label,
    onClose,
    tasks,
}: {
    label: string;
    onClose: () => void;
    tasks: TaskFeedItem[];
}) {
    return (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-surface-container-lowest/70 px-4 pb-6 backdrop-blur-sm md:items-center">
            <section className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-xl border border-outline-variant/15 bg-surface-container-low p-5 shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
                <div className="mb-4 flex items-center justify-between">
                    <h3 className="font-headline text-lg font-bold text-on-surface">
                        Tareas de {label}
                    </h3>
                    <button
                        aria-label="Cerrar modal"
                        className="rounded-full p-2 text-on-surface-variant transition-all duration-300 hover:bg-surface-container-highest hover:text-primary active:scale-95"
                        onClick={onClose}
                        type="button"
                    >
                        <MaterialIcon name="close" />
                    </button>
                </div>
                <div className="space-y-3">
                    {tasks.map((task) => (
                        <TaskCard key={task.id} task={task} />
                    ))}
                </div>
            </section>
        </div>
    );
}

function CompletedHourCard() {
    return (
        <div className="flex min-h-20 items-center gap-3 rounded-xl border border-tertiary/15 bg-tertiary/5 p-4 text-tertiary opacity-80">
            <MaterialIcon name="check_circle" filled />
            <span className="font-label text-xs font-bold uppercase tracking-widest">
                Hora completa
            </span>
        </div>
    );
}

function TasksLoadingState() {
    return (
        <section className="space-y-4">
            {Array.from({ length: 3 }, (_, index) => (
                <div className="grid grid-cols-[4rem_1fr] gap-4" key={index}>
                    <div className="h-20 animate-pulse rounded-xl bg-surface-container-highest/60" />
                    <div className="h-20 animate-pulse rounded-xl bg-surface-container-low" />
                </div>
            ))}
        </section>
    );
}

function TasksErrorState({ error, onRetry }: { error: Error | null; onRetry: () => void }) {
    return (
        <section className="rounded-xl border border-error-dim/30 bg-error-container/10 p-6 text-error">
            <div className="flex items-center gap-2">
                <MaterialIcon name="error_outline" />
                <p>{error?.message || "No se pudieron cargar las tareas"}</p>
            </div>
            <button
                className="mt-4 rounded-full bg-surface-container-highest px-4 py-2 text-sm font-bold text-on-surface transition-all duration-300 hover:-translate-y-1 active:scale-95"
                onClick={onRetry}
                type="button"
            >
                Reintentar
            </button>
        </section>
    );
}

function TasksEmptyState() {
    return (
        <section
            aria-live="polite"
            className="rounded-xl border border-outline-variant/15 bg-surface-container-low p-8 text-center"
        >
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-tertiary/10 text-tertiary shadow-[0_0_30px_rgba(129,236,255,0.18)]">
                <MaterialIcon name="event_available" className="text-5xl" />
            </div>
            <h3 className="font-headline text-xl font-bold text-on-surface">
                No tenés tareas para hoy
            </h3>
            <p className="mx-auto mt-2 max-w-sm text-sm text-on-surface-variant">
                Creá una rutina (por ejemplo, “Tomar agua: 8 botellas”) y se generará automáticamente cuando aplique su horario.
            </p>
            <Link
                className="mt-5 inline-flex rounded-full bg-gradient-to-r from-primary to-primary-dim px-5 py-3 font-label text-xs font-extrabold uppercase tracking-widest text-on-primary shadow-[0_15px_40px_rgba(175,162,255,0.28)] transition-all duration-300 hover:-translate-y-1 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                to="/tasks/new"
            >
                Crear rutina
            </Link>
        </section>
    );
}

function buildBuckets(tasks: TaskFeedItem[]): HourBucketData[] {
    const scheduled = new Map<number, TaskFeedItem[]>();
    const unscheduled: TaskFeedItem[] = [];

    for (const task of tasks) {
        if (!task.schedule_start_time) {
            unscheduled.push(task);
            continue;
        }
        const hour = Number(task.schedule_start_time.split(":")[0]);
        scheduled.set(hour, [...(scheduled.get(hour) ?? []), task]);
    }

    const buckets: HourBucketData[] = [...scheduled.entries()]
        .sort(([firstHour], [secondHour]) => firstHour - secondHour)
        .map(([hour, hourTasks]) => ({
            hour,
            label: formatHour(hour),
            tasks: hourTasks,
        }));

    if (unscheduled.length > 0) {
        buckets.push({ hour: null, label: "Sin horario", tasks: unscheduled });
    }

    return buckets;
}

function nextPendingTask(tasks: TaskFeedItem[]) {
    return tasks.find((task) => task.status_level !== "completed") ?? tasks[0];
}

function priorityBar(priority: TaskFeedItem["priority_level"]) {
    switch (priority) {
        case "urgent":
            return "bg-error";
        case "high":
            return "bg-primary";
        case "medium":
            return "bg-tertiary";
        case "low":
        default:
            return "bg-on-surface-variant";
    }
}

function formatHour(hour: number) {
    const date = new Date();
    date.setHours(hour, 0, 0, 0);
    return date
        .toLocaleTimeString("en-US", { hour: "numeric", hour12: true })
        .replace(":00", "");
}
