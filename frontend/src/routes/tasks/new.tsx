import { createFileRoute } from "@tanstack/react-router";
import { TaskNewPage } from "@/pages/TaskNewPage";

export const Route = createFileRoute("/tasks/new")({
    component: RouteComponent,
});

function RouteComponent() {
    return <TaskNewPage />;
}
