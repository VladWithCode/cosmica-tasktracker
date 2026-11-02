import { CircleAlert } from "lucide-react";
import { errorMessage } from "@/api/client";
import { Button } from "./Button";
import { EmptyState } from "./EmptyState";

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
    return (
        <EmptyState
            icon={CircleAlert}
            title="No se pudo cargar"
            message={errorMessage(error)}
            action={onRetry ? <Button variant="tinted" onClick={onRetry}>Reintentar</Button> : undefined}
        />
    );
}
