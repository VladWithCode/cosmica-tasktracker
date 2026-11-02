import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/components/shell/Placeholder";

type TodaySearch = { task?: string };

export const Route = createFileRoute("/_app/")({
    validateSearch: (search: Record<string, unknown>): TodaySearch => ({
        task: typeof search.task === "string" ? search.task : undefined,
    }),
    component: () => <Placeholder title="Hoy" />,
});
