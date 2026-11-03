import type { TaskStatus } from "@/api/schemas";
import { GroupedSection } from "@/components/ui/GroupedList";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import { formatDay } from "@/lib/date";
import { statusLabels } from "@/lib/tasks";
import { rangeFor } from "@/features/progress/ranges";
import { useScheduleHistory } from "@/queries/schedules";

type Outcome = "completed" | "dismissed" | "missed" | "open";

const outcomeOf: Record<TaskStatus, Outcome> = {
    completed: "completed",
    dismissed: "dismissed",
    skipped: "missed",
    failed: "missed",
    pending: "open",
    in_progress: "open",
};

const outcomeClass: Record<Outcome, string> = {
    completed: "bg-success",
    dismissed: "bg-dismissed",
    missed: "bg-label-tertiary",
    open: "border-2 border-label-tertiary",
};

const legend: { outcome: Outcome; label: string }[] = [
    { outcome: "completed", label: "Completada" },
    { outcome: "dismissed", label: "Descartada" },
    { outcome: "missed", label: "Omitida o fallida" },
    { outcome: "open", label: "Pendiente" },
];

function inARow(count: number): string {
    return count === 1 ? "1 vez" : `${count} veces`;
}

export function RoutineHistory({ id }: { id: string }) {
    const { from, to } = rangeFor("month");
    const history = useScheduleHistory(id, from, to);

    if (history.isPending) {
        return (
            <div className="px-4 pt-7">
                <Skeleton className="h-28 rounded-card" />
            </div>
        );
    }
    if (!history.data) return null;

    const data = history.data;
    if (data.total === 0) {
        return (
            <GroupedSection title="Últimos 30 días">
                <p className="px-4 py-3 text-callout text-label-secondary">Aún no hay días registrados para esta rutina.</p>
            </GroupedSection>
        );
    }

    return (
        <GroupedSection title="Últimos 30 días">
            <div className="grid grid-cols-3 divide-x divide-separator py-3">
                <Stat label="Racha actual" value={inARow(data.currentStreak)} />
                <Stat label="Mejor racha" value={inARow(data.bestStreak)} />
                <Stat label="Completada" value={`${Math.round(data.percentage)}%`} detail={`${data.completed} de ${data.total}`} />
            </div>
            <div className="px-4 py-3">
                <ol aria-label="Resultado por día" className="flex flex-wrap gap-1.5">
                    {data.entries.map((entry) => {
                        const label = `${formatDay(entry.date, "EEE d MMM")}: ${statusLabels[entry.status]}`;
                        return (
                            <li key={entry.taskId} title={label} aria-label={label} className={cn("size-4 rounded-full", outcomeClass[outcomeOf[entry.status]])} />
                        );
                    })}
                </ol>
                <ul aria-hidden className="flex flex-wrap gap-x-4 gap-y-1 pt-3 text-caption text-label-secondary">
                    {legend.map((item) => (
                        <li key={item.outcome} className="flex items-center gap-1.5">
                            <span className={cn("size-2.5 rounded-full", outcomeClass[item.outcome])} />
                            {item.label}
                        </li>
                    ))}
                </ul>
            </div>
        </GroupedSection>
    );
}

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
    return (
        <div className="flex flex-col items-center gap-0.5 px-2 text-center">
            <span className="text-caption text-label-secondary">{label}</span>
            <span className="tabular text-headline">{value}</span>
            {detail ? <span className="tabular text-caption text-label-secondary">{detail}</span> : null}
        </div>
    );
}
