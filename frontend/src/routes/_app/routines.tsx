import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/components/shell/Placeholder";

export const Route = createFileRoute("/_app/routines")({
    component: () => <Placeholder title="Rutinas" />,
});
