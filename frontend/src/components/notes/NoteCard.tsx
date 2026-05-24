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
}

export function NoteCard({ note }: NoteCardProps) {
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
            </div>
        </article>
    );
}
