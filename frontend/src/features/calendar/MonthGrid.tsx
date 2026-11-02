import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatDay, formatMonth, fromISODate, isToday, monthGrid, shiftMonth } from "@/lib/date";
import type { DayMark } from "@/queries/history";

type MonthGridProps = {
    selected: string;
    onSelect: (date: string) => void;
    marks?: Map<string, DayMark>;
    dotDays?: Set<string>;
};

const letters = ["L", "M", "X", "J", "V", "S", "D"];

export function MonthGrid({ selected, onSelect, marks, dotDays }: MonthGridProps) {
    const month = selected.slice(0, 7);
    return (
        <div className="px-2 pb-2">
            <div className="flex items-center justify-end px-2">
                <div className="flex">
                    <button type="button" aria-label="Mes anterior" onClick={() => onSelect(shiftMonth(selected, -1))} className="flex size-11 items-center justify-center text-accent">
                        <ChevronLeft aria-hidden className="size-6" />
                    </button>
                    <button type="button" aria-label="Mes siguiente" onClick={() => onSelect(shiftMonth(selected, 1))} className="flex size-11 items-center justify-center text-accent">
                        <ChevronRight aria-hidden className="size-6" />
                    </button>
                </div>
            </div>
            <div role="grid" aria-label={formatMonth(selected)} className="grid grid-cols-7 gap-y-1">
                {letters.map((letter) => (
                    <span key={letter} role="columnheader" className="pb-1 text-center text-caption text-label-secondary">
                        {letter}
                    </span>
                ))}
                {monthGrid(selected).flat().map((day) => {
                    const inMonth = day.slice(0, 7) === month;
                    const active = day === selected;
                    const today = isToday(day);
                    const mark = marks?.get(day);
                    const dot = dotDays ? dotDays.has(day) : Boolean(mark);
                    return (
                        <button
                            key={day}
                            type="button"
                            role="gridcell"
                            aria-selected={active}
                            aria-label={formatDay(day)}
                            onClick={() => onSelect(day)}
                            className="flex flex-col items-center gap-0.5 py-0.5"
                        >
                            <span
                                className={cn(
                                    "tabular flex size-9 items-center justify-center rounded-full text-callout",
                                    active && "bg-accent font-semibold text-on-accent",
                                    !active && today && "font-semibold text-accent",
                                    !active && !today && (inMonth ? "text-label" : "text-label-tertiary"),
                                )}
                            >
                                {fromISODate(day).getDate()}
                            </span>
                            <span
                                aria-hidden
                                className={cn(
                                    "size-1.5 rounded-full",
                                    dot && !dotDays && mark === "full" && "bg-success",
                                    dot && !dotDays && mark === "partial" && "bg-accent",
                                    dot && !dotDays && mark === "empty" && "bg-label-tertiary",
                                    dot && dotDays && "bg-label-secondary",
                                )}
                            />
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
