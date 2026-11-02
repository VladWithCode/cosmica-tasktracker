import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/components/shell/Placeholder";

export const Route = createFileRoute("/_app/progress")({
    component: () => <Placeholder title="Progreso" />,
});
