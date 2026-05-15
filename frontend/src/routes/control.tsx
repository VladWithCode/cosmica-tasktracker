import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/control")({
    beforeLoad: async () => {
        throw redirect({ to: "/focus" });
    },
    component: RouteComponent,
});

function RouteComponent() {
    return null;
}
