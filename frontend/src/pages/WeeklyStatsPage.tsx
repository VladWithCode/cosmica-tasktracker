import { MaterialIcon } from "@/components/ui/MaterialIcon";
import type { DailyStat, WeeklyStats } from "@/hooks/useWeeklyStats";
import { useWeeklyStats } from "@/hooks/useWeeklyStats";
import { cn } from "@/lib/utils";

interface SummaryMetricProps {
    icon: string;
    label: string;
    tone: "tertiary" | "primary" | "error" | "neutral";
    value: number | string;
}

const toneClasses: Record<SummaryMetricProps["tone"], string> = {
    error: "text-error",
    neutral: "text-on-surface-variant",
    primary: "text-primary",
    tertiary: "text-tertiary",
};

export function WeeklyStatsPage() {
    const { data, error, isError, isLoading, refetch } = useWeeklyStats();

    return (
        <main className="relative z-10 mx-auto flex min-h-full max-w-md flex-col gap-6 px-6 pb-32 pt-16">
            <div className="pointer-events-none absolute left-1/2 top-20 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/5 blur-[120px]" />
            <section className="relative">
                <h2 className="font-display text-3xl font-extrabold tracking-tight text-on-surface">
                    Estadísticas
                </h2>
                <p className="mt-2 text-sm font-medium text-on-surface-variant">
                    Últimos 7 días de actividad.
                </p>
            </section>

            {isLoading ? <StatsLoadingState /> : null}
            {isError ? <StatsErrorState error={error} onRetry={refetch} /> : null}
            {!isLoading && !isError && data?.totalTasks === 0 ? <StatsEmptyState /> : null}
            {!isLoading && !isError && data && data.totalTasks > 0 ? (
                <StatsContent stats={data} />
            ) : null}
        </main>
    );
}

function StatsContent({ stats }: { stats: WeeklyStats }) {
    return (
        <>
            <section className="relative overflow-hidden rounded-xl border border-outline-variant/10 bg-surface-container-high p-6 shadow-[0_20px_40px_rgba(116,89,247,0.1)]">
                <div className="mb-5 flex items-start justify-between gap-4">
                    <div>
                        <p className="font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                            {stats.rangeLabel}
                        </p>
                        <p className="mt-2 font-display text-4xl font-black tracking-tighter text-on-surface tabular-nums">
                            {stats.completionPercent}%
                        </p>
                        <p className="mt-1 text-sm text-on-surface-variant">
                            {stats.completed} completadas de {stats.totalTasks} tareas
                        </p>
                    </div>
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-container-lowest">
                        <MaterialIcon name="monitoring" className="text-tertiary" />
                    </div>
                </div>
                <progress
                    aria-label={`Cumplimiento del periodo: ${stats.completionPercent}%`}
                    className="timeline-progress h-2.5 w-full overflow-hidden rounded-full"
                    max={100}
                    value={stats.completionPercent}
                />
                <div className="mt-5 grid grid-cols-2 gap-3">
                    <SmallStat label="Días activos" value={`${stats.activeDays}/${stats.daysCount}`} />
                    <SmallStat label="Racha actual" value={`${stats.currentStreak}d`} />
                    <SmallStat label="Historial real" value={stats.completionsCount} />
                    <SmallStat label="Mejor día" value={stats.bestDay ? `${stats.bestDay.percentage}%` : "—"} />
                </div>
            </section>

            <section className="grid grid-cols-2 gap-4" aria-label="Resumen por estado">
                <SummaryMetric icon="check_circle" label="Completadas" tone="tertiary" value={stats.completed} />
                <SummaryMetric icon="pending_actions" label="Pendientes" tone="primary" value={stats.pending} />
                <SummaryMetric icon="pause_circle" label="Omitidas" tone="neutral" value={stats.skipped} />
                <SummaryMetric icon="error" label="Fallidas" tone="error" value={stats.failed} />
            </section>

            <DailyBreakdown days={stats.dailyStats} />
        </>
    );
}

function SmallStat({ label, value }: { label: string; value: number | string }) {
    return (
        <div className="rounded-lg border border-outline-variant/10 bg-surface-container-low p-3">
            <p className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                {label}
            </p>
            <p className="mt-1 font-display text-xl font-black tracking-tighter text-on-surface tabular-nums">
                {value}
            </p>
        </div>
    );
}

