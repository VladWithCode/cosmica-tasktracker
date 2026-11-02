import { useState } from "react";
import { errorMessage } from "@/api/client";
import type { Note } from "@/api/schemas";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { useCreateNote, useUpdateNote } from "@/queries/notes";
import { toast } from "@/stores/toast";

export type NoteTarget = { mode: "new" } | { mode: "edit"; note: Note } | null;

export function NoteSheet({ target, onClose }: { target: NoteTarget; onClose: () => void }) {
    return (
        <Sheet
            open={target !== null}
            onOpenChange={(open) => (open ? undefined : onClose())}
            title={target?.mode === "edit" ? "Editar nota" : "Nueva nota"}
            description="Escribe una nota del día"
        >
            {target ? <NoteEditor key={target.mode === "edit" ? target.note.id : "new"} target={target} onDone={onClose} /> : null}
        </Sheet>
    );
}

function NoteEditor({ target, onDone }: { target: Exclude<NoteTarget, null>; onDone: () => void }) {
    const [content, setContent] = useState(target.mode === "edit" ? target.note.content : "");
    const create = useCreateNote();
    const update = useUpdateNote();
    const pending = create.isPending || update.isPending;
    const failure = create.error ?? update.error;
    const trimmed = content.trim();

    const saved = () => {
        toast.show("Nota guardada");
        onDone();
    };

    const save = () => {
        if (!trimmed) return;
        if (target.mode === "new") {
            create.mutate(trimmed, { onSuccess: saved });
            return;
        }
        if (trimmed === target.note.content) onDone();
        else update.mutate({ id: target.note.id, content: trimmed }, { onSuccess: saved });
    };

    return (
        <form
            noValidate
            onSubmit={(event) => {
                event.preventDefault();
                save();
            }}
            className="flex flex-col gap-4 px-4"
        >
            <label htmlFor="note-content" className="sr-only">
                Nota
            </label>
            <textarea
                id="note-content"
                autoFocus
                rows={8}
                maxLength={5000}
                value={content}
                onChange={(event) => setContent(event.target.value)}
                onKeyDown={(event) => {
                    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) save();
                }}
                placeholder="¿Qué quieres recordar de hoy?"
                className="min-h-48 w-full resize-none rounded-card bg-bg-elevated p-4 text-body text-label outline-none placeholder:text-label-tertiary focus:ring-2 focus:ring-accent"
            />
            {failure ? (
                <p role="alert" className="px-1 text-footnote text-danger">
                    {errorMessage(failure)}
                </p>
            ) : null}
            <Button type="submit" size="lg" loading={pending} disabled={!trimmed}>
                Guardar
            </Button>
        </form>
    );
}
