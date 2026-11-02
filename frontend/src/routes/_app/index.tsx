import { createFileRoute } from "@tanstack/react-router";
import { TodayScreen } from "@/features/today/TodayScreen";

type TodaySearch = { task?: string };

export const Route = createFileRoute("/_app/")({
    validateSearch: (search: Record<string, unknown>): TodaySearch => ({
        task: typeof search.task === "string" ? search.task : undefined,
    }),
    component: TodayRoute,
});

function TodayRoute() {
    const { task } = Route.useSearch();
    const navigate = Route.useNavigate();
    return (
        <TodayScreen
            taskId={task}
            onOpenTask={(id) => void navigate({ search: { task: id } })}
            onCloseTask={() => void navigate({ search: {}, replace: true })}
        />
    );
}
