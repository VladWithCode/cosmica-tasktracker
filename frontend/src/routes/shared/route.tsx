import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { checkAuth } from "@/auth/useAuth";

export const Route = createFileRoute("/shared")({
    component: () => <Outlet />,
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