function SummaryMetric({ icon, label, tone, value }: SummaryMetricProps) {
    return (
        <article className="rounded-xl border border-outline-variant/10 bg-surface-container-low p-4 transition-all duration-300 hover:-translate-y-1">
            <div className="mb-3 flex items-center justify-between">
                <MaterialIcon name={icon} filled className={cn("text-xl", toneClasses[tone])} />
                <span className="font-display text-2xl font-black tracking-tighter text-on-surface tabular-nums">
                    {value}
                </span>
            </div>
            <p className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                {label}
            </p>
        </article>
    );
}

function DailyBreakdown({ days }: { days: DailyStat[] }) {
    return (
        <section className="rounded-xl border border-outline-variant/10 bg-surface-container-high p-5 shadow-[0_15px_30px_rgba(0,0,0,0.2)]">
            <h3 className="mb-5 font-headline text-lg font-bold text-on-surface">
                Desglose diario
            </h3>
            <div className="space-y-4">
                {days.map((day) => (
                    <DailyBreakdownRow day={day} key={day.date.toISOString()} />
                ))}
            </div>
        </section>
    );
}

function DailyBreakdownRow({ day }: { day: DailyStat }) {
    return (
        <article className="rounded-lg border border-outline-variant/10 bg-surface-container-low p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                    <p className="font-label text-xs font-bold uppercase tracking-widest text-primary">
                        {day.label}
                    </p>
                    <p className="text-xs text-on-surface-variant">{formatShortDate(day.date)}</p>
                </div>
                <p className="font-display text-xl font-black tracking-tighter text-on-surface tabular-nums">
                    {day.completionPercent}%
                </p>
            </div>
            <progress
                aria-label={`${day.label}: ${day.completionPercent}% completado`}
                className="timeline-progress h-2 w-full overflow-hidden rounded-full"
                max={100}
                value={day.completionPercent}
            />
            <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                <DayCount label="Hechas" value={day.completed} />
                <DayCount label="Pend." value={day.pending} />
                <DayCount label="Omit." value={day.skipped} />
                <DayCount label="Fall." value={day.failed} />
            </div>
        </article>
    );
}

function DayCount({ label, value }: { label: string; value: number }) {
    return (
        <div>
            <p className="font-display text-sm font-black text-on-surface tabular-nums">{value}</p>
            <p className="font-label text-[9px] font-bold uppercase tracking-widest text-on-surface-variant">
                {label}
            </p>
        </div>
    );
}

function StatsLoadingState() {
    return (
        <section className="space-y-6" aria-label="Cargando estadísticas">
            <div className="h-52 animate-pulse rounded-xl bg-surface-container-high" />
            <div className="grid grid-cols-2 gap-4">
                {[0, 1, 2, 3].map((item) => (
                    <div className="h-28 animate-pulse rounded-xl bg-surface-container-low" key={item} />
                ))}
            </div>
            <div className="h-80 animate-pulse rounded-xl bg-surface-container-high" />
        </section>
    );
}

function StatsErrorState({ error, onRetry }: { error: Error | null; onRetry: () => void }) {
    return (
        <section className="rounded-xl border border-error-dim/30 bg-error-container/10 p-5 text-error">
            <div className="flex items-start gap-3">
                <MaterialIcon name="error" filled />
                <div className="min-w-0 flex-1">
                    <p className="font-label text-xs font-bold uppercase tracking-widest">
                        {error?.message || "No se pudieron cargar las estadísticas"}
                    </p>
                    <button
                        className="mt-4 rounded-full border border-error/20 px-4 py-2 font-label text-xs font-bold uppercase tracking-widest transition-all duration-300 active:scale-95"
                        onClick={onRetry}
                        type="button"
                    >
                        Reintentar
                    </button>
                </div>
            </div>
        </section>
    );
}

function StatsEmptyState() {
    return (
        <section className="rounded-xl border border-outline-variant/15 bg-surface-container-low p-8 text-center">
            <MaterialIcon name="bar_chart" className="mx-auto mb-3 text-4xl text-tertiary" />
            <p className="font-headline text-lg font-bold text-on-surface">
                Sin estadísticas todavía
            </p>
            <p className="mt-1 text-sm text-on-surface-variant">
                Completa tareas para construir tu historial de progreso.
            </p>
        </section>
    );
}

function formatShortDate(date: Date) {
    return new Intl.DateTimeFormat("es-MX", {
        day: "numeric",
        month: "short",
    }).format(date);
}
