import { createFileRoute, redirect } from "@tanstack/react-router";
import { checkAuth } from "@/auth/useAuth";
import { AppShell } from "@/components/layout/AppShell";
import { WeeklyStatsPage } from "@/pages/WeeklyStatsPage";

export const Route = createFileRoute("/stats")({
    component: RouteComponent,
    beforeLoad: async () => {
        const isAuthenticated = await checkAuth();
        if (!isAuthenticated) {
            throw redirect({ to: "/login" });
        }
    },
});

function RouteComponent() {
    return (
        <AppShell topBarAlign="center">
            <WeeklyStatsPage />
        </AppShell>
    );
}
