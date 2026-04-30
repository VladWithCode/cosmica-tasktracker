import { AppShell } from "@/components/layout/AppShell";
import { FloatingActionButton } from "@/components/layout/FloatingActionButton";
import { HourRow } from "@/components/tasks/scheduleList";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useLayoutEffect, useMemo, useRef } from "react";
import type { TTask } from "@/lib/schemas/task";
import { getTodayTasksOpts } from "@/queries/tasks";

export const Route = createFileRoute("/tasks/")({
    component: RouteComponent,
});

function RouteComponent() {
    const taskListRef = useRef<HTMLDivElement>(null);
    const { data, error, isError, isLoading } = useQuery(getTodayTasksOpts);
    const tasks = data?.tasks ?? [];
    const hours = useMemo(() => createHours(tasks), [tasks]);
    const completedCount = tasks.filter((task) => task.status === "completed").length;
    const pendingCount = tasks.length - completedCount;
    const progress = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

    useLayoutEffect(() => {
        if (!taskListRef.current || tasks.length === 0) {
            return;
        }

        scrollToCurrentHour(taskListRef.current);

        const intervalId = setInterval(() => {
            scrollToCurrentHour(taskListRef.current!);
        }, 1000 * 60 * 5);

        return () => {
            clearInterval(intervalId);
        };
    }, [tasks.length]);

    return (
        <AppShell contentClassName="overflow-hidden">
            <main className="relative h-full bg-surface text-on-surface">
                <div className="pointer-events-none absolute left-1/2 top-12 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/5 blur-[120px]" />
                <ScrollArea className="h-full w-full" ref={taskListRef}>
                    <div className="relative mx-auto flex min-h-full max-w-4xl flex-col gap-6 px-6 pb-36 pt-8">
                        <section className="space-y-5">
                            <div>
                                <p className="font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                                    Rutina diaria
                                </p>
                                <h2 className="mt-2 font-display text-4xl font-extrabold tracking-tight text-on-surface">
                                    Tareas
                                </h2>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <TaskStatCard
                                    icon="task_alt"
                                    label="Total"
                                    value={tasks.length}
                                    tone="text-tertiary"
                                />
                                <TaskStatCard
                                    icon="done_all"
                                    label="Hechas"
                                    value={completedCount}
                                    tone="text-primary"
                                />
                                <TaskStatCard
                                    icon="pending_actions"
                                    label="Pendientes"
                                    value={pendingCount}
                                    tone="text-error"
                                />
                            </div>
                            <section className="rounded-xl border border-outline-variant/10 bg-surface-container-low p-5">
                                <div className="mb-3 flex items-end justify-between">
                                    <div>
                                        <p className="font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                                            Progreso
                                        </p>
                                        <p className="font-display text-2xl font-black tracking-tighter text-tertiary tabular-nums">
                                            {progress}% Done
                                        </p>
                                    </div>
                                    <MaterialIcon
                                        name="check_circle"
                                        filled
                                        className="text-3xl text-tertiary"
                                    />
                                </div>
                                <progress
                                    aria-label="Progreso de tareas del día"
                                    className="timeline-progress h-3 w-full overflow-hidden rounded-full"
                                    max={100}
                                    value={progress}
                                />
                            </section>
                        </section>

                        {isLoading ? <TasksLoadingState /> : null}
                        {isError ? <TasksErrorState error={error} /> : null}
                        {!isLoading && !isError && tasks.length === 0 ? <TasksEmptyState /> : null}
                        {!isLoading && !isError && tasks.length > 0 ? (
                            <section className="grid auto-rows-auto grid-cols-[5rem_1fr] gap-x-4 gap-y-4 md:grid-cols-[6rem_1fr]">
                                {hours}
                            </section>
                        ) : null}
                    </div>
                    <div className="pointer-events-none absolute inset-0 z-30">
                        <ScrollBar />
                    </div>
                </ScrollArea>
                <FloatingActionButton />
            </main>
        </AppShell>
    );
}

interface TaskStatCardProps {
    icon: string;
    label: string;
    tone: string;
    value: number;
}

function TaskStatCard({ icon, label, tone, value }: TaskStatCardProps) {
    return (
        <article className="relative overflow-hidden rounded-xl bg-surface-container-high p-4 text-center shadow-[0_10px_30px_rgba(116,89,247,0.08)]">
            <div className="absolute -inset-4 bg-gradient-to-br from-primary/10 to-transparent opacity-40 blur-xl" />
            <div className="relative">
                <MaterialIcon name={icon} filled className={tone} />
                <p className="mt-1 font-display text-2xl font-black tracking-tighter tabular-nums text-on-surface">
                    {value}
                </p>
                <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                    {label}
                </p>
            </div>
        </article>
    );
}

function createHours(tasks: TTask[]) {
    let currentHour = new Date().getHours();
    return Array.from({ length: 24 }, (_, hour) => {
        const hourTasks = tasks.filter((task) => task.startTime?.getHours() === hour);
        return (
            <HourRow
                key={hour}
                hour={hour}
                tasks={hourTasks}
                isCurrentHour={hour === currentHour}
            />
        );
    });
}

function scrollToCurrentHour(taskListElt: HTMLElement) {
    const currentHour = new Date().getHours();
    const hourContainer = document.querySelector(`[data-testid="hour-${currentHour}"]`);
    const scrollViewport = taskListElt.querySelector('[data-slot="scroll-area-viewport"]');

    if (hourContainer && scrollViewport) {
        const rect = hourContainer.getBoundingClientRect();
        scrollViewport.scrollBy({ top: rect.top - rect.height, behavior: "smooth" });
    }
}

function TasksLoadingState() {
    return (
        <section className="space-y-4">
            {Array.from({ length: 4 }, (_, item) => (
                <div className="grid grid-cols-[5rem_1fr] gap-4 md:grid-cols-[6rem_1fr]" key={item}>
                    <div className="h-20 rounded-xl bg-surface-container-highest/60" />
                    <div className="h-20 rounded-xl bg-surface-container-low" />
                </div>
            ))}
        </section>
    );
}

function TasksErrorState({ error }: { error: Error | null }) {
    return (
        <section className="rounded-xl border border-error-dim/30 bg-error-container/10 p-5 text-error">
            <div className="flex items-center gap-2">
                <MaterialIcon name="error" filled />
                <p>{error?.message || "No se pudieron cargar las tareas"}</p>
            </div>
        </section>
    );
}

function TasksEmptyState() {
    return (
        <section className="rounded-xl border border-outline-variant/15 bg-surface-container-low p-8 text-center">
            <MaterialIcon name="event_available" className="mx-auto mb-3 text-4xl text-tertiary" />
            <h3 className="font-headline text-xl font-bold text-on-surface">Sin tareas para hoy</h3>
            <p className="mx-auto mt-2 max-w-sm text-sm text-on-surface-variant">
                Crea una tarea para empezar a organizar el flujo del día.
            </p>
        </section>
    );
}
