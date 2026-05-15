import { createFileRoute, redirect } from "@tanstack/react-router";
import { checkAuth } from "@/auth/useAuth";
import { RegisterPage } from "@/pages/RegisterPage";

export const Route = createFileRoute("/register")({
    component: RegisterRoute,
    beforeLoad: async () => {
        const isAuthenticated = await checkAuth();
        if (isAuthenticated) {
            throw redirect({ to: "/tasks" });
        }
    },
});

function RegisterRoute() {
    return <RegisterPage />;
}
