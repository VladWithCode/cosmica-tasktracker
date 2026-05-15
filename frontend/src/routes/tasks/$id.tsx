import { TaskDetailPage } from "@/pages/TaskDetailPage";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/tasks/$id")({
    component: RouteComponent,
});

function RouteComponent() {
    const { id } = Route.useParams();

    return <TaskDetailPage taskId={id} />;
}
