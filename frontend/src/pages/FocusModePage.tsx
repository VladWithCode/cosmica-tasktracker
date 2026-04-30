import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import type { TTask } from "@/lib/schemas/task";
import { useProfileStats } from "@/hooks/useProfileStats";
import { getTodayTasksOpts, markAsCompletedOpts } from "@/queries/tasks";

interface FocusTimerState {
    isRunning: boolean;
    remainingSeconds: number;
    totalSeconds: number;
}

interface FocusMetricCardProps {
    icon: string;
    label: string;
    tone: string;
    value: string;
}

export function FocusModePage() {
    const { data, error, isError, isLoading } = useQuery(getTodayTasksOpts);
    const statsQuery = useProfileStats();
    const tasks = data?.tasks ?? [];
    const focusTask = useMemo(() => selectFocusTask(tasks, new Date()), [tasks]);
    const timer = useFocusTimer(focusTask);
    const markAsCompletedMut = useMutation(markAsCompletedOpts);
    const todayFocusMinutes = useMemo(() => getTodayFocusMinutes(tasks), [tasks]);

    const completeTask = () => {
        if (!focusTask) {
            return;
        }

        markAsCompletedMut.mutate(
            { taskId: focusTask.id },
            {
                onSuccess: (data) => toast.success(data.message || "Tarea completada"),
                onError: (error) => toast.error(error.message || "No se pudo completar la tarea"),
            },
        );
    };

    return (
        <main className="relative mx-auto min-h-full max-w-3xl px-6 pb-36 pt-8">
            <div className="pointer-events-none absolute left-1/2 top-20 h-80 w-80 -translate-x-1/2 rounded-full bg-primary/5 blur-[120px]" />

            <section className="relative text-center">
                <MaterialIcon name="timer" className="mx-auto text-3xl text-tertiary" />
                <h2 className="mt-6 font-display text-4xl font-extrabold tracking-tight text-on-surface">
                    Focus Mode
                </h2>
                <p className="mt-2 font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                    {focusTask?.title ?? "Sin tarea activa"}
                </p>
            </section>

            {isLoading ? <FocusLoadingState /> : null}
            {isError ? <FocusErrorState error={error} /> : null}
            {!isLoading && !isError && !focusTask ? <FocusEmptyState /> : null}
            {!isLoading && !isError && focusTask ? (
                <div className="relative mt-8 space-y-6">
                    <FocusTimerRing
                        isRunning={timer.isRunning}
                        remainingSeconds={timer.remainingSeconds}
                        totalSeconds={timer.totalSeconds}
                    />

                    <button
                        className="flex w-full items-center justify-center rounded-full bg-gradient-to-r from-primary to-primary-dim px-4 py-4 font-label text-sm font-extrabold uppercase tracking-widest text-on-primary shadow-[0_15px_40px_rgba(175,162,255,0.28)] transition-all duration-300 hover:opacity-90 active:scale-[0.98]"
                        disabled={markAsCompletedMut.isPending}
                        onClick={completeTask}
                        type="button"
                    >
                        <MaterialIcon name="check_circle" filled className="mr-2 text-sm" />
                        {markAsCompletedMut.isPending ? "Completando" : "Complete Task"}
                    </button>

                    <div className="grid grid-cols-2 gap-3">
                        <button
                            className="flex items-center justify-center rounded-full bg-surface-container-highest px-4 py-3 font-label text-xs font-bold uppercase tracking-widest text-on-surface transition-all duration-300 hover:text-primary active:scale-95"
                            onClick={timer.toggle}
                            type="button"
                        >
                            <MaterialIcon
                                name={timer.isRunning ? "pause" : "play_arrow"}
                                filled
                                className="mr-2 text-sm"
                            />
                            {timer.isRunning ? "Pause" : "Resume"}
                        </button>
                        <button
                            className="flex items-center justify-center rounded-full bg-surface-container-highest px-4 py-3 font-label text-xs font-bold uppercase tracking-widest text-on-surface transition-all duration-300 hover:text-primary active:scale-95"
                            onClick={() => timer.addMinutes(5)}
                            type="button"
                        >
                            <MaterialIcon name="add" className="mr-2 text-sm" />
                            5 Min
                        </button>
                    </div>

                    <section className="grid grid-cols-2 gap-4">
                        <FocusMetricCard
                            icon="schedule"
                            label="Today Focus"
                            tone="text-primary"
                            value={formatFocusHours(todayFocusMinutes)}
                        />
                        <FocusMetricCard
                            icon="local_fire_department"
                            label="Active Streak"
                            tone="text-tertiary"
                            value={`${statsQuery.data.streakDays}d`}
                        />
                    </section>
                </div>
            ) : null}
        </main>
    );
}

function useFocusTimer(task: TTask | null) {
    const initialSeconds = useMemo(() => (task ? getTaskDurationMinutes(task) * 60 : 0), [task]);
    const [state, setState] = useState<FocusTimerState>({
        isRunning: Boolean(task),
        remainingSeconds: initialSeconds,
        totalSeconds: initialSeconds,
    });

    useEffect(() => {
        setState({
            isRunning: Boolean(task),
            remainingSeconds: initialSeconds,
            totalSeconds: initialSeconds,
        });
    }, [initialSeconds, task?.id]);

    useEffect(() => {
        if (!state.isRunning || state.remainingSeconds <= 0) {
            return;
        }

        const intervalId = window.setInterval(() => {
            setState((current) => ({
                ...current,
                remainingSeconds: Math.max(0, current.remainingSeconds - 1),
            }));
        }, 1000);

        return () => window.clearInterval(intervalId);
    }, [state.isRunning, state.remainingSeconds]);

    return {
        ...state,
        addMinutes: (minutes: number) =>
            setState((current) => ({
                ...current,
                remainingSeconds: current.remainingSeconds + minutes * 60,
                totalSeconds: current.totalSeconds + minutes * 60,
            })),
        toggle: () => setState((current) => ({ ...current, isRunning: !current.isRunning })),
    };
}

