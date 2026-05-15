import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { FloatingActionButton } from "@/components/layout/FloatingActionButton";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import type { TTask } from "@/lib/schemas/task";
import { cn } from "@/lib/utils";
import { getTodayTasksOpts } from "@/queries/tasks";

type TimelineTaskState = "completed" | "active" | "upcoming";

interface TaskTimelineItemProps {
    task: TTask;
    state: TimelineTaskState;
    lateMinutes: number | null;
}

interface ProgressSummaryProps {
    completedCount: number;
    totalCount: number;
}

export function TimelineDashboard() {
    const { data, error, isError, isLoading } = useQuery(getTodayTasksOpts);

    const tasks = useMemo(() => sortTasksByTime(data?.tasks ?? []), [data?.tasks]);
    const activeTaskId = useMemo(() => getActiveTaskId(tasks, new Date()), [tasks]);
    const completedCount = tasks.filter(isTaskCompleted).length;

    return (
        <main className="relative mx-auto min-h-full max-w-4xl px-6 pb-36 pt-8">
            <div className="pointer-events-none absolute left-1/2 top-20 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/5 blur-[120px]" />

            <section className="relative mb-10">
                <h2 className="mb-6 font-display text-4xl font-extrabold tracking-tight text-on-surface">
                    Timeline
                </h2>
                <ProgressSummary completedCount={completedCount} totalCount={tasks.length} />
            </section>

            {isLoading ? <TimelineLoadingState /> : null}
            {isError ? <TimelineErrorState error={error} /> : null}
            {!isLoading && !isError && tasks.length === 0 ? <TimelineEmptyState /> : null}
            {!isLoading && !isError && tasks.length > 0 ? (
                <section
                    aria-label="Timeline de tareas de hoy"
                    className="relative before:absolute before:inset-0 before:ml-5 before:h-full before:w-0.5 before:-translate-x-px before:bg-surface-container-highest md:before:mx-auto md:before:translate-x-0"
                >
                    {tasks.map((task) => {
                        const state = getTaskState(task, activeTaskId);
                        return (
                            <TaskTimelineItem
                                key={task.id}
                                lateMinutes={getLateMinutes(task, state)}
                                state={state}
                                task={task}
                            />
                        );
                    })}
                </section>
            ) : null}

            <FloatingActionButton />
        </main>
    );
}

function ProgressSummary({ completedCount, totalCount }: ProgressSummaryProps) {
    const percent = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

    return (
        <div className="rounded-xl border-l-4 border-primary bg-surface-container-low p-6">
            <div className="mb-4 flex items-end justify-between">
                <div>
                    <p className="mb-1 font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                        Today's Progress
                    </p>
                    <p className="font-display text-2xl font-black tracking-tighter text-tertiary tabular-nums">
                        {percent}% Done
                    </p>
                </div>
                <MaterialIcon name="check_circle" filled className="text-3xl text-tertiary opacity-80" />
            </div>
            <progress
                aria-label={`Progreso de tareas: ${completedCount} de ${totalCount}`}
                className="timeline-progress h-3 w-full overflow-hidden rounded-full shadow-[0_0_15px_rgba(129,236,255,0.1)]"
                max={totalCount || 1}
                value={completedCount}
            />
        </div>
    );
}

function TaskTimelineItem({ task, state, lateMinutes }: TaskTimelineItemProps) {
    return (
        <article className="group relative mb-8 flex items-center justify-between md:justify-normal md:odd:flex-row-reverse">
            <TimelineMarker state={state} />
            <div
                className={cn(
                    "w-[calc(100%-4rem)] rounded-xl p-5 transition-all duration-300 hover:-translate-y-1 md:w-[calc(50%-2.5rem)]",
                    state === "completed" &&
                        "bg-surface-container-high opacity-70 hover:shadow-[0_10px_40px_rgba(116,89,247,0.15)]",
                    state === "active" &&
                        "border border-primary/30 bg-surface-container-high shadow-[0_10px_40px_rgba(116,89,247,0.2)]",
                    state === "upcoming" &&
                        "border border-outline-variant/30 bg-surface-container-low",
                )}
            >
                <div className="mb-2 flex items-start justify-between gap-4">
                    <h3
                        className={cn(
                            "font-headline text-lg text-on-surface",
                            state === "completed" &&
                                "font-bold text-on-surface-variant line-through",
                            state === "active" && "text-xl font-bold text-primary",
                            state === "upcoming" && "font-semibold",
                        )}
                    >
                        {task.title}
                    </h3>
                    <span
                        className={cn(
                            "shrink-0 rounded px-2 py-1 font-label text-xs font-semibold tabular-nums",
                            state === "active"
                                ? "border border-primary/20 bg-primary/10 text-primary"
                                : "border border-surface-container-high bg-surface text-on-surface-variant",
                        )}
                    >
                        {formatTaskTime(task)}
                    </span>
                </div>
                {lateMinutes !== null ? (
                    <div className="mt-3 flex w-fit items-center gap-2 rounded-lg border border-error-dim/20 bg-error-container/10 p-2 text-error-dim">
                        <MaterialIcon name="warning" className="text-sm" />
                        <span className="font-label text-xs font-medium">
                            {lateMinutes}m after start
                        </span>
                    </div>
                ) : null}
            </div>
        </article>
    );
}

