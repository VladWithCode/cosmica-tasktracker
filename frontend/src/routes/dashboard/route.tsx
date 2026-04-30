import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { checkAuth } from "@/auth/useAuth";

export const Route = createFileRoute("/dashboard")({
    component: RouteComponent,
    beforeLoad: async () => {
        const isAuthenticated = await checkAuth();
        if (!isAuthenticated) {
            throw redirect({ to: "/" });
        }
    },
});

function RouteComponent() {
    return <Outlet />;
}
