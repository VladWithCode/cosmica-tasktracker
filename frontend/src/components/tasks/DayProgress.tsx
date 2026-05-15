import { useQuery } from "@tanstack/react-query";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { cn } from "@/lib/utils";
import { getTodayProgressOpts } from "@/queries/tasks";

export function DayProgress() {
    const { data, isError, isLoading } = useQuery(getTodayProgressOpts);

    if (isLoading) {
        return (
            <section className="mb-6 rounded-xl border border-outline-variant/10 bg-surface-container-low p-5">
                <div className="h-4 w-32 animate-pulse rounded-full bg-surface-container-highest/60" />
                <div className="mt-3 h-2 animate-pulse rounded-full bg-surface-container-highest/60" />
            </section>
        );
    }

    if (isError || !data) {
        return (
            <section
                className="mb-6 flex items-center gap-3 rounded-xl border border-outline-variant/15 bg-surface-container-low p-4 text-on-surface-variant"
                role="status"
            >
                <MaterialIcon name="info" className="text-base" />
                <p className="text-sm">No se pudo cargar el progreso del día.</p>
            </section>
        );
    }

    if (data.total === 0) {
        return (
            <section className="mb-6 flex items-center gap-3 rounded-xl border border-outline-variant/10 bg-surface-container-low p-4 text-on-surface-variant">
                <MaterialIcon name="event_available" className="text-tertiary" />
                <p className="text-sm">Sin tareas para hoy.</p>
            </section>
        );
    }

    const percentage = clampPercentage(data.percentage);
    const isCompleteDay = data.completed === data.total;

    return (
        <section
            aria-label="Progreso del día"
            className="mb-6 rounded-xl border border-outline-variant/10 bg-surface-container-low p-5"
        >
            <div className="flex items-end justify-between gap-4">
                <div>
                    <p className="font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                        Progreso del día
                    </p>
                    <p className="mt-2 font-display text-2xl font-extrabold tracking-tight text-on-surface tabular-nums">
                        {data.completed}
                        <span className="text-on-surface-variant">/{data.total}</span>
                        <span className="ml-2 text-base font-bold text-on-surface-variant">
                            completadas
                        </span>
                    </p>
                </div>
                <span
                    className={cn(
                        "rounded-full px-3 py-1 font-label text-xs font-extrabold uppercase tracking-widest tabular-nums",
                        isCompleteDay
                            ? "bg-tertiary/15 text-tertiary"
                            : "bg-primary/10 text-primary",
                    )}
                >
                    {formatPercentage(percentage)}%
                </span>
            </div>
            <div
                aria-valuemax={100}
                aria-valuemin={0}
                aria-valuenow={percentage}
                className="mt-4 h-2 overflow-hidden rounded-full bg-surface-container-highest"
                role="progressbar"
            >
                <div
                    className={cn(
                        "h-full rounded-full transition-all duration-500",
                        isCompleteDay
                            ? "bg-gradient-to-r from-tertiary to-primary"
                            : "bg-gradient-to-r from-primary to-primary-dim",
                    )}
                    style={{ width: `${percentage}%` }}
                />
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-on-surface-variant">
                {data.pending > 0 ? <span>{data.pending} pendientes</span> : null}
                {data.in_progress > 0 ? <span>{data.in_progress} en progreso</span> : null}
                {data.skipped > 0 ? <span>{data.skipped} omitidas</span> : null}
                {data.failed > 0 ? <span>{data.failed} fallidas</span> : null}
            </div>
        </section>
    );
}

function clampPercentage(value: number) {
    if (!Number.isFinite(value)) {
        return 0;
    }
    if (value < 0) {
        return 0;
    }
    if (value > 100) {
        return 100;
    }
    return value;
}

function formatPercentage(value: number) {
    return Number.isInteger(value) ? value.toString() : value.toFixed(1);
}
