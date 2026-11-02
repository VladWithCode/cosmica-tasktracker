import { createFileRoute } from "@tanstack/react-router";
import { RoutineDetailScreen } from "@/features/routines/RoutineDetailScreen";

export const Route = createFileRoute("/_app/routines/$id")({
    component: RoutineDetailRoute,
});

function RoutineDetailRoute() {
    const { id } = Route.useParams();
    return <RoutineDetailScreen id={id} />;
}
