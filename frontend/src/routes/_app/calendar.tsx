import { createFileRoute } from "@tanstack/react-router";
import { CalendarScreen } from "@/features/calendar/CalendarScreen";
import { todayISO } from "@/lib/date";

type CalendarSearch = { date?: string; task?: string };

export const Route = createFileRoute("/_app/calendar")({
    validateSearch: (search: Record<string, unknown>): CalendarSearch => ({
        date: typeof search.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(search.date) ? search.date : undefined,
        task: typeof search.task === "string" ? search.task : undefined,
    }),
    component: CalendarRoute,
});

function CalendarRoute() {
    const search = Route.useSearch();
    const navigate = Route.useNavigate();
    const date = search.date ?? todayISO();
    return (
        <CalendarScreen
            date={date}
            taskId={search.task}
            onSelectDate={(next) => void navigate({ search: { date: next === todayISO() ? undefined : next }, replace: true })}
            onOpenTask={(id) => void navigate({ search: (previous) => ({ ...previous, task: id }) })}
            onCloseTask={() => void navigate({ search: (previous) => ({ ...previous, task: undefined }), replace: true })}
        />
    );
}
