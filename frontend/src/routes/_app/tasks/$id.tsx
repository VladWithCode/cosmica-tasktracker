import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/tasks/$id")({
    beforeLoad: ({ params }) => {
        throw redirect({ to: "/", search: { task: params.id } });
    },
});
