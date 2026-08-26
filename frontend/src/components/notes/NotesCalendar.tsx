import { useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { DayMarker } from "@/components/calendar/DayCalendar";
import { DayCalendar, useCalendarMonth } from "@/components/calendar/DayCalendar";
import { getNotesHistoryOpts } from "@/queries/notes";

/** Month calendar of note activity; a day opens that day's notes. */
export function NotesCalendar() {
    const navigate = useNavigate();
    const { month, setMonth, range } = useCalendarMonth();
    const historyQuery = useQuery(getNotesHistoryOpts(range));

    const markers = useMemo(() => {
        const map = new Map<string, DayMarker>();
        for (const day of historyQuery.data?.days ?? []) {
            if (day.total <= 0) continue;
            map.set(day.date, {
                count: day.total,
                tone: "medium",
                label: `${day.total} ${day.total === 1 ? "nota" : "notas"}`,
            });
        }
        return map;
    }, [historyQuery.data]);

    return (
        <DayCalendar
            title="Historial"
            month={month}
            onMonthChange={setMonth}
            onSelectDate={(date) => navigate({ to: "/notes/history", search: { date } })}
            markers={markers}
            isFetching={historyQuery.isFetching}
            errorMessage={historyQuery.isError ? historyQuery.error?.message : undefined}
            hint="Toca un día para ver sus notas."
        />
    );
}