function FocusTimerRing({
    isRunning,
    remainingSeconds,
    totalSeconds,
}: {
    isRunning: boolean;
    remainingSeconds: number;
    totalSeconds: number;
}) {
    const elapsedPercent =
        totalSeconds > 0 ? Math.round(((totalSeconds - remainingSeconds) / totalSeconds) * 100) : 0;

    return (
        <section className="mx-auto flex max-w-sm flex-col items-center">
            <div className="relative flex aspect-square w-full max-w-72 items-center justify-center">
                <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 120 120">
                    <circle
                        className="text-surface-container-highest"
                        cx="60"
                        cy="60"
                        fill="none"
                        r="52"
                        stroke="currentColor"
                        strokeWidth="3"
                    />
                    <circle
                        className="text-primary drop-shadow-[0_0_12px_rgba(175,162,255,0.55)]"
                        cx="60"
                        cy="60"
                        fill="none"
                        pathLength={100}
                        r="52"
                        stroke="currentColor"
                        strokeDasharray={`${elapsedPercent} 100`}
                        strokeLinecap="round"
                        strokeWidth="3"
                    />
                </svg>
                <div className="text-center">
                    <p className="font-display text-5xl font-black tracking-tighter text-on-surface tabular-nums">
                        {formatRemainingTime(remainingSeconds)}
                    </p>
                    <p className="mt-2 font-label text-[10px] font-bold uppercase tracking-widest text-tertiary">
                        {isRunning ? "Remaining" : "Paused"}
                    </p>
                </div>
            </div>
        </section>
    );
}

function FocusMetricCard({ icon, label, tone, value }: FocusMetricCardProps) {
    return (
        <article className="relative overflow-hidden rounded-xl border border-outline-variant/10 bg-surface-container-low p-5 text-center">
            <div className="absolute -inset-8 bg-gradient-to-br from-primary/10 to-transparent opacity-50 blur-xl" />
            <div className="relative">
                <MaterialIcon name={icon} filled className={tone} />
                <p className="mt-3 font-display text-xl font-black tracking-tighter text-on-surface tabular-nums">
                    {value}
                </p>
                <p className="mt-1 font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                    {label}
                </p>
            </div>
        </article>
    );
}

function selectFocusTask(tasks: TTask[], now: Date) {
    const pendingTasks = tasks
        .filter((task) => task.status === "pending")
        .sort((first, second) => (first.startTime?.getTime() ?? 0) - (second.startTime?.getTime() ?? 0));

    return (
        pendingTasks.find((task) => {
            if (!task.startTime || !task.endTime) {
                return false;
            }

            const startAt = mergeDateAndTime(now, task.startTime);
            const endAt = mergeDateAndTime(now, task.endTime);
            return now >= startAt && now <= endAt;
        }) ??
        pendingTasks[0] ??
        null
    );
}

function getTodayFocusMinutes(tasks: TTask[]) {
    return tasks
        .filter((task) => task.status === "completed" || task.completedAt !== null)
        .reduce((sum, task) => sum + getTaskDurationMinutes(task), 0);
}

function getTaskDurationMinutes(task: TTask) {
    if (task.duration !== null && task.duration > 0) {
        return task.duration;
    }

    if (!task.startTime || !task.endTime) {
        return 25;
    }

    return Math.max(1, minutesOfDay(task.endTime) - minutesOfDay(task.startTime));
}

function mergeDateAndTime(date: Date, time: Date) {
    const nextDate = new Date(date);
    nextDate.setHours(time.getHours(), time.getMinutes(), time.getSeconds(), time.getMilliseconds());
    return nextDate;
}

function minutesOfDay(date: Date) {
    return date.getHours() * 60 + date.getMinutes();
}

function formatRemainingTime(seconds: number) {
    const minutes = Math.floor(seconds / 60);
    const nextSeconds = seconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(nextSeconds).padStart(2, "0")}`;
}

function formatFocusHours(minutes: number) {
    if (minutes < 60) {
        return `${minutes}m`;
    }

    return `${(minutes / 60).toFixed(1)}h`;
}

function FocusLoadingState() {
    return (
        <section className="mt-8 space-y-6">
            <div className="mx-auto aspect-square w-full max-w-72 rounded-full bg-surface-container-low" />
            <div className="h-14 rounded-full bg-surface-container-high" />
            <div className="grid grid-cols-2 gap-4">
                <div className="h-32 rounded-xl bg-surface-container-low" />
                <div className="h-32 rounded-xl bg-surface-container-low" />
            </div>
        </section>
    );
}

function FocusErrorState({ error }: { error: Error | null }) {
    return (
        <section className="mt-8 rounded-xl border border-error-dim/30 bg-error-container/10 p-5 text-error">
            <div className="flex items-center gap-2">
                <MaterialIcon name="error" filled />
                <p>{error?.message || "No se pudo cargar el modo enfoque"}</p>
            </div>
        </section>
    );
}

function FocusEmptyState() {
    return (
        <section className="mt-8 rounded-xl border border-outline-variant/15 bg-surface-container-low p-8 text-center">
            <MaterialIcon name="task_alt" className="mx-auto mb-3 text-4xl text-tertiary" />
            <h3 className="font-headline text-xl font-bold text-on-surface">Sin tarea para enfocar</h3>
            <p className="mx-auto mt-2 max-w-sm text-sm text-on-surface-variant">
                Crea o programa una tarea para activar el temporizador de enfoque.
            </p>
        </section>
    );
}
