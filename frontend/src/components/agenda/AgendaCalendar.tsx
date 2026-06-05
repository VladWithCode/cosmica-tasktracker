import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { DayButton } from "react-day-picker";
import { getDefaultClassNames } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { cn } from "@/lib/utils";
import { getTaskHistoryOpts } from "@/queries/tasks";
import type { TaskHistoryDay } from "@/types/task";

function toDateString(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

/**
 * Compute the 6-row grid range visible for a given month, including
 * the trailing days from the previous month and the leading days from
 * the next month. Assumes Sunday-start weeks (react-day-picker default).
 */
function getVisibleRange(month: Date): { from: string; to: string } {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    const start = new Date(first);
    start.setDate(first.getDate() - first.getDay());
    const end = new Date(last);
    end.setDate(last.getDate() + (6 - last.getDay()));
    return { from: toDateString(start), to: toDateString(end) };
}

export function AgendaCalendar() {
    const navigate = useNavigate();
    const today = useMemo(() => new Date(), []);
    const [month, setMonth] = useState<Date>(
        () => new Date(today.getFullYear(), today.getMonth(), 1),
    );

    const startMonth = useMemo(
        () => new Date(today.getFullYear() - 5, 0, 1),
        [today],
    );
    const endMonth = useMemo(
        () => new Date(today.getFullYear() + 5, 11, 1),
        [today],
    );

    const range = useMemo(() => getVisibleRange(month), [month]);
    const historyQuery = useQuery(getTaskHistoryOpts(range));

    const dayMap = useMemo(() => {
        const map = new Map<string, TaskHistoryDay>();
        for (const day of historyQuery.data?.days ?? []) {
            map.set(day.date, day);
        }
        return map;
    }, [historyQuery.data]);

    const goToday = () => {
        const t = new Date();
        setMonth(new Date(t.getFullYear(), t.getMonth(), 1));
    };

    const handleSelect = (date: Date | undefined) => {
        if (!date) return;
        navigate({ to: "/agenda", search: { date: toDateString(date) } });
    };

    return (
        <main className="relative mx-auto flex min-h-full max-w-3xl flex-col items-center px-4 pb-36 pt-6 sm:px-6">
            <div className="pointer-events-none absolute left-1/2 top-16 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/5 blur-[120px]" />

            <div className="relative mb-4 flex w-full items-center justify-between">
                <h2 className="font-display text-xl font-bold text-on-surface">
                    Calendario
                </h2>
                <div className="flex items-center gap-2">
                    {historyQuery.isFetching ? (
                        <span
                            aria-label="Cargando actividad"
                            className="inline-flex h-2 w-2 animate-pulse rounded-full bg-primary/60"
                        />
                    ) : null}
                    {historyQuery.isError ? (
                        <span
                            className="font-label text-[10px] uppercase tracking-widest text-error"
                            title={historyQuery.error?.message}
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
                    onMonthChange={setMonth}
                    onSelect={handleSelect}
                    captionLayout="dropdown"
                    startMonth={startMonth}
                    endMonth={endMonth}
                    showOutsideDays
                    className="mx-auto w-full"
                    components={{
                        DayButton: (props) => (
                            <AgendaDayButton {...props} dayMap={dayMap} />
                        ),
                    }}
                />
            </div>

            <p className="mt-4 font-label text-xs text-on-surface-variant">
                Toca un día para abrir su agenda.
            </p>
        </main>
    );
}

type AgendaDayButtonProps = React.ComponentProps<typeof DayButton> & {
    dayMap: Map<string, TaskHistoryDay>;
};

function AgendaDayButton({
    className,
    day,
    modifiers,
    dayMap,
    children,
    ...props
}: AgendaDayButtonProps) {
    const defaultClassNames = getDefaultClassNames();
    const ref = useRef<HTMLButtonElement>(null);
    useEffect(() => {
        if (modifiers.focused) ref.current?.focus();
    }, [modifiers.focused]);

    const key = toDateString(day.date);
    const stats = dayMap.get(key);
    const total = stats?.total ?? 0;
    const percentage = stats?.percentage ?? 0;
    const hasActivity = total > 0;
    const fullyDone = hasActivity && percentage >= 100;

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
            {hasActivity ? (
                <span
                    aria-label={`${total} tareas, ${percentage}% completadas`}
                    className={cn(
                        "mt-0.5 flex items-center gap-0.5 rounded-full px-1 py-px font-mono text-[9px] font-bold leading-none tabular-nums",
                        fullyDone
                            ? "bg-primary/20 text-primary"
                            : percentage > 0
                              ? "bg-tertiary/15 text-tertiary"
                              : "bg-on-surface-variant/10 text-on-surface-variant",
                    )}
                >
                    <span
                        aria-hidden="true"
                        className={cn(
                            "inline-block h-1.5 w-1.5 rounded-full",
                            fullyDone
                                ? "bg-primary"
                                : percentage > 0
                                  ? "bg-tertiary"
                                  : "bg-on-surface-variant/60",
                        )}
                    />
                    {total}
                </span>
            ) : null}
        </Button>
    );
}
