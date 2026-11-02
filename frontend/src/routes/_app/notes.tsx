import { createFileRoute } from "@tanstack/react-router";
import { NotesScreen } from "@/features/notes/NotesScreen";
import { todayISO } from "@/lib/date";

export const Route = createFileRoute("/_app/notes")({
    validateSearch: (search: Record<string, unknown>): { date?: string } => ({
        date: typeof search.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(search.date) ? search.date : undefined,
    }),
    component: NotesRoute,
});

function NotesRoute() {
    const { date = todayISO() } = Route.useSearch();
    const navigate = Route.useNavigate();
    return <NotesScreen date={date} onSelectDate={(next) => void navigate({ search: { date: next === todayISO() ? undefined : next }, replace: true })} />;
}
