import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { checkAuth } from "@/auth/useAuth";

export const Route = createFileRoute("/notes")({
    component: RouteComponent,
    beforeLoad: async () => {
        try {
            const isAuthenticated = await checkAuth();
            if (!isAuthenticated) {
                throw redirect({ to: "/login" });
            }
        } catch (_error) {
            throw redirect({ to: "/login" });
        }
    },
});

function RouteComponent() {
    return <Outlet />;
}
