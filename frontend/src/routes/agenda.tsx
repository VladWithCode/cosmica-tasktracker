import { useCallback, useMemo, useState } from "react";
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { checkAuth } from "@/auth/useAuth";
import { AgendaCalendar } from "@/components/agenda/AgendaCalendar";
import { AppShell } from "@/components/layout/AppShell";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/apiFetch";
import { cn } from "@/lib/utils";
import { queryClient } from "@/queries/queryClient";
import { getDayTasksOpts, TasksQueryKeys } from "@/queries/tasks";
import type { TaskFeedItem } from "@/types/task";

type AgendaSearch = {
    date?: string;
};

function toDateString(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

/**
 * Safe YYYY-MM-DD validation. Rejects bad shapes and impossible dates
 * (e.g. 2025-02-31) by round-tripping through Date.
 */
function isValidDateString(value: unknown): value is string {
    if (typeof value !== "string") return false;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const d = new Date(value + "T12:00:00");
    if (Number.isNaN(d.getTime())) return false;
    return toDateString(d) === value;
}

export const Route = createFileRoute("/agenda")({
    component: AgendaRoute,
    validateSearch: (search: Record<string, unknown>): AgendaSearch => {
        return isValidDateString(search.date) ? { date: search.date } : {};
    },
    beforeLoad: async () => {
        const isAuthenticated = await checkAuth();
        if (!isAuthenticated) {
            throw redirect({ to: "/login" });
        }
    },
});

function AgendaRoute() {
    return (
        <AppShell title="Agenda" topBarAlign="center">
            <AgendaPage />
        </AppShell>
    );
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

/**
 * URL-driven agenda mode:
 *   /agenda                  -> calendar mode (monthly, placeholder for now)
 *   /agenda?date=YYYY-MM-DD  -> day mode (hourly view)
 */
function AgendaPage() {
    const { date } = Route.useSearch();
    if (!date) {
        return <AgendaCalendar />;
    }
    return <AgendaDayView date={date} />;
}

function AgendaDayView({ date: selectedDate }: { date: string }) {
    const navigate = useNavigate();
    const { data, isLoading, isError, error } = useQuery(getDayTasksOpts(selectedDate));

    const feedItems = data?.feedItems ?? [];

    const tasksByHour = useMemo(() => {
        const map = new Map<number | null, TaskFeedItem[]>();
        for (const item of feedItems) {
            const hour = item.schedule_start_time
                ? Number.parseInt(item.schedule_start_time.split(":")[0] ?? "0", 10)
                : null;
            const list = map.get(hour) ?? [];
            list.push(item);
            map.set(hour, list);
        }
        return map;
    }, [feedItems]);

    const unscheduled = tasksByHour.get(null) ?? [];

    const goToDate = useCallback(
        (next: string) => navigate({ to: "/agenda", search: { date: next } }),
        [navigate],
    );
    const goCalendar = useCallback(
        () => navigate({ to: "/agenda", search: {} }),
        [navigate],
    );
    const goToday = useCallback(() => goToDate(toDateString(new Date())), [goToDate]);
    const goPrev = useCallback(() => {
        const d = new Date(selectedDate + "T12:00:00");
        d.setDate(d.getDate() - 1);
        goToDate(toDateString(d));
    }, [selectedDate, goToDate]);
    const goNext = useCallback(() => {
        const d = new Date(selectedDate + "T12:00:00");
        d.setDate(d.getDate() + 1);
        goToDate(toDateString(d));
    }, [selectedDate, goToDate]);

    const isToday = selectedDate === toDateString(new Date());
    const [quickTaskOpen, setQuickTaskOpen] = useState(false);

    const formattedDate = useMemo(() => {
        const d = new Date(selectedDate + "T12:00:00");
        return d.toLocaleDateString("es-MX", {
            weekday: "long",
            day: "2-digit",
            month: "long",
            year: "numeric",
        });
    }, [selectedDate]);

    return (
        <main className="relative mx-auto min-h-full max-w-3xl px-4 pb-36 pt-6 sm:px-6">
            <div className="pointer-events-none absolute left-1/2 top-16 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/5 blur-[120px]" />

            {/* Quick one-off task creation */}
            <div className="relative mb-2 flex justify-end">
                <button
                    aria-label="Agregar tarea"
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary shadow-sm transition-all hover:scale-105 hover:bg-primary/20 active:scale-95"
                    onClick={() => setQuickTaskOpen(true)}
                    type="button"
                >
                    <MaterialIcon name="add" className="text-2xl" />
                </button>
            </div>
            <QuickTaskDialog
                open={quickTaskOpen}
                onOpenChange={setQuickTaskOpen}
                selectedDate={selectedDate}
            />

            {/* Date navigation */}
            <section className="relative mb-6">
                <div className="flex items-center justify-between gap-2">
                    <button
                        aria-label="Día anterior"
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-outline-variant/20 bg-surface-container-lowest text-on-surface-variant transition-colors hover:text-primary"
                        onClick={goPrev}
                        type="button"
                    >
                        <MaterialIcon name="chevron_left" className="text-2xl" />
                    </button>

                    <div className="flex flex-1 flex-col items-center gap-1">
                        <p className="text-center font-display text-lg font-bold capitalize text-on-surface sm:text-xl">
                            {formattedDate}
                        </p>
                        <div className="flex items-center gap-2">
                            {!isToday ? (
                                <button
                                    className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-label text-[11px] font-bold uppercase tracking-widest text-primary transition-colors hover:bg-primary/20"
                                    onClick={goToday}
                                    type="button"
                                >
                                    Hoy
                                </button>
                            ) : (
                                <span className="rounded-full bg-primary/15 px-3 py-1 font-label text-[11px] font-bold uppercase tracking-widest text-primary">
                                    Hoy
                                </span>
                            )}
                        </div>
                    </div>

                    <button
                        aria-label="Día siguiente"
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-outline-variant/20 bg-surface-container-lowest text-on-surface-variant transition-colors hover:text-primary"
                        onClick={goNext}
                        type="button"
                    >
                        <MaterialIcon name="chevron_right" className="text-2xl" />
                    </button>
                </div>

                <div className="mt-2 flex items-center justify-center gap-3">
                    <p className="font-label text-xs text-on-surface-variant">
                        {feedItems.length} {feedItems.length === 1 ? "tarea" : "tareas"}
                    </p>
                    <button
                        className="inline-flex items-center gap-1 rounded-full border border-outline-variant/30 bg-surface-container-lowest px-3 py-1 font-label text-[11px] font-bold uppercase tracking-widest text-on-surface-variant transition-colors hover:text-primary"
                        onClick={goCalendar}
                        type="button"
                    >
                        <MaterialIcon name="calendar_month" className="text-sm" />
                        Ver calendario
                    </button>
                </div>
            </section>

            {isLoading ? (
                <div className="space-y-2">
                    {Array.from({ length: 6 }, (_, i) => (
                        <div className="h-14 animate-pulse rounded-lg bg-surface-container-low" key={i} />
                    ))}
                </div>
            ) : null}

            {isError ? (
                <div className="rounded-xl border border-error-dim/30 bg-error-container/10 p-5 text-sm text-error">
                    <div className="flex items-center gap-2">
                        <MaterialIcon name="error" filled />
                        <p>{error?.message || "No se pudieron cargar las tareas."}</p>
                    </div>
                </div>
            ) : null}

            {!isLoading && !isError ? (
                <>
                    {/* Unscheduled tasks */}
                    {unscheduled.length > 0 ? (
                        <section className="relative mb-4">
                            <div className="mb-2 flex items-center gap-2">
                                <MaterialIcon name="event_busy" className="text-sm text-on-surface-variant" />
                                <span className="font-label text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
                                    Sin horario
                                </span>
                            </div>
                            <div className="space-y-1.5">
                                {unscheduled.map((task) => (
                                    <AgendaTaskCard key={task.id} task={task} />
                                ))}
                            </div>
                        </section>
                    ) : null}

                    {/* Hourly grid */}
                    <section className="relative" aria-label="Agenda por horas">
                        {HOURS.map((hour) => {
                            const tasks = tasksByHour.get(hour) ?? [];
                            return (
                                <HourRow key={hour} hour={hour} tasks={tasks} />
                            );
                        })}
                    </section>
                </>
            ) : null}
        </main>
    );
}

function QuickTaskDialog({
    open,
    onOpenChange,
    selectedDate,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    selectedDate: string;
}) {
    const [title, setTitle] = useState("");
    const [time, setTime] = useState("");

    const reset = useCallback(() => {
        setTitle("");
        setTime("");
    }, []);

    const createTask = useMutation({
        mutationFn: async () => {
            // Build literal-UTC strings so the chosen wall-clock day/hour are
            // preserved server-side without timezone drift (backend reads the
            // UTC clock of these fields).
            const startTime = `${selectedDate}T${time}:00Z`;
            const startDate = `${selectedDate}T00:00:00Z`;
            const response = await apiFetch("/api/v1/tasks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    title: title.trim(),
                    startTime,
                    startDate,
                    repeating: false,
                    frequency: "custom",
                    frequencyConfig: { singleInstance: true },
                    priority: "medium",
                }),
            });
            if (!response.ok) {
                throw new Error("No se pudo crear la tarea");
            }
            return response.json();
        },
        onSuccess: async () => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: TasksQueryKeys.byDate(selectedDate) }),
                queryClient.invalidateQueries({ queryKey: TasksQueryKeys.history() }),
                queryClient.invalidateQueries({ queryKey: TasksQueryKeys.progress() }),
            ]);
            toast.success("Tarea creada");
            reset();
            onOpenChange(false);
        },
        onError: (err: Error) => {
            toast.error(err.message || "Ocurrió un error al crear la tarea");
        },
    });

    const canSubmit = title.trim().length > 0 && time.length > 0 && !createTask.isPending;

    const handleOpenChange = (next: boolean) => {
        if (!next) {
            reset();
        }
        onOpenChange(next);
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Nueva tarea</DialogTitle>
                    <DialogDescription>Agrega una tarea para este día.</DialogDescription>
                </DialogHeader>

                <form
                    className="space-y-4"
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (canSubmit) {
                            createTask.mutate();
                        }
                    }}
                >
                    <div className="space-y-2">
                        <Label htmlFor="quick-task-title">¿Qué se va a hacer?</Label>
                        <Input
                            id="quick-task-title"
                            autoFocus
                            placeholder="Escribe la tarea"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="quick-task-time">Horario</Label>
                        <Input
                            id="quick-task-time"
                            type="time"
                            value={time}
                            onChange={(e) => setTime(e.target.value)}
                        />
                    </div>

                    <DialogFooter className="gap-2 sm:gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleOpenChange(false)}
                        >
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={!canSubmit}>
                            {createTask.isPending ? "Creando..." : "Crear"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function HourRow({ hour, tasks }: { hour: number; tasks: TaskFeedItem[] }) {
    const label = `${String(hour).padStart(2, "0")}:00`;
    const hasTasks = tasks.length > 0;

    return (
        <div
            className={cn(
                "flex min-h-[3.25rem] border-t border-outline-variant/10",
                hasTasks && "bg-surface-container-lowest/50",
            )}
        >
            <div className="flex w-14 shrink-0 items-start justify-end pr-3 pt-2">
                <span
                    className={cn(
                        "font-mono text-[11px] tabular-nums",
                        hasTasks ? "font-bold text-primary" : "text-on-surface-variant/50",
                    )}
                >
                    {label}
                </span>
            </div>
            <div className="flex-1 space-y-1 py-1.5 pl-3">
                {tasks.map((task) => (
                    <AgendaTaskCard key={task.id} task={task} />
                ))}
            </div>
        </div>
    );
}

function AgendaTaskCard({ task }: { task: TaskFeedItem }) {
    const isCompleted = task.status_level === "completed";
    const isSkipped = task.status_level === "skipped";
    const isUrgent = task.priority_level === "urgent" || task.priority_level === "high";

    const timeRange = formatTimeRange(task.schedule_start_time, task.schedule_end_time);

    return (
        <Link
            className={cn(
                "group flex items-center gap-3 rounded-lg border px-3 py-2 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
                isCompleted
                    ? "border-primary/20 bg-primary/5"
                    : isSkipped
                      ? "border-outline-variant/15 bg-surface-container-low opacity-60"
                      : "border-outline-variant/15 bg-surface-container-low",
            )}
            to="/tasks/$id"
            params={{ id: task.id }}
        >
            {/* Status icon */}
            <div
                className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                    isCompleted
                        ? "bg-primary/15 text-primary"
                        : isSkipped
                          ? "bg-on-surface-variant/10 text-on-surface-variant"
                          : isUrgent
                            ? "bg-error/10 text-error"
                            : "bg-tertiary/10 text-tertiary",
                )}
            >
                <MaterialIcon
                    name={isCompleted ? "check_circle" : isSkipped ? "skip_next" : "radio_button_unchecked"}
                    filled={isCompleted}
                    className="text-lg"
                />
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1">
                <p
                    className={cn(
                        "truncate text-sm font-semibold",
                        isCompleted
                            ? "text-on-surface-variant line-through"
                            : "text-on-surface",
                    )}
                >
                    {task.title}
                </p>
                {timeRange ? (
                    <p className="text-[11px] text-on-surface-variant">{timeRange}</p>
                ) : null}
            </div>

            {/* Badges */}
            <div className="flex shrink-0 items-center gap-1.5">
                {isUrgent && !isCompleted ? (
                    <span className="rounded-full border border-error/30 px-1.5 py-0.5 font-label text-[9px] font-extrabold uppercase tracking-widest text-error">
                        Urgente
                    </span>
                ) : null}
                {task.is_required && !isCompleted ? (
                    <span className="rounded-full bg-tertiary/15 px-1.5 py-0.5 font-label text-[9px] font-extrabold uppercase tracking-widest text-tertiary">
                        Vital
                    </span>
                ) : null}
                <MaterialIcon
                    name="chevron_right"
                    className="text-base text-on-surface-variant/40 transition-colors group-hover:text-primary"
                />
            </div>
        </Link>
    );
}

function formatTimeRange(start?: string | null, end?: string | null): string | null {
    if (!start && !end) return null;
    if (start && end) return `${start} – ${end}`;
    if (start) return `Desde ${start}`;
    return `Hasta ${end}`;
}