function TimelineMarker({ state }: { state: TimelineTaskState }) {
    return (
        <div
            className={cn(
                "z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full shadow shadow-slate-900 ring-4 ring-surface md:order-1 md:group-even:translate-x-1/2 md:group-odd:-translate-x-1/2",
                state === "completed" && "bg-surface-container-high text-tertiary",
                state === "active" &&
                    "animate-pulse bg-gradient-to-br from-primary to-primary-dim text-on-primary shadow-[0_0_20px_rgba(175,162,255,0.4)]",
                state === "upcoming" &&
                    "border border-outline-variant bg-surface-container-low text-on-surface-variant",
            )}
        >
            {state === "completed" ? <MaterialIcon name="done_all" /> : null}
            {state === "active" ? <MaterialIcon name="play_arrow" filled /> : null}
            {state === "upcoming" ? <MaterialIcon name="schedule" className="text-sm" /> : null}
        </div>
    );
}

function TimelineLoadingState() {
    return (
        <section aria-label="Cargando timeline" className="space-y-8">
            {[0, 1, 2].map((item) => (
                <div className="flex items-center gap-8" key={item}>
                    <div className="h-10 w-10 rounded-full bg-surface-container-highest" />
                    <div className="h-24 flex-1 rounded-xl bg-surface-container-low" />
                </div>
            ))}
        </section>
    );
}

function TimelineErrorState({ error }: { error: Error | null }) {
    return (
        <section className="rounded-xl border border-error-dim/30 bg-error-container/10 p-5 text-error">
            <div className="flex items-center gap-3">
                <MaterialIcon name="error" filled />
                <p className="font-label text-xs font-bold uppercase tracking-widest">
                    {error?.message || "No se pudo cargar el timeline"}
                </p>
            </div>
        </section>
    );
}

function TimelineEmptyState() {
    return (
        <section className="rounded-xl border border-outline-variant/15 bg-surface-container-low p-8 text-center">
            <MaterialIcon name="event_available" className="mx-auto mb-3 text-4xl text-tertiary" />
            <p className="font-headline text-lg font-bold text-on-surface">No tasks for today</p>
            <p className="mt-1 text-sm text-on-surface-variant">Create a task to build your timeline.</p>
        </section>
    );
}

function sortTasksByTime(tasks: TTask[]) {
    return [...tasks].sort((first, second) => {
        return getSortTime(first).getTime() - getSortTime(second).getTime();
    });
}

function getSortTime(task: TTask) {
    return task.startTime ?? task.date ?? task.createdAt;
}

function isTaskCompleted(task: TTask) {
    return task.status === "completed" || task.completedAt !== null;
}

function getTaskState(task: TTask, activeTaskId: string | null): TimelineTaskState {
    if (isTaskCompleted(task)) {
        return "completed";
    }

    if (task.id === activeTaskId) {
        return "active";
    }

    return "upcoming";
}

function getActiveTaskId(tasks: TTask[], now: Date) {
    const runningTask = tasks.find((task) => {
        if (isTaskCompleted(task) || task.startTime === null) {
            return false;
        }

        const startsAt = task.startTime.getTime();
        const endsAt = task.endTime?.getTime() ?? Number.POSITIVE_INFINITY;
        const currentTime = now.getTime();

        return startsAt <= currentTime && currentTime <= endsAt;
    });

    if (runningTask) {
        return runningTask.id;
    }

    const lateTask = tasks.find((task) => {
        return !isTaskCompleted(task) && task.startTime !== null && task.startTime.getTime() <= now.getTime();
    });

    if (lateTask) {
        return lateTask.id;
    }

    return tasks.find((task) => !isTaskCompleted(task))?.id ?? null;
}

function getLateMinutes(task: TTask, state: TimelineTaskState) {
    if (state !== "active" || task.startTime === null) {
        return null;
    }

    const minutes = Math.floor((Date.now() - task.startTime.getTime()) / 60000);
    return minutes > 0 ? minutes : null;
}

function formatTaskTime(task: TTask) {
    const time = task.startTime ?? task.date;

    return time.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
    });
}
