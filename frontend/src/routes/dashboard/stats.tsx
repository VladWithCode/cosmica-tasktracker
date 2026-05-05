import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/stats")({
    beforeLoad: async () => {
        throw redirect({ to: "/stats" });
    },
    component: RouteComponent,
});

function RouteComponent() {
    return null;
}
