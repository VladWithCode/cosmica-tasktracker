import { createFileRoute } from "@tanstack/react-router";
import { RoutineConfigurationPage } from "@/pages/RoutineConfigurationPage";

export const Route = createFileRoute("/tasks/new")({
    component: RouteComponent,
});

function RouteComponent() {
    return <RoutineConfigurationPage />;
}
