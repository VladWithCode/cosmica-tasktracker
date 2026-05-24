import { useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { NoteForm } from "@/components/notes/NoteForm";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { getNoteOpts, updateNoteMutationOpts } from "@/queries/notes";

export const Route = createFileRoute("/notes/$id/edit")({
    component: NoteEditRoute,
});

function NoteEditRoute() {
    return (
        <AppShell showBackButton title="Editar nota" topBarAlign="center">
            <NoteEditPage />
        </AppShell>
    );
}

function NoteEditPage() {
    const router = useRouter();
    const { id } = Route.useParams();
    const { data: note, isLoading, isError, error } = useQuery(getNoteOpts(id));
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const mutation = useMutation({
        ...updateNoteMutationOpts,
        onSuccess: () => {
            toast.success("Nota actualizada");
            if (window.history.length > 1) {
                router.history.back();
            } else {
                void router.navigate({ to: "/notes" });
            }
        },
        onError: (err: Error) => {
            const msg = err.message || "Error al actualizar nota";
            setErrorMessage(msg);
            toast.error(msg);
        },
    });

    const handleSubmit = (content: string) => {
        setErrorMessage(null);
        mutation.mutate({ content, id });
    };

    const handleCancel = () => {
        if (window.history.length > 1) {
            router.history.back();
        } else {
            void router.navigate({ to: "/notes" });
        }
    };

    if (isLoading) {
        return (
            <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 px-4 pb-36 pt-6 sm:px-6">
                <div className="h-48 animate-pulse rounded-2xl bg-surface-container-low" />
            </div>
        );
    }

    if (isError || !note) {
        return (
            <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-4 px-4 pb-36 pt-12 text-center sm:px-6">
                <MaterialIcon className="text-4xl text-error" name="error" />
                <p className="font-label text-sm text-on-surface-variant">
                    {error instanceof Error ? error.message : "No se pudo cargar la nota."}
                </p>
                <button
                    className="rounded-full border border-primary/40 px-4 py-2 font-label text-sm font-bold text-primary transition-colors hover:bg-primary/10"
                    onClick={() => router.navigate({ to: "/notes" })}
                    type="button"
                >
                    Ir a notas
                </button>
            </div>
        );
    }

    return (
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 pb-36 pt-6 sm:px-6">
            <NoteForm
                errorMessage={errorMessage}
                initialContent={note.content}
                isSubmitting={mutation.isPending}
                onCancel={handleCancel}
                onSubmit={handleSubmit}
                submitLabel="Guardar cambios"
            />
        </div>
    );
}
