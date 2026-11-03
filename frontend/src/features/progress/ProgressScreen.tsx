import { useState } from "react";
import { Ban, Check, CircleDashed, CircleX, ChartNoAxesColumn, EyeOff } from "lucide-react";
import type { DayStats, Metrics } from "@/api/schemas";
import { Screen } from "@/components/shell/Screen";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import { formatDay } from "@/lib/date";
import { useHistory, useMetrics } from "@/queries/history";
import { useOwnerAccess, type OwnerAccess } from "@/queries/owner";
import { CompletionColumns } from "./CompletionColumns";
import { CompletionHeatmap } from "./CompletionHeatmap";
import { highDismissal, rangeFor, rangeOptions, type RangeId } from "./ranges";

export function ProgressScreen({ range, onRangeChange }: { range: RangeId; onRangeChange: (range: RangeId) => void }) {
    const access = useOwnerAccess();
    const { from, to } = rangeFor(range);
    const metrics = useMetrics(access.ownerId, from, to);
    const history = useHistory(access.ownerId, from, to);
    const refetching = metrics.isPlaceholderData || history.isPlaceholderData;
    const error = metrics.error ?? history.error;

    return (
        <Screen title="Progreso">
            <div className="px-4 pb-6">
                <SegmentedControl label="Periodo" value={range} options={rangeOptions} onChange={onRangeChange} />
                {access.isSelf ? null : <p className="px-1 pt-2 text-footnote text-label-secondary">Progreso de {access.name ?? "otra persona"}.</p>}
            </div>
            {error ? <ErrorState error={error} onRetry={() => void Promise.all([metrics.refetch(), history.refetch()])} /> : null}
            {!error && (!metrics.data || !history.data) ? <ProgressSkeleton /> : null}
            {metrics.data && history.data ? (
                <div className={cn("transition-opacity", refetching && "opacity-50")}>
                    {metrics.data.total === 0 ? (
                        <EmptyState icon={ChartNoAxesColumn} title="Aún sin datos" message="Completa tareas y aquí verás tu avance." />
                    ) : (
                        <ProgressContent metrics={metrics.data} days={history.data.days} range={range} from={from} access={access} />
                    )}
                </div>
            ) : null}
        </Screen>
    );
}

function ProgressSkeleton() {
    return (
        <div className="flex flex-col gap-3 px-4">
            <div className="grid grid-cols-2 gap-3">
                <Skeleton className="h-24 rounded-card" />
                <Skeleton className="h-24 rounded-card" />
            </div>
            <Skeleton className="h-52 rounded-card" />
        </div>
    );
}

function StatTile({ label, value, detail }: { label: string; value: string; detail?: string }) {
    return (
        <div className="flex flex-col gap-0.5 rounded-card bg-bg-elevated p-4">
            <span className="text-footnote text-label-secondary">{label}</span>
            <span className="tabular text-title-1">{value}</span>
            {detail ? <span className="text-footnote text-label-secondary">{detail}</span> : null}
        </div>
    );
}

type ProgressContentProps = { metrics: Metrics; days: DayStats[]; range: RangeId; from: string; access: OwnerAccess };

