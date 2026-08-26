import { useEffect, useMemo, useRef, useState } from "react";
import type { DayButton } from "react-day-picker";
import { getDefaultClassNames } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { toDateString } from "@/lib/date";
import { cn } from "@/lib/utils";

export type DayMarkerTone = "strong" | "medium" | "muted";

/** Per-day activity badge. Callers decide what the count means and how much
 *  visual weight it deserves; the calendar only renders it. */
export interface DayMarker {
    count: number;
    tone: DayMarkerTone;
    /** Accessible description, e.g. "3 tareas, 100% completadas". */
    label: string;
}

export interface VisibleRange {
    from: string;
    to: string;
}

/**
 * Compute the 6-row grid range visible for a given month, including
 * the trailing days from the previous month and the leading days from
 * the next month. Assumes Sunday-start weeks (react-day-picker default).
 */
export function getVisibleRange(month: Date): VisibleRange {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    const start = new Date(first);
    start.setDate(first.getDate() - first.getDay());
    const end = new Date(last);
    end.setDate(last.getDate() + (6 - last.getDay()));
    return { from: toDateString(start), to: toDateString(end) };
}

/**
 * Month state for a `DayCalendar` plus the day range it currently shows, so
 * the caller can fetch exactly the days on screen.
 */
export function useCalendarMonth() {
    const [month, setMonth] = useState<Date>(() => {
        const today = new Date();
        return new Date(today.getFullYear(), today.getMonth(), 1);
    });
    const range = useMemo(() => getVisibleRange(month), [month]);
    return { month, setMonth, range };
}

interface DayCalendarProps {
    title: string;
    month: Date;
    onMonthChange: (month: Date) => void;
    onSelectDate: (date: string) => void;
    /** Activity badges keyed by `YYYY-MM-DD`. Days absent from the map render bare. */
    markers?: Map<string, DayMarker>;
    isFetching?: boolean;
    /** Shown in place of the loading dot when the marker query failed. */
    errorMessage?: string;
    /** Caption under the grid, e.g. "Toca un día para abrir su agenda." */
    hint?: string;
}

/**
 * Month grid with optional per-day activity badges. Month state is controlled
 * so the caller can load markers for the visible range; see `useCalendarMonth`.
 */
export function DayCalendar({
    title,
    month,
    onMonthChange,
    onSelectDate,
    markers,
    isFetching = false,
    errorMessage,
    hint,
}: DayCalendarProps) {
    const today = useMemo(() => new Date(), []);
    const startMonth = useMemo(() => new Date(today.getFullYear() - 5, 0, 1), [today]);
    const endMonth = useMemo(() => new Date(today.getFullYear() + 5, 11, 1), [today]);

    const goToday = () => {
        const t = new Date();
        onMonthChange(new Date(t.getFullYear(), t.getMonth(), 1));
    };

    const handleSelect = (date: Date | undefined) => {
        if (!date) return;
        onSelectDate(toDateString(date));
    };

    return (
        <main className="relative mx-auto flex min-h-full max-w-3xl flex-col items-center px-4 pb-36 pt-6 sm:px-6">
            <div className="pointer-events-none absolute left-1/2 top-16 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/5 blur-[120px]" />

            <div className="relative mb-4 flex w-full items-center justify-between">
                <h2 className="font-display text-xl font-bold text-on-surface">{title}</h2>
                <div className="flex items-center gap-2">
                    {isFetching ? (
                        <span
                            aria-label="Cargando actividad"
                            className="inline-flex h-2 w-2 animate-pulse rounded-full bg-primary/60"
                        />
                    ) : null}
                    {errorMessage ? (
                        <span
                            className="font-label text-[10px] uppercase tracking-widest text-error"
                            title={errorMessage}
                        >
                            Sin actividad
                        </span>
                    ) : null}
                    <button
                        className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-label text-[11px] font-bold uppercase tracking-widest text-primary transition-colors hover:bg-primary/20"
                        onClick={goToday}
                        type="button"
                    >
                        <MaterialIcon name="today" className="text-sm" />
                        Hoy
                    </button>
                </div>
            </div>

            <div className="relative w-full rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-2 sm:p-4">
                <Calendar
                    mode="single"
                    month={month}
                    onMonthChange={onMonthChange}
                    onSelect={handleSelect}
                    captionLayout="dropdown"
                    startMonth={startMonth}
                    endMonth={endMonth}
                    showOutsideDays
                    className="mx-auto w-full"
                    components={{
                        DayButton: (props) => <MarkedDayButton {...props} markers={markers} />,
                    }}
                />
            </div>

            {hint ? (
                <p className="mt-4 font-label text-xs text-on-surface-variant">{hint}</p>
            ) : null}
        </main>
    );
}

type MarkedDayButtonProps = React.ComponentProps<typeof DayButton> & {
    markers?: Map<string, DayMarker>;
};

const badgeToneClasses: Record<DayMarkerTone, string> = {
    strong: "bg-primary/20 text-primary",
    medium: "bg-tertiary/15 text-tertiary",
    muted: "bg-on-surface-variant/10 text-on-surface-variant",
};

const dotToneClasses: Record<DayMarkerTone, string> = {
    strong: "bg-primary",
    medium: "bg-tertiary",
    muted: "bg-on-surface-variant/60",
};

function MarkedDayButton({
    className,
    day,
    modifiers,
    markers,
    children,
    ...props
}: MarkedDayButtonProps) {
    const defaultClassNames = getDefaultClassNames();
    const ref = useRef<HTMLButtonElement>(null);
    useEffect(() => {
        if (modifiers.focused) ref.current?.focus();
    }, [modifiers.focused]);

    const marker = markers?.get(toDateString(day.date));

    return (
        <Button
            ref={ref}
            variant="ghost"
            size="icon"
            data-day={day.date.toLocaleDateString()}
            data-selected-single={
                modifiers.selected &&
                !modifiers.range_start &&
                !modifiers.range_end &&
                !modifiers.range_middle
            }
            data-range-start={modifiers.range_start}
            data-range-end={modifiers.range_end}
            data-range-middle={modifiers.range_middle}
            className={cn(
                "data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground data-[range-middle=true]:bg-accent data-[range-middle=true]:text-accent-foreground data-[range-start=true]:bg-primary data-[range-start=true]:text-primary-foreground data-[range-end=true]:bg-primary data-[range-end=true]:text-primary-foreground group-data-[focused=true]/day:border-ring group-data-[focused=true]/day:ring-ring/50 dark:hover:text-accent-foreground flex aspect-square size-auto w-full min-w-(--cell-size) flex-col items-center justify-center gap-0.5 leading-none font-normal group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:ring-[3px] data-[range-end=true]:rounded-md data-[range-end=true]:rounded-r-md data-[range-middle=true]:rounded-none data-[range-start=true]:rounded-md data-[range-start=true]:rounded-l-md relative",
                defaultClassNames.day,
                className,
            )}
            {...props}
        >
            <span className="text-sm leading-none">{children}</span>
            {marker ? (
                <span
                    aria-label={marker.label}
                    className={cn(
                        "mt-0.5 flex items-center gap-0.5 rounded-full px-1 py-px font-mono text-[9px] font-bold leading-none tabular-nums",
                        badgeToneClasses[marker.tone],
                    )}
                >
                    <span
                        aria-hidden="true"
                        className={cn(
                            "inline-block h-1.5 w-1.5 rounded-full",
                            dotToneClasses[marker.tone],
                        )}
                    />
                    {marker.count}
                </span>
            ) : null}
        </Button>
    );
}
