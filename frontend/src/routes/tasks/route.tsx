import { redirect } from "@tanstack/react-router";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { checkAuth } from "@/auth/useAuth";

export const Route = createFileRoute("/tasks")({
    component: RouteComponent,
    beforeLoad: async () => {
        try {
            const isAuthenticated = await checkAuth();
            if (!isAuthenticated) {
                throw redirect({ to: "/login" });
            }
        } catch (error) {
            throw redirect({ to: "/login" });
        }
    },
});

function RouteComponent() {
    return <Outlet />;
}
