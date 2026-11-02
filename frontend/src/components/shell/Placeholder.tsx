import { Construction } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Screen } from "./Screen";

export function Placeholder({ title }: { title: string }) {
    return (
        <Screen title={title}>
            <EmptyState icon={Construction} title="En construcción" message="Esta sección llega en una fase próxima del rediseño." />
        </Screen>
    );
}
