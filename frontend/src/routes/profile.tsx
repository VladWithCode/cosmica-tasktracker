import { createFileRoute, redirect } from "@tanstack/react-router";
import { checkAuth } from "@/auth/useAuth";
import { AppShell } from "@/components/layout/AppShell";
import { ProfilePage } from "@/pages/ProfilePage";

export const Route = createFileRoute("/profile")({
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
        <AppShell showBottomNav={false} title="Profile" topBarAlign="center">
            <ProfilePage />
        </AppShell>
    );
}
