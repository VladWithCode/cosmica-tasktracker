import { useCallback, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createNoteMutationOpts } from "@/queries/notes";

/**
 * Create a note without leaving the current view.
 *
 * `POST /api/v1/notes` stamps the note with the current server day, so callers
 * must only offer this while today is the day in view. This is the only way to
 * create a note; editing an existing one still has its own page.
 */
export function QuickNoteDialog({
    open,
    onOpenChange,
    date,
    onCreated,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Day the new note will land on; used to refresh that day's listing. */
    date: string;
    /** Called after a successful save, once the dialog has closed. */
    onCreated?: () => void;
}) {
    const [content, setContent] = useState("");

    const createNote = useMutation({
        ...createNoteMutationOpts(date),
        onError: (err: Error) => {
            toast.error(err.message || "Ocurrió un error al crear la nota");
        },
    });

    const canSubmit = content.trim().length > 0 && !createNote.isPending;

    const handleOpenChange = useCallback(
        (next: boolean) => {
            if (!next) setContent("");
            onOpenChange(next);
        },
        [onOpenChange],
    );

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Nueva nota</DialogTitle>
                    <DialogDescription>Agrega una nota para hoy.</DialogDescription>
                </DialogHeader>

                <form
                    className="space-y-4"
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (!canSubmit) return;
                        // Cache invalidation lives on the shared mutation options;
                        // these are this dialog's own success side effects.
                        createNote.mutate(content.trim(), {
                            onSuccess: () => {
                                toast.success("Nota creada");
                                setContent("");
                                onOpenChange(false);
                                onCreated?.();
                            },
                        });
                    }}
                >
                    <div className="space-y-2">
                        <Label htmlFor="quick-note-content">¿Qué quieres anotar?</Label>
                        <Textarea
                            id="quick-note-content"
                            autoFocus
                            className="min-h-32"
                            placeholder="Escribe tu nota"
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                        />
                    </div>

                    <DialogFooter className="gap-2 sm:gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleOpenChange(false)}
                        >
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={!canSubmit}>
                            {createNote.isPending ? "Creando..." : "Crear"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
