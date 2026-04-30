import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { WeeklyStatsPage } from "@/pages/WeeklyStatsPage";

export const Route = createFileRoute("/dashboard/stats")({
    component: RouteComponent,
});

function RouteComponent() {
    return (
        <AppShell topBarAlign="center">
            <WeeklyStatsPage />
        </AppShell>
    );
}
