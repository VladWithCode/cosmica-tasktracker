import { createFileRoute, redirect } from "@tanstack/react-router";
import { checkAuth } from "@/auth/useAuth";
import { AppShell } from "@/components/layout/AppShell";
import { MainPlaceholderPage } from "@/pages/MainPlaceholderPage";

export const Route = createFileRoute("/wellness")({
    component: RouteComponent,
    beforeLoad: async () => {
        const isAuthenticated = await checkAuth();
        if (!isAuthenticated) {
            throw redirect({ to: "/" });
        }
    },
});

function RouteComponent() {
    return (
        <AppShell>
            <MainPlaceholderPage
                description="Espacio para descanso, enfoque y recuperación."
                icon="spa"
                title="Bienestar"
            />
        </AppShell>
    );
}
