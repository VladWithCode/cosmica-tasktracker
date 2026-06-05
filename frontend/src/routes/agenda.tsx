import { useCallback, useMemo } from "react";
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { checkAuth } from "@/auth/useAuth";
import { AppShell } from "@/components/layout/AppShell";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { cn } from "@/lib/utils";
import { getDayTasksOpts } from "@/queries/tasks";
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
        return <AgendaCalendarPlaceholder />;
    }
    return <AgendaDayView date={date} />;
}

function AgendaCalendarPlaceholder() {
    const navigate = useNavigate();
    const today = toDateString(new Date());

    return (
        <main className="relative mx-auto flex min-h-full max-w-3xl flex-col items-center justify-center px-4 pb-36 pt-6 text-center sm:px-6">
            <div className="pointer-events-none absolute left-1/2 top-16 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/5 blur-[120px]" />
            <MaterialIcon name="calendar_month" className="text-5xl text-primary/60" />
            <h2 className="mt-4 font-display text-xl font-bold text-on-surface">Calendario</h2>
            <p className="mt-2 max-w-sm font-label text-sm text-on-surface-variant">
                La vista de calendario mensual llegará pronto. Mientras tanto, abre la agenda del
                día.
            </p>
            <button
                className="mt-6 rounded-full border border-primary/30 bg-primary/10 px-5 py-2 font-label text-xs font-bold uppercase tracking-widest text-primary transition-colors hover:bg-primary/20"
                onClick={() => navigate({ to: "/agenda", search: { date: today } })}
                type="button"
            >
                Ver agenda de hoy
            </button>
        </main>
    );
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
                            <input
                                aria-label="Seleccionar fecha"
                                className="h-7 rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-2 text-xs text-on-surface focus:border-primary focus:outline-none"
                                onChange={(e) => {
                                    if (isValidDateString(e.target.value)) goToDate(e.target.value);
                                }}
                                type="date"
                                value={selectedDate}
                            />
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
