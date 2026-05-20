import { useMemo, useState } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { checkAuth } from "@/auth/useAuth";
import { AppShell } from "@/components/layout/AppShell";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { cn } from "@/lib/utils";
import {
    cancelScheduleOpts,
    getSchedulesOpts,
    pauseScheduleOpts,
    resumeScheduleOpts,
} from "@/queries/schedules";
import type { Priority, Schedule, ScheduleStatus } from "@/types/schedule";

export const Route = createFileRoute("/schedules")({
    component: SchedulesRoute,
    beforeLoad: async () => {
        const isAuthenticated = await checkAuth();
        if (!isAuthenticated) {
            throw redirect({ to: "/login" });
        }
    },
});

function SchedulesRoute() {
    return (
        <AppShell title="Rutinas" topBarAlign="center">
            <SchedulesPage />
        </AppShell>
    );
}

type StatusFilter = ScheduleStatus | "all";

const statusFilters: Array<{ value: StatusFilter; label: string }> = [
    { value: "all", label: "Todas" },
    { value: "active", label: "Activas" },
    { value: "paused", label: "Pausadas" },
    { value: "cancelled", label: "Canceladas" },
];

function SchedulesPage() {
    const schedulesQuery = useQuery(getSchedulesOpts);
    const [filter, setFilter] = useState<StatusFilter>("all");
    const pauseMutation = useMutation(pauseScheduleOpts);
    const resumeMutation = useMutation(resumeScheduleOpts);
    const cancelMutation = useMutation(cancelScheduleOpts);
    const [pendingCancel, setPendingCancel] = useState<Schedule | null>(null);

    const schedules = schedulesQuery.data ?? [];
    const filtered = useMemo(() => {
        if (filter === "all") {
            return schedules;
        }
        return schedules.filter((schedule) => schedule.status === filter);
    }, [schedules, filter]);

    return (
        <main className="relative mx-auto min-h-full max-w-3xl px-6 pb-36 pt-8">
            <div className="pointer-events-none absolute left-1/2 top-16 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/5 blur-[120px]" />

            <section className="relative mb-6">
                <p className="font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                    Configuración
                </p>
                <div className="mt-1 flex items-end justify-between gap-3">
                    <h2 className="font-display text-4xl font-extrabold tracking-tight text-on-surface">
                        Mis rutinas
                    </h2>
                    <Link
                        className="inline-flex shrink-0 items-center gap-2 rounded-full bg-gradient-to-r from-primary to-primary-dim px-4 py-2 font-label text-xs font-extrabold uppercase tracking-widest text-on-primary shadow-[0_10px_25px_rgba(175,162,255,0.28)] transition-all duration-300 hover:-translate-y-0.5 active:scale-95"
                        to="/tasks/new"
                    >
                        <MaterialIcon name="add" className="text-base" />
                        Nueva
                    </Link>
                </div>
                <p className="mt-2 text-sm text-on-surface-variant">
                    Pausa, reanuda o cancela cada configuración base.
                </p>
            </section>

            <section
                aria-label="Filtros de estado"
                className="relative mb-6 flex flex-wrap gap-2"
            >
                {statusFilters.map((option) => {
                    const active = option.value === filter;
                    const count =
                        option.value === "all"
                            ? schedules.length
                            : schedules.filter((schedule) => schedule.status === option.value).length;
                    return (
                        <button
                            key={option.value}
                            onClick={() => setFilter(option.value)}
                            type="button"
                            className={cn(
                                "rounded-full border px-3 py-1.5 font-label text-[11px] font-bold uppercase tracking-widest transition-all duration-200",
                                active
                                    ? "border-primary/40 bg-primary/15 text-primary"
                                    : "border-outline-variant/20 bg-surface-container-lowest text-on-surface-variant hover:text-primary",
                            )}
                        >
                            {option.label} ({count})
                        </button>
                    );
                })}
            </section>

            {schedulesQuery.isLoading ? <SchedulesLoadingState /> : null}
            {schedulesQuery.isError ? (
                <section className="rounded-xl border border-error-dim/30 bg-error-container/10 p-5 text-sm text-error">
                    <div className="flex items-center gap-2">
                        <MaterialIcon name="error" filled />
                        <p>
                            {schedulesQuery.error?.message ||
                                "No se pudieron cargar las rutinas."}
                        </p>
                    </div>
                </section>
            ) : null}
            {!schedulesQuery.isLoading && !schedulesQuery.isError && filtered.length === 0 ? (
                <SchedulesEmptyState hasAny={schedules.length > 0} />
            ) : null}

            {filtered.length > 0 ? (
                <ul className="relative space-y-3">
                    {filtered.map((schedule) => (
                        <ScheduleCard
                            key={schedule.id}
                            schedule={schedule}
                            isMutating={
                                pauseMutation.isPending ||
                                resumeMutation.isPending ||
                                cancelMutation.isPending
                            }
                            onPause={() =>
                                pauseMutation.mutate(schedule.id, {
                                    onError: (error) =>
                                        toast.error(error.message || "No se pudo pausar"),
                                    onSuccess: () => toast.success("Rutina pausada"),
                                })
                            }
                            onResume={() =>
                                resumeMutation.mutate(schedule.id, {
                                    onError: (error) =>
                                        toast.error(error.message || "No se pudo reanudar"),
                                    onSuccess: () => toast.success("Rutina reanudada"),
                                })
                            }
                            onRequestCancel={() => setPendingCancel(schedule)}
                        />
                    ))}
                </ul>
            ) : null}

            {pendingCancel ? (
                <CancelConfirmModal
                    schedule={pendingCancel}
                    isPending={cancelMutation.isPending}
                    onClose={() => setPendingCancel(null)}
                    onConfirm={() =>
                        cancelMutation.mutate(pendingCancel.id, {
                            onError: (error) =>
                                toast.error(error.message || "No se pudo cancelar"),
                            onSuccess: () => {
                                toast.success("Rutina cancelada");
                                setPendingCancel(null);
                            },
                        })
                    }
                />
            ) : null}
        </main>
    );
}

