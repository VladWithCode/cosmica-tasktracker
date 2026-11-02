import { useRef, useState } from "react";
import type { DayStats } from "@/api/schemas";
import { cn } from "@/lib/cn";
import { formatDay, shiftISODate, todayISO, weekDays } from "@/lib/date";
import { ChartTooltip, dayDetailText, dayValueText, type HoverState } from "./ChartTooltip";
import { heatStep } from "./ranges";

const stepClass = [
    "bg-fill-secondary",
    "bg-[color-mix(in_oklab,var(--color-accent)_14%,var(--color-bg-elevated))]",
    "bg-[color-mix(in_oklab,var(--color-accent)_36%,var(--color-bg-elevated))]",
    "bg-[color-mix(in_oklab,var(--color-accent)_60%,var(--color-bg-elevated))]",
    "bg-[color-mix(in_oklab,var(--color-accent)_80%,var(--color-bg-elevated))]",
    "bg-accent",
];

const rowLabels = ["L", "", "X", "", "V", "", "D"];

export function CompletionHeatmap({ days, from, label }: { days: DayStats[]; from: string; label: string }) {
    const ref = useRef<HTMLDivElement>(null);
    const [hover, setHover] = useState<HoverState>(null);
    const byDate = new Map(days.map((day) => [day.date, day]));
    const today = todayISO();
    const weeks: string[][] = [];
    for (let monday = weekDays(from)[0] ?? from; monday <= today; monday = shiftISODate(monday, 7)) weeks.push(weekDays(monday));

    const show = (day: DayStats, element: HTMLElement) => {
        const container = ref.current?.getBoundingClientRect();
        const rect = element.getBoundingClientRect();
        if (container) setHover({ day, left: rect.left - container.left + rect.width / 2, top: rect.top - container.top - 6 });
    };

    return (
        <figure aria-label={label} className="px-4">
            <div ref={ref} className="relative flex gap-1.5" onPointerLeave={() => setHover(null)}>
                <div aria-hidden className="grid shrink-0 grid-rows-7 gap-[3px] text-caption text-label-tertiary">
                    {rowLabels.map((letter, index) => (
                        <span key={index} className="flex aspect-square items-center justify-end pr-0.5">
                            {letter}
                        </span>
                    ))}
                </div>
                <div className="grid flex-1 grid-flow-col grid-rows-7 gap-[3px]" style={{ gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))` }}>
                    {weeks.flat().map((date) => {
                        if (date > today) return <span key={date} aria-hidden className="aspect-square" />;
                        const day = byDate.get(date) ?? { date, total: 0, completed: 0, pending: 0, skipped: 0, failed: 0, inProgress: 0, percentage: 0 };
                        return (
                            <button
                                key={date}
                                type="button"
                                aria-label={`${dayDetailText(day)}: ${dayValueText(day)}`}
                                onPointerEnter={(event) => show(day, event.currentTarget)}
                                onFocus={(event) => show(day, event.currentTarget)}
                                onBlur={() => setHover(null)}
                                className={cn("aspect-square rounded-[3px] hover:ring-2 hover:ring-label focus-visible:ring-2 focus-visible:ring-label", stepClass[heatStep(day.percentage, day.total)])}
                            />
                        );
                    })}
                </div>
                <ChartTooltip hover={hover} width={ref.current?.offsetWidth ?? 0} />
            </div>
            <div aria-hidden className="flex items-center justify-end gap-1 pt-2 text-caption text-label-secondary">
                Menos
                {stepClass.slice(1).map((className) => (
                    <span key={className} className={cn("size-3 rounded-[3px]", className)} />
                ))}
                Más
            </div>
            <figcaption className="sr-only">
                {`Desde ${formatDay(from)} hasta hoy. Cada cuadro es un día; más intenso significa más tareas completadas.`}
            </figcaption>
        </figure>
    );
}
