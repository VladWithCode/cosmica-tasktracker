import { createFileRoute, redirect } from "@tanstack/react-router";
import { ApiError } from "@/api/client";
import { AppShell } from "@/components/shell/AppShell";
import { sessionQuery } from "@/queries/session";

export const Route = createFileRoute("/_app")({
    beforeLoad: async ({ context, location }) => {
        try {
            await context.queryClient.ensureQueryData(sessionQuery);
        } catch (error) {
            if (error instanceof ApiError && error.status === 401) {
                throw redirect({ to: "/login", search: { redirect: location.href === "/" ? undefined : location.href } });
            }
            throw error;
        }
    },
    component: AppShell,
});
