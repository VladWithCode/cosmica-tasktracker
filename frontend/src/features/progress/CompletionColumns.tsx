import { useRef, useState } from "react";
import type { DayStats } from "@/api/schemas";
import { cn } from "@/lib/cn";
import { formatDay, fromISODate } from "@/lib/date";
import { ChartTooltip, dayDetailText, dayValueText, type HoverState } from "./ChartTooltip";

const HEIGHT = 160;
const ticks = [100, 50, 0];

function dismissedShare(day: DayStats): number {
    return day.total ? (day.dismissed * 100) / day.total : 0;
}

export function CompletionColumns({ days, label }: { days: DayStats[]; label: string }) {
    const ref = useRef<HTMLDivElement>(null);
    const [hover, setHover] = useState<HoverState>(null);
    const dense = days.length > 10;

    const show = (day: DayStats, element: HTMLElement) => {
        const container = ref.current?.getBoundingClientRect();
        const rect = element.getBoundingClientRect();
        if (!container) return;
        const barTop = HEIGHT - (HEIGHT * Math.max(day.percentage + dismissedShare(day), 0)) / 100;
        setHover({ day, left: rect.left - container.left + rect.width / 2, top: Math.max(barTop - 8, 0) });
    };

    const showLegend = days.some((day) => day.dismissed > 0);

    return (
        <figure aria-label={label} className="relative px-4">
            {showLegend ? (
                <div className="flex items-center gap-4 pb-3 pl-10 text-caption text-label-secondary">
                    <span className="flex items-center gap-1.5">
                        <span aria-hidden className="size-2.5 rounded-[3px] bg-accent" />
                        Completadas
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span aria-hidden className="size-2.5 rounded-[3px] bg-dismissed" />
                        Descartadas
                    </span>
                </div>
            ) : null}
            <div ref={ref} className="relative flex gap-2">
                <div aria-hidden className="tabular relative w-8 shrink-0 text-right text-caption text-label-tertiary" style={{ height: HEIGHT }}>
                    {ticks.map((tick) => (
                        <span key={tick} className="absolute right-0 -translate-y-1/2" style={{ top: HEIGHT - (HEIGHT * tick) / 100 }}>
                            {tick}%
                        </span>
                    ))}
                </div>
                <div className="relative flex-1" style={{ height: HEIGHT }} onPointerLeave={() => setHover(null)}>
                    {ticks.map((tick) => (
                        <span
                            key={tick}
                            aria-hidden
                            className={cn("absolute inset-x-0 h-px", tick === 0 ? "bg-separator" : "bg-fill-secondary")}
                            style={{ top: HEIGHT - (HEIGHT * tick) / 100 }}
                        />
                    ))}
                    <div className="absolute inset-0 flex items-end gap-0.5">
                        {days.map((day) => (
                            <button
                                key={day.date}
                                type="button"
                                aria-label={`${dayDetailText(day)}: ${dayValueText(day)}`}
                                onPointerEnter={(event) => show(day, event.currentTarget)}
                                onFocus={(event) => show(day, event.currentTarget)}
                                onBlur={() => setHover(null)}
                                className="group flex h-full min-w-0 flex-1 items-end justify-center outline-offset-0"
                            >
                                {day.total > 0 ? (
                                    <span className="flex w-full max-w-6 flex-col justify-end gap-[2px] overflow-hidden rounded-t-[4px] transition-opacity group-hover:opacity-80 group-focus-visible:opacity-80">
                                        {day.dismissed > 0 ? (
                                            <span className="block w-full bg-dismissed" style={{ height: Math.max((HEIGHT * dismissedShare(day)) / 100, 3) }} />
                                        ) : null}
                                        {day.completed > 0 ? (
                                            <span className="block w-full bg-accent" style={{ height: Math.max((HEIGHT * day.percentage) / 100, 3) }} />
                                        ) : null}
                                    </span>
                                ) : null}
                            </button>
                        ))}
                    </div>
                    <ChartTooltip hover={hover} width={ref.current?.offsetWidth ?? 0} />
                </div>
            </div>
            <div aria-hidden className="ml-10 flex gap-0.5 pt-1.5">
                {days.map((day, index) => {
                    const date = fromISODate(day.date);
                    const remainder = date.getDate() % 5;
                    const edgeFits = (index === 0 && 5 - remainder >= 2) || (index === days.length - 1 && remainder >= 2);
                    const show = !dense || remainder === 0 || edgeFits;
                    return (
                        <span key={day.date} className="min-w-0 flex-1 text-center text-caption text-label-tertiary">
                            {show ? (dense ? date.getDate() : formatDay(day.date, "EEEEE")) : ""}
                        </span>
                    );
                })}
            </div>
        </figure>
    );
}
