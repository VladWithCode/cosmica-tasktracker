import { useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { DayMarker } from "@/components/calendar/DayCalendar";
import { DayCalendar, useCalendarMonth } from "@/components/calendar/DayCalendar";
import { getTaskHistoryOpts } from "@/queries/tasks";

/** Month calendar of task activity; a day opens that day's agenda. */
export function AgendaCalendar() {
    const navigate = useNavigate();
    const { month, setMonth, range } = useCalendarMonth();
    const historyQuery = useQuery(getTaskHistoryOpts(range));

    const markers = useMemo(() => {
        const map = new Map<string, DayMarker>();
        for (const day of historyQuery.data?.days ?? []) {
            if (day.total <= 0) continue;
            map.set(day.date, {
                count: day.total,
                tone: day.percentage >= 100 ? "strong" : day.percentage > 0 ? "medium" : "muted",
                label: `${day.total} tareas, ${day.percentage}% completadas`,
            });
        }
        return map;
    }, [historyQuery.data]);

    return (
        <DayCalendar
            title="Calendario"
            month={month}
            onMonthChange={setMonth}
            onSelectDate={(date) => navigate({ to: "/agenda", search: { date } })}
            markers={markers}
            isFetching={historyQuery.isFetching}
            errorMessage={historyQuery.isError ? historyQuery.error?.message : undefined}
            hint="Toca un día para abrir su agenda."
        />
    );
}
