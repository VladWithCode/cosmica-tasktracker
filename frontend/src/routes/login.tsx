import { createFileRoute, redirect } from "@tanstack/react-router";
import LoginForm from "@/components/LoginForm";
import { checkAuth } from "@/auth/useAuth";

export const Route = createFileRoute("/login")({
    component: LoginRoute,
    beforeLoad: async () => {
        const isAuthenticated = await checkAuth();
        if (isAuthenticated) {
            throw redirect({ to: "/tasks" });
        }
    },
});

function LoginRoute() {
    return <LoginForm />;
}
