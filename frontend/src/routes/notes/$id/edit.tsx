import { useMemo, useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { NoteForm } from "@/components/notes/NoteForm";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { findCachedNote, updateNoteMutationOpts } from "@/queries/notes";

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
    const cachedNote = useMemo(() => findCachedNote(id), [id]);
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

    if (!cachedNote) {
        return (
            <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-4 px-4 pb-36 pt-12 text-center sm:px-6">
                <MaterialIcon className="text-4xl text-on-surface-variant" name="search_off" />
                <p className="font-label text-sm text-on-surface-variant">
                    No encontramos la nota en caché. Vuelve al historial o a hoy para abrirla.
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
                initialContent={cachedNote.content}
                isSubmitting={mutation.isPending}
                onCancel={handleCancel}
                onSubmit={handleSubmit}
                submitLabel="Guardar cambios"
            />
        </div>
    );
}
