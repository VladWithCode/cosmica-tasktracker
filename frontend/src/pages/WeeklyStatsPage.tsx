import { MaterialIcon } from "@/components/ui/MaterialIcon";
import type { DailyStat, WeeklyStats } from "@/hooks/useWeeklyStats";
import { useWeeklyStats } from "@/hooks/useWeeklyStats";
import { cn } from "@/lib/utils";

interface GaugeCardProps {
    label: string;
    percent: number;
    tone: "tertiary" | "primary" | "error";
}

interface WeeklyGoalCardProps {
    completionPercent: number;
}

interface StackedBreakdownChartProps {
    days: DailyStat[];
}

interface GaugeTone {
    className: string;
    glowClassName: string;
}

const gaugeTones: Record<GaugeCardProps["tone"], GaugeTone> = {
    tertiary: {
        className: "text-tertiary",
        glowClassName: "drop-shadow-[0_0_8px_rgba(129,236,255,0.5)]",
    },
    primary: {
        className: "text-primary",
        glowClassName: "drop-shadow-[0_0_8px_rgba(175,162,255,0.4)]",
    },
    error: {
        className: "text-error",
        glowClassName: "drop-shadow-[0_0_8px_rgba(255,110,132,0.4)]",
    },
};

export function WeeklyStatsPage() {
    const { data, error, isError, isLoading } = useWeeklyStats();

    return (
        <main className="relative z-10 mx-auto flex min-h-full max-w-md flex-col gap-8 px-6 pb-32 pt-16">
            <div className="pointer-events-none absolute left-1/2 top-20 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/5 blur-[120px]" />
            <section className="relative">
                <h2 className="font-display text-3xl font-extrabold tracking-tight text-on-surface">
                    Estadísticas
                </h2>
            </section>

            {isLoading ? <DetailedStatsLoadingState /> : null}
            {isError ? <DetailedStatsErrorState error={error} /> : null}
            {!isLoading && !isError && data?.totalTasks === 0 ? <DetailedStatsEmptyState /> : null}
            {!isLoading && !isError && data && data.totalTasks > 0 ? (
                <DetailedStatsContent stats={data} />
            ) : null}
        </main>
    );
}

function DetailedStatsContent({ stats }: { stats: WeeklyStats }) {
    return (
        <>
            <WeeklyGoalCard completionPercent={stats.completionPercent} />

            <section className="grid grid-cols-3 gap-4" aria-label="Resumen de cumplimiento">
                <GaugeCard label="A Tiempo" percent={stats.onTimePercent} tone="tertiary" />
                <GaugeCard label="Tarde" percent={stats.latePercent} tone="primary" />
                <GaugeCard label="Falladas" percent={stats.failedPercent} tone="error" />
            </section>

            <StackedBreakdownChart days={stats.dailyStats} />
        </>
    );
}

function WeeklyGoalCard({ completionPercent }: WeeklyGoalCardProps) {
    return (
        <section className="group relative overflow-hidden rounded-xl bg-surface-container-high p-6 shadow-[0_20px_40px_rgba(116,89,247,0.1)]">
            <div className="mb-4 flex items-end justify-between">
                <div>
                    <h3 className="mb-1 font-label text-xs font-medium uppercase tracking-wider text-on-surface-variant">
                        Meta Semanal
                    </h3>
                    <p className="font-display text-3xl font-black tracking-tighter text-on-surface tabular-nums">
                        {completionPercent}%
                    </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-lowest">
                    <MaterialIcon name="bolt" className="text-tertiary" />
                </div>
            </div>
            <progress
                aria-label={`Meta semanal: ${completionPercent}%`}
                className="timeline-progress mt-2 h-2.5 w-full overflow-hidden rounded-full"
                max={100}
                value={completionPercent}
            />
        </section>
    );
}

function GaugeCard({ label, percent, tone }: GaugeCardProps) {
    const toneClasses = gaugeTones[tone];

    return (
        <article className="flex min-h-44 flex-col items-center justify-center gap-3 rounded-xl bg-surface-container-low p-4 transition-all duration-300 hover:-translate-y-1">
            <div className="relative flex h-16 w-16 items-center justify-center">
                <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                    <path
                        className="text-surface-container-highest"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="4"
                    />
                    <path
                        className={cn(toneClasses.className, toneClasses.glowClassName)}
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="currentColor"
                        strokeDasharray={`${percent}, 100`}
                        strokeLinecap="round"
                        strokeWidth="4"
                    />
                </svg>
                <span className="absolute font-display text-sm font-bold text-on-surface tabular-nums">
                    {percent}%
                </span>
            </div>
            <span className="text-center font-label text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                {label}
            </span>
        </article>
    );
}