interface ScheduleCardProps {
    schedule: Schedule;
    isMutating: boolean;
    onPause: () => void;
    onResume: () => void;
    onRequestCancel: () => void;
}

function ScheduleCard({
    schedule,
    isMutating,
    onPause,
    onResume,
    onRequestCancel,
}: ScheduleCardProps) {
    const status = schedule.status;
    const isCancelled = status === "cancelled";

    return (
        <li className="relative overflow-hidden rounded-xl border border-outline-variant/10 bg-surface-container-low p-4 shadow-[0_10px_30px_rgba(0,0,0,0.18)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={status} />
                        <PriorityBadge priority={schedule.priority} />
                        {schedule.isRequired || schedule.required ? (
                            <span className="rounded-full bg-tertiary/15 px-2 py-0.5 font-label text-[10px] font-extrabold uppercase tracking-widest text-tertiary">
                                Vital
                            </span>
                        ) : null}
                        {schedule.category ? (
                            <span className="rounded-full bg-surface-container-highest px-2 py-0.5 font-label text-[10px] font-extrabold uppercase tracking-widest text-on-surface-variant">
                                {schedule.category}
                            </span>
                        ) : null}
                        {schedule.frequencyConfig?.waterReminder ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-tertiary/15 px-2 py-0.5 font-label text-[10px] font-extrabold uppercase tracking-widest text-tertiary">
                                <MaterialIcon name="notifications_active" className="text-xs" />
                                Recordatorio
                            </span>
                        ) : null}
                    </div>
                    <h3 className="mt-2 break-words font-headline text-lg font-bold text-on-surface">
                        {schedule.title || "(sin título)"}
                    </h3>
                    {schedule.description ? (
                        <p className="mt-1 break-words text-sm leading-6 text-on-surface-variant">
                            {schedule.description}
                        </p>
                    ) : null}
                </div>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                <Meta icon="schedule" label="Horario" value={formatTimeRange(schedule)} />
                <Meta icon="timer" label="Duración" value={formatDuration(schedule.durationMinutes)} />
                <Meta icon="repeat" label="Frecuencia" value={formatFrequency(schedule)} />
                <Meta
                    icon="flag"
                    label="Contador"
                    value={schedule.targetCount ? `Meta: ${schedule.targetCount}` : "—"}
                />
                <Meta icon="event" label="Inicio" value={formatDate(schedule.startDate)} />
                <Meta icon="event_busy" label="Fin" value={formatDate(schedule.endDate)} />
            </dl>

            <div className="mt-4 flex flex-wrap items-center gap-2">
                {status === "active" ? (
                    <ActionButton
                        icon="pause"
                        label="Pausar"
                        onClick={onPause}
                        disabled={isMutating}
                    />
                ) : null}
                {status === "paused" ? (
                    <ActionButton
                        icon="play_arrow"
                        label="Reanudar"
                        onClick={onResume}
                        disabled={isMutating}
                    />
                ) : null}
                {!isCancelled ? (
                    <ActionButton
                        icon="cancel"
                        label="Cancelar"
                        tone="danger"
                        onClick={onRequestCancel}
                        disabled={isMutating}
                    />
                ) : null}
            </div>
        </li>
    );
}

