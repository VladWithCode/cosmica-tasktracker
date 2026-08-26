import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { NoteCard } from "@/components/notes/NoteCard";
import { QuickNoteDialog } from "@/components/notes/QuickNoteDialog";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { todayDateString } from "@/lib/date";
import { getNotesOpts } from "@/queries/notes";

export const Route = createFileRoute("/notes/")({
    component: NotesIndexRoute,
});

const dateFormatter = new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "long",
    weekday: "long",
    year: "numeric",
});

function NotesIndexRoute() {
    return (
        <AppShell title="Notas" topBarAlign="center">
            <NotesIndexPage />
        </AppShell>
    );
}

function NotesIndexPage() {
    const today = useMemo(() => todayDateString(), []);
    const { data, isLoading, isError, error } = useQuery(getNotesOpts(today));

    const formattedDate = useMemo(() => {
        const d = new Date(today + "T12:00:00");
        return dateFormatter.format(d);
    }, [today]);

    const [quickNoteOpen, setQuickNoteOpen] = useState(false);

    return (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pb-36 pt-6 sm:px-6">
            <header className="flex flex-col gap-1">
                <p className="font-label text-xs uppercase tracking-widest text-on-surface-variant">
                    Hoy
                </p>
                <h2 className="font-display text-2xl font-bold capitalize text-on-surface">
                    {formattedDate}
                </h2>
            </header>

            <div className="flex flex-wrap gap-3">
                <button
                    className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 font-label text-sm font-bold text-on-primary shadow-sm transition-colors hover:bg-primary-dim"
                    onClick={() => setQuickNoteOpen(true)}
                    type="button"
                >
                    <MaterialIcon name="add" />
                    Nueva nota
                </button>
                <Link
                    className="inline-flex items-center gap-2 rounded-full border border-outline-variant/40 bg-surface-container-lowest px-4 py-2 font-label text-sm font-bold text-on-surface-variant transition-colors hover:border-primary/40 hover:text-primary"
                    to="/notes/history"
                >
                    <MaterialIcon name="history" />
                    Historial
                </Link>
            </div>

            {isLoading ? (
                <p className="text-sm text-on-surface-variant">Cargando notas…</p>
            ) : isError ? (
                <p className="text-sm text-error">
                    {error instanceof Error ? error.message : "Error al cargar notas"}
                </p>
            ) : !data || data.length === 0 ? (
                <EmptyState onCreate={() => setQuickNoteOpen(true)} />
            ) : (
                <ul className="flex flex-col gap-3">
                    {data.map((note) => (
                        <li key={note.id}>
                            <NoteCard date={today} note={note} />
                        </li>
                    ))}
                </ul>
            )}

            <QuickNoteDialog
                open={quickNoteOpen}
                onOpenChange={setQuickNoteOpen}
                date={today}
            />
        </div>
    );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
    return (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-outline-variant/40 bg-surface-container/40 px-6 py-12 text-center">
            <MaterialIcon className="text-4xl text-on-surface-variant" name="sticky_note_2" />
            <p className="font-label text-sm text-on-surface-variant">
                Aún no tienes notas para hoy.
            </p>
            <button
                className="inline-flex items-center gap-2 rounded-full border border-primary/40 px-4 py-2 font-label text-sm font-bold text-primary transition-colors hover:bg-primary/10"
                onClick={onCreate}
                type="button"
            >
                <MaterialIcon name="add" />
                Crear primera nota
            </button>
        </div>
    );
}
