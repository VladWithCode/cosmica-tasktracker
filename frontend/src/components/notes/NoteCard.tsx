import { Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { deleteNoteMutationOpts } from "@/queries/notes";
import { cn } from "@/lib/utils";
import type { Note } from "@/types/note";

const datetimeFormatter = new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
});

function formatNoteDatetime(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return datetimeFormatter.format(date);
}

interface NoteCardProps {
    note: Note;
    /** Date string YYYY-MM-DD used as cache key to invalidate after delete. */
    date: string;
}

export function NoteCard({ note, date }: NoteCardProps) {
    const deleteMutation = useMutation({
        ...deleteNoteMutationOpts(date),
        onSuccess: () => {
            toast.success("Nota eliminada");
        },
        onError: (err: Error) => {
            toast.error(err.message || "Error al eliminar nota");
        },
    });

    const handleDelete = () => {
        if (deleteMutation.isPending) return;
        const confirmed = window.confirm("¿Eliminar esta nota? Esta acción no se puede deshacer.");
        if (!confirmed) return;
        deleteMutation.mutate(note.id);
    };

    return (
        <article className="flex flex-col gap-3 rounded-2xl border border-outline-variant/30 bg-surface-container p-4 shadow-sm">
            <p className="whitespace-pre-wrap break-words font-body text-sm text-on-surface">
                {note.content}
            </p>
            <div className="flex items-center justify-between gap-3">
                <time
                    className="font-label text-xs text-on-surface-variant"
                    dateTime={note.created_at}
                >
                    {formatNoteDatetime(note.created_at)}
                </time>
                <div className="flex items-center gap-2">
                    <Link
                        aria-label="Editar nota"
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-outline-variant/30 bg-surface-container-lowest text-on-surface-variant transition-colors hover:border-primary/40 hover:text-primary"
                        params={{ id: note.id }}
                        to="/notes/$id/edit"
                    >
                        <MaterialIcon name="edit" />
                    </Link>
                    <button
                        aria-label="Eliminar nota"
                        className={cn(
                            "flex h-9 w-9 items-center justify-center rounded-full border border-outline-variant/30 bg-surface-container-lowest text-on-surface-variant transition-colors hover:border-error/40 hover:text-error",
                            deleteMutation.isPending && "opacity-50",
                        )}
                        disabled={deleteMutation.isPending}
                        onClick={handleDelete}
                        type="button"
                    >
                        <MaterialIcon name="delete" />
                    </button>
                </div>
            </div>
        </article>
    );
}