interface ActionButtonProps {
    icon: string;
    label: string;
    onClick: () => void;
    disabled?: boolean;
    tone?: "default" | "danger";
}

function ActionButton({ icon, label, onClick, disabled, tone = "default" }: ActionButtonProps) {
    return (
        <button
            className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-label text-[11px] font-bold uppercase tracking-widest transition-all duration-200 hover:-translate-y-0.5 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50",
                tone === "danger"
                    ? "border-error/30 bg-error/10 text-error"
                    : "border-outline-variant/20 bg-surface-container-highest text-on-surface hover:text-primary",
            )}
            disabled={disabled}
            onClick={onClick}
            type="button"
        >
            <MaterialIcon name={icon} className="text-sm" />
            {label}
        </button>
    );
}

function Meta({ icon, label, value }: { icon: string; label: string; value: string }) {
    return (
        <div className="flex min-w-0 items-start gap-2 rounded-lg border border-outline-variant/10 bg-surface-container-lowest p-2.5">
            <MaterialIcon name={icon} className="mt-0.5 shrink-0 text-base text-primary" />
            <div className="min-w-0">
                <p className="font-label text-[9px] font-extrabold uppercase tracking-widest text-on-surface-variant">
                    {label}
                </p>
                <p className="truncate text-xs font-semibold text-on-surface">{value}</p>
            </div>
        </div>
    );
}

function StatusBadge({ status }: { status: ScheduleStatus }) {
    const styles: Record<ScheduleStatus, string> = {
        active: "bg-primary/15 text-primary",
        paused: "bg-tertiary/15 text-tertiary",
        cancelled: "bg-error/15 text-error",
    };
    const labels: Record<ScheduleStatus, string> = {
        active: "Activa",
        paused: "Pausada",
        cancelled: "Cancelada",
    };
    return (
        <span
            className={cn(
                "rounded-full px-2 py-0.5 font-label text-[10px] font-extrabold uppercase tracking-widest",
                styles[status] ?? "bg-surface-container-highest text-on-surface-variant",
            )}
        >
            {labels[status] ?? status}
        </span>
    );
}

function PriorityBadge({ priority }: { priority: Priority }) {
    const styles: Record<Priority, string> = {
        urgent: "border-error/40 text-error",
        high: "border-primary/40 text-primary",
        medium: "border-tertiary/40 text-tertiary",
        low: "border-outline-variant/30 text-on-surface-variant",
    };
    return (
        <span
            className={cn(
                "rounded-full border px-2 py-0.5 font-label text-[10px] font-extrabold uppercase tracking-widest",
                styles[priority] ?? styles.medium,
            )}
        >
            {priority}
        </span>
    );
}

