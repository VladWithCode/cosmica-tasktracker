import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { TaskNewPage } from "@/pages/TaskNewPage";

export const Route = createFileRoute("/tasks/new")({
    component: RouteComponent,
});

function RouteComponent() {
    return (
        <AppShell showBackButton showBottomNav={false} title="Nueva rutina" topBarAlign="center">
            <TaskNewPage />
        </AppShell>
    );
}
