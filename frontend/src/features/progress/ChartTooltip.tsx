import type { DayStats } from "@/api/schemas";
import { formatDay } from "@/lib/date";

export type HoverState = { day: DayStats; left: number; top: number } | null;

export function dayValueText(day: DayStats): string {
    if (day.total === 0) return "Sin tareas";
    return `${Math.round(day.percentage)}%`;
}

export function dayDetailText(day: DayStats): string {
    if (day.total === 0) return formatDay(day.date, "EEE d MMM");
    const dismissed = day.dismissed ? ` · ${day.dismissed} descartada${day.dismissed === 1 ? "" : "s"}` : "";
    return `${formatDay(day.date, "EEE d MMM")} · ${day.completed} de ${day.total}${dismissed}`;
}

export function ChartTooltip({ hover, width }: { hover: HoverState; width: number }) {
    if (!hover) return null;
    const left = Math.min(Math.max(hover.left, 70), Math.max(70, width - 70));
    return (
        <div
            role="presentation"
            style={{ left, top: hover.top }}
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-control bg-bg-elevated px-3 py-2 text-center shadow-float ring-1 ring-separator"
        >
            <p className="tabular text-headline">{dayValueText(hover.day)}</p>
            <p className="text-caption whitespace-nowrap text-label-secondary">{dayDetailText(hover.day)}</p>
        </div>
    );
}
