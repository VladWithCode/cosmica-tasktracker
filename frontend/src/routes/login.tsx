import { createFileRoute, redirect } from "@tanstack/react-router";
import { LoginScreen } from "@/features/auth/LoginScreen";
import { sessionQuery } from "@/queries/session";

type LoginSearch = { redirect?: string };

export const Route = createFileRoute("/login")({
    validateSearch: (search: Record<string, unknown>): LoginSearch => ({
        redirect: typeof search.redirect === "string" ? search.redirect : undefined,
    }),
    beforeLoad: async ({ context }) => {
        const user = await context.queryClient.fetchQuery(sessionQuery).catch(() => null);
        if (user) throw redirect({ to: "/" });
    },
    component: LoginRoute,
});

function LoginRoute() {
    const { redirect: target } = Route.useSearch();
    return <LoginScreen redirect={target} />;
}
