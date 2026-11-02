import { createFileRoute, redirect } from "@tanstack/react-router";
import { RegisterScreen } from "@/features/auth/RegisterScreen";
import { sessionQuery } from "@/queries/session";

export const Route = createFileRoute("/register")({
    beforeLoad: async ({ context }) => {
        const user = await context.queryClient.fetchQuery(sessionQuery).catch(() => null);
        if (user) throw redirect({ to: "/" });
    },
    component: RegisterScreen,
});