function CancelConfirmModal({
    schedule,
    isPending,
    onClose,
    onConfirm,
}: {
    schedule: Schedule;
    isPending: boolean;
    onClose: () => void;
    onConfirm: () => void;
}) {
    return (
        <div
            className="fixed inset-0 z-[80] flex items-end justify-center bg-surface-container-lowest/70 px-4 pb-6 backdrop-blur-sm md:items-center"
            onClick={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <section className="w-full max-w-md rounded-xl border border-outline-variant/15 bg-surface-container-low p-6 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
                <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-error/10 text-error">
                        <MaterialIcon name="warning_amber" className="text-2xl" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="font-headline text-xl font-bold text-on-surface">
                            Cancelar rutina
                        </h3>
                        <p className="mt-2 break-words text-sm leading-6 text-on-surface-variant">
                            "{schedule.title || "(sin título)"}" dejará de generar nuevas tareas.
                            Tu historial previo se conserva.
                        </p>
                    </div>
                </div>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
                    <button
                        className="rounded-full border border-outline-variant/15 bg-surface-container-highest px-5 py-3 text-sm font-bold text-on-surface transition-all duration-300 hover:-translate-y-1 active:scale-95"
                        disabled={isPending}
                        onClick={onClose}
                        type="button"
                    >
                        Volver
                    </button>
                    <button
                        className="rounded-full bg-error px-6 py-3 text-sm font-extrabold uppercase tracking-widest text-on-error shadow-[0_15px_40px_rgba(255,110,132,0.28)] transition-all duration-300 hover:-translate-y-1 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={isPending}
                        onClick={onConfirm}
                        type="button"
                    >
                        {isPending ? "Cancelando..." : "Cancelar rutina"}
                    </button>
                </div>
            </section>
        </div>
    );
}

function SchedulesLoadingState() {
    return (
        <div className="space-y-3">
            {Array.from({ length: 3 }, (_, index) => (
                <div className="h-36 animate-pulse rounded-xl bg-surface-container-low" key={index} />
            ))}
        </div>
    );
}

function SchedulesEmptyState({ hasAny }: { hasAny: boolean }) {
    return (
        <section className="space-y-4">
            <div className="rounded-xl border border-outline-variant/15 bg-surface-container-low p-8 text-center">
                <MaterialIcon name="event_repeat" className="mx-auto mb-3 text-4xl text-tertiary" />
                <h3 className="font-headline text-xl font-bold text-on-surface">
                    {hasAny ? "Sin rutinas en este filtro" : "Aún no tienes rutinas"}
                </h3>
                <p className="mx-auto mt-2 max-w-sm text-sm text-on-surface-variant">
                    {hasAny
                        ? "Cambia el filtro o crea una nueva rutina."
                        : "Crea tu primera rutina para empezar a generar tareas automáticamente."}
                </p>
                <Link
                    className="mt-5 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-primary-dim px-5 py-2.5 font-label text-xs font-extrabold uppercase tracking-widest text-on-primary shadow-[0_10px_25px_rgba(175,162,255,0.28)] transition-all duration-300 hover:-translate-y-0.5 active:scale-95"
                    to="/tasks/new"
                >
                    <MaterialIcon name="add" className="text-base" />
                    Crear rutina
                </Link>
            </div>
            {!hasAny ? <WaterRoutineCTA /> : null}
        </section>
    );
}

function WaterRoutineCTA() {
    return (
        <Link
            to="/tasks/new"
            className="group flex items-center gap-4 rounded-xl border border-tertiary/20 bg-tertiary/5 p-4 transition-all duration-300 hover:-translate-y-0.5 hover:bg-tertiary/10 active:scale-[0.99]"
        >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-tertiary/15 text-tertiary">
                <MaterialIcon name="local_drink" filled className="text-2xl" />
            </span>
            <span className="min-w-0 flex-1">
                <span className="block font-headline text-sm font-bold text-on-surface">
                    Comenzar con hidratación
                </span>
                <span className="block text-xs text-on-surface-variant">
                    Preset: Tomar agua · 8 vasos · diario
                </span>
            </span>
            <MaterialIcon
                name="arrow_forward"
                className="shrink-0 text-tertiary transition-transform duration-300 group-hover:translate-x-1"
            />
        </Link>
    );
}

function formatTimeRange(schedule: Schedule): string {
    if (schedule.startTime && schedule.endTime) {
        return `${formatTime(schedule.startTime)}–${formatTime(schedule.endTime)}`;
    }
    if (schedule.startTime) {
        return `Desde ${formatTime(schedule.startTime)}`;
    }
    if (schedule.endTime) {
        return `Hasta ${formatTime(schedule.endTime)}`;
    }
    return "Sin horario";
}

function formatTime(value: string): string {
    const match = value.match(/^(\d{2}):(\d{2})/);
    if (match) {
        return `${match[1]}:${match[2]}`;
    }
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
        return parsed.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
    }
    return value;
}

function formatDuration(minutes: number | null | undefined): string {
    if (!minutes || minutes <= 0) {
        return "—";
    }
    if (minutes < 60) {
        return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

function formatFrequency(schedule: Schedule): string {
    const base = schedule.frequency || "daily";
    const labels: Record<string, string> = {
        daily: "Diaria",
        weekly: "Semanal",
        monthly: "Mensual",
        custom: "Personalizada",
    };
    return labels[base] ?? base;
}

function formatDate(value: string | null): string {
    if (!value) {
        return "—";
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return value;
    }
    return parsed.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}
