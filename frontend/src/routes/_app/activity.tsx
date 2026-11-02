import { createFileRoute } from "@tanstack/react-router";
import { ActivityScreen } from "@/features/activity/ActivityScreen";

export const Route = createFileRoute("/_app/activity")({
    component: ActivityScreen,
});
