import { createFileRoute, redirect } from "@tanstack/react-router";
import { checkAuth } from "@/auth/useAuth";

export const Route = createFileRoute("/")({
    component: IndexRoute,
    beforeLoad: async () => {
        let isAuthenticated: boolean;
        try {
            isAuthenticated = await checkAuth();
        } catch (error) {
            console.error("Check auth error:", error);
            isAuthenticated = false;
        }
        if (isAuthenticated) {
            throw redirect({ to: "/tasks" });
        }
        throw redirect({ to: "/login" });
    },
});

function IndexRoute() {
    return null;
}
