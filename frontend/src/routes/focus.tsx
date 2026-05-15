import { createFileRoute, redirect } from "@tanstack/react-router";
import { checkAuth } from "@/auth/useAuth";
import { AppShell } from "@/components/layout/AppShell";
import { FocusModePage } from "@/pages/FocusModePage";

export const Route = createFileRoute("/focus")({
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
            <FocusModePage />
        </AppShell>
    );
}