function ProgressContent({ metrics, days, range, from, access }: ProgressContentProps) {
    const [showTable, setShowTable] = useState(false);
    const rangeLabel = rangeOptions.find((option) => option.value === range)?.label ?? "";
    const pending = metrics.pending + metrics.inProgress;
    const breakdown = [
        { label: "Completadas", value: metrics.completed, icon: Check, iconClass: "text-success" },
        { label: "Omitidas", value: metrics.skipped, icon: Ban, iconClass: "text-label-secondary" },
        { label: "Fallidas", value: metrics.failed, icon: CircleX, iconClass: "text-danger" },
        { label: "Descartadas", value: metrics.dismissed, icon: EyeOff, iconClass: "text-dismissed" },
        { label: "Pendientes", value: pending, icon: CircleDashed, iconClass: "text-warning" },
    ];

    return (
        <div className="flex flex-col gap-9">
            <div className="grid grid-cols-2 gap-3 px-4">
                <StatTile label="Completado" value={`${Math.round(metrics.percentage)}%`} detail={`${metrics.completed} de ${metrics.total} tareas`} />
                <StatTile label="Racha actual" value={`${metrics.currentStreak}`} detail={metrics.currentStreak === 1 ? "día" : "días"} />
                <StatTile label="Días activos" value={`${metrics.activeDays}`} detail={`de ${metrics.daysCount}`} />
                <StatTile
                    label="Mejor día"
                    value={metrics.bestDay ? `${Math.round(metrics.bestDay.percentage)}%` : "—"}
                    detail={metrics.bestDay ? formatDay(metrics.bestDay.date, "EEE d MMM") : undefined}
                />
            </div>

            {highDismissal(metrics) ? <DismissalAdvice rate={metrics.dismissalRate} access={access} /> : null}

            <section className="flex flex-col gap-3">
                <h2 className="px-8 text-headline">Completado por día</h2>
                <div className="mx-4 rounded-card bg-bg-elevated py-4">
                    {range === "quarter" ? (
                        <CompletionHeatmap days={days} from={from} label={`Porcentaje completado por día, ${rangeLabel}`} />
                    ) : (
                        <CompletionColumns days={days} label={`Porcentaje completado por día, ${rangeLabel}`} />
                    )}
                    <div className="px-4 pt-4">
                        <button type="button" aria-expanded={showTable} onClick={() => setShowTable((value) => !value)} className="min-h-11 text-footnote font-semibold text-accent">
                            {showTable ? "Ocultar tabla" : "Ver como tabla"}
                        </button>
                        {showTable ? <DaysTable days={days} /> : null}
                    </div>
                </div>
            </section>

            <section className="flex flex-col gap-3">
                <h2 className="px-8 text-headline">Resumen</h2>
                <ul className="mx-4 grid grid-cols-2 gap-3">
                    {breakdown.map((item) => (
                        <li key={item.label} className="flex items-center gap-3 rounded-card bg-bg-elevated p-4">
                            <item.icon aria-hidden className={cn("size-6 shrink-0", item.iconClass)} />
                            <div className="flex flex-col">
                                <span className="tabular text-title-2">{item.value}</span>
                                <span className="text-footnote text-label-secondary">{item.label}</span>
                            </div>
                        </li>
                    ))}
                </ul>
            </section>
        </div>
    );
}

function DismissalAdvice({ rate, access }: { rate: number; access: OwnerAccess }) {
    const who = access.isSelf ? "Descartaste" : `${access.name ?? "Esta persona"} descartó`;
    return (
        <aside role="note" className="mx-4 flex gap-3 rounded-card bg-dismissed-soft p-4">
            <EyeOff aria-hidden className="mt-0.5 size-5 shrink-0 text-dismissed" />
            <div className="flex flex-col gap-1">
                <p className="text-headline">
                    {who} el {Math.round(rate)}% de las tareas
                </p>
                <p className="text-footnote text-label-secondary">
                    {access.isSelf
                        ? "Si una rutina no encaja en tu día, cambia su horario o ponla en pausa. Menos tareas que sí cumples valen más que muchas descartadas."
                        : "Puede ser buen momento para revisar juntos si sus rutinas encajan en su día."}
                </p>
            </div>
        </aside>
    );
}

function DaysTable({ days }: { days: DayStats[] }) {
    return (
        <table className="mt-2 w-full text-left text-footnote">
            <thead className="text-label-secondary">
                <tr>
                    <th scope="col" className="py-1.5 font-medium">Día</th>
                    <th scope="col" className="py-1.5 text-right font-medium">Completadas</th>
                    <th scope="col" className="py-1.5 text-right font-medium">Descartadas</th>
                    <th scope="col" className="py-1.5 text-right font-medium">%</th>
                </tr>
            </thead>
            <tbody className="tabular">
                {[...days].reverse().map((day) => (
                    <tr key={day.date} className="border-t border-separator">
                        <td className="py-1.5">{formatDay(day.date, "EEE d MMM")}</td>
                        <td className="py-1.5 text-right">{day.total ? `${day.completed} de ${day.total}` : "—"}</td>
                        <td className="py-1.5 text-right">{day.total ? day.dismissed : "—"}</td>
                        <td className="py-1.5 text-right">{day.total ? `${Math.round(day.percentage)}%` : "—"}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}