function StackedBreakdownChart({ days }: StackedBreakdownChartProps) {
    return (
        <section className="rounded-xl bg-surface-container-high p-6 shadow-[0_15px_30px_rgba(0,0,0,0.2)]">
            <h3 className="mb-6 font-headline text-lg font-bold text-on-surface">
                Desglose Semanal
            </h3>
            <svg
                aria-label="Desglose semanal por estado"
                className="h-56 w-full overflow-visible"
                role="img"
                viewBox="0 0 320 220"
            >
                {days.map((day, index) => (
                    <StackedDayBar day={day} index={index} key={`${day.label}-${day.date.toISOString()}`} />
                ))}
            </svg>
            <div className="mt-8 flex items-center justify-center gap-6 border-t border-surface-container-lowest/50 pt-4">
                <LegendItem className="bg-tertiary shadow-[0_0_5px_rgba(129,236,255,0.5)]" label="A Tiempo" />
                <LegendItem className="bg-primary" label="Tarde" />
                <LegendItem className="bg-error" label="Falladas" />
            </div>
        </section>
    );
}

function StackedDayBar({ day, index }: { day: DailyStat; index: number }) {
    const chartTop = 12;
    const chartBottom = 168;
    const chartHeight = chartBottom - chartTop;
    const slotWidth = 43;
    const barWidth = 31;
    const x = 18 + index * slotWidth;
    const segments = [
        { value: day.onTimePercent, fill: "#81ecff" },
        { value: day.latePercent, fill: "#afa2ff" },
        { value: day.failedPercent, fill: "#ff6e84" },
    ];
    let cursorY = chartBottom;

    return (
        <g>
            <rect fill="#12121e" height={chartHeight} rx="2" width={barWidth} x={x} y={chartTop} />
            {segments.map((segment) => {
                const segmentHeight = getSegmentHeight(segment.value, chartHeight);
                cursorY -= segmentHeight;
                const rect = (
                    <rect
                        fill={segment.fill}
                        height={segmentHeight}
                        key={`${day.label}-${segment.fill}`}
                        opacity="0.9"
                        rx="2"
                        width={barWidth}
                        x={x}
                        y={cursorY}
                    />
                );
                cursorY -= segmentHeight > 0 ? 3 : 0;
                return rect;
            })}
            <text
                className="fill-on-surface-variant text-[10px] font-medium"
                textAnchor="middle"
                x={x + barWidth / 2}
                y="204"
            >
                {day.label}
            </text>
        </g>
    );
}

function LegendItem({ className, label }: { className: string; label: string }) {
    return (
        <div className="flex items-center gap-2">
            <div className={cn("h-3 w-3 rounded-full", className)} />
            <span className="text-xs font-medium text-on-surface-variant">{label}</span>
        </div>
    );
}

function DetailedStatsLoadingState() {
    return (
        <section className="space-y-8" aria-label="Cargando estadísticas">
            <div className="h-36 rounded-xl bg-surface-container-high" />
            <div className="grid grid-cols-3 gap-4">
                {[0, 1, 2].map((item) => (
                    <div className="h-44 rounded-xl bg-surface-container-low" key={item} />
                ))}
            </div>
            <div className="h-80 rounded-xl bg-surface-container-high" />
        </section>
    );
}

function DetailedStatsErrorState({ error }: { error: Error | null }) {
    return (
        <section className="rounded-xl border border-error-dim/30 bg-error-container/10 p-5 text-error">
            <div className="flex items-center gap-3">
                <MaterialIcon name="error" filled />
                <p className="font-label text-xs font-bold uppercase tracking-widest">
                    {error?.message || "No se pudieron cargar las estadísticas"}
                </p>
            </div>
        </section>
    );
}

function DetailedStatsEmptyState() {
    return (
        <section className="rounded-xl border border-outline-variant/15 bg-surface-container-low p-8 text-center">
            <MaterialIcon name="bar_chart" className="mx-auto mb-3 text-4xl text-tertiary" />
            <p className="font-headline text-lg font-bold text-on-surface">
                Sin estadísticas esta semana
            </p>
            <p className="mt-1 text-sm text-on-surface-variant">
                Completa tareas para construir el desglose semanal.
            </p>
        </section>
    );
}

function getSegmentHeight(percent: number, chartHeight: number) {
    if (percent === 0) {
        return 0;
    }

    return Math.max(6, Math.round((percent / 100) * chartHeight));
}
