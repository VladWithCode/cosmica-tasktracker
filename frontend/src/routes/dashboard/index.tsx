import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { TimelineDashboard } from "@/pages/TimelineDashboard";

export const Route = createFileRoute("/dashboard/")({
    component: RouteComponent,
});

function RouteComponent() {
    return (
        <AppShell>
            <TimelineDashboard />
        </AppShell>
    );
}
