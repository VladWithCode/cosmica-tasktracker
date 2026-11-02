import { createFileRoute } from "@tanstack/react-router";
import { ProgressScreen } from "@/features/progress/ProgressScreen";
import type { RangeId } from "@/features/progress/ranges";

const ranges: RangeId[] = ["week", "month", "quarter"];

export const Route = createFileRoute("/_app/progress")({
    validateSearch: (search: Record<string, unknown>): { range?: RangeId } => ({
        range: ranges.includes(search.range as RangeId) ? (search.range as RangeId) : undefined,
    }),
    component: ProgressRoute,
});

function ProgressRoute() {
    const { range = "week" } = Route.useSearch();
    const navigate = Route.useNavigate();
    return <ProgressScreen range={range} onRangeChange={(next) => void navigate({ search: { range: next === "week" ? undefined : next }, replace: true })} />;
}
