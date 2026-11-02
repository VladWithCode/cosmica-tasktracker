import { createFileRoute } from "@tanstack/react-router";
import { RoutinesScreen } from "@/features/routines/RoutinesScreen";

export const Route = createFileRoute("/_app/routines/")({
    component: RoutinesScreen,
});
