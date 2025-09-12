import { createFileRoute, redirect } from "@tanstack/react-router";
import LoginForm from "@/components/LoginForm";
import { checkAuth } from "@/auth/useAuth";

export const Route = createFileRoute("/")({
    component: App,
    beforeLoad: async () => {
        let isAuthenticated;
        try {
            isAuthenticated = await checkAuth();
        } catch (error) {
            console.error("Check auth error:", error);
            isAuthenticated = false;
        }
        if (isAuthenticated) {
            throw redirect({ to: "/tasks" });
        }
    },
});

function App() {
    return <LoginForm />;
}
