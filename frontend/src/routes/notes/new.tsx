import { useMemo, useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { NoteForm } from "@/components/notes/NoteForm";
import { createNoteMutationOpts } from "@/queries/notes";

export const Route = createFileRoute("/notes/new")({
    component: NoteNewRoute,
});

function toDateString(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

function NoteNewRoute() {
    return (
        <AppShell showBackButton title="Nueva nota" topBarAlign="center">
            <NoteNewPage />
        </AppShell>
    );
}

function NoteNewPage() {
    const router = useRouter();
    const today = useMemo(() => toDateString(new Date()), []);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const mutation = useMutation({
        ...createNoteMutationOpts(today),
        onSuccess: () => {
            toast.success("Nota creada");
            void router.navigate({ to: "/notes" });
        },
        onError: (err: Error) => {
            const msg = err.message || "Error al crear nota";
            setErrorMessage(msg);
            toast.error(msg);
        },
    });

    const handleSubmit = (content: string) => {
        setErrorMessage(null);
        mutation.mutate(content);
    };

    const handleCancel = () => {
        if (window.history.length > 1) {
            router.history.back();
        } else {
            void router.navigate({ to: "/notes" });
        }
    };

    return (
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 pb-36 pt-6 sm:px-6">
            <NoteForm
                errorMessage={errorMessage}
                isSubmitting={mutation.isPending}
                onCancel={handleCancel}
                onSubmit={handleSubmit}
                submitLabel="Guardar nota"
            />
        </div>
    );
}
