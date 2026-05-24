import { useCallback, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { NoteCard } from "@/components/notes/NoteCard";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { getNotesOpts } from "@/queries/notes";

export const Route = createFileRoute("/notes/history")({
    component: NotesHistoryRoute,
});

function toDateString(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

function NotesHistoryRoute() {
    return (
        <AppShell showBackButton title="Historial de notas" topBarAlign="center">
            <NotesHistoryPage />
        </AppShell>
    );
}

function NotesHistoryPage() {
    const [selectedDate, setSelectedDate] = useState(() => toDateString(new Date()));
    const { data, isLoading, isError, error } = useQuery(getNotesOpts(selectedDate));

    const isToday = selectedDate === toDateString(new Date());

    const formattedDate = useMemo(() => {
        const d = new Date(selectedDate + "T12:00:00");
        return d.toLocaleDateString("es-MX", {
            day: "2-digit",
            month: "long",
            weekday: "long",
            year: "numeric",
        });
    }, [selectedDate]);

    const goToday = useCallback(() => setSelectedDate(toDateString(new Date())), []);
    const goPrev = useCallback(
        () =>
            setSelectedDate((prev) => {
                const d = new Date(prev + "T12:00:00");
                d.setDate(d.getDate() - 1);
                return toDateString(d);
            }),
        [],
    );
    const goNext = useCallback(
        () =>
            setSelectedDate((prev) => {
                const d = new Date(prev + "T12:00:00");
                d.setDate(d.getDate() + 1);
                return toDateString(d);
            }),
        [],
    );

    return (
        <main className="relative mx-auto min-h-full max-w-3xl px-4 pb-36 pt-6 sm:px-6">
            <section className="relative mb-6">
                <div className="flex items-center justify-between gap-2">
                    <button
                        aria-label="Día anterior"
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-outline-variant/20 bg-surface-container-lowest text-on-surface-variant transition-colors hover:text-primary"
                        onClick={goPrev}
                        type="button"
                    >
                        <MaterialIcon className="text-2xl" name="chevron_left" />
                    </button>

                    <div className="flex flex-1 flex-col items-center gap-1">
                        <p className="text-center font-display text-lg font-bold capitalize text-on-surface sm:text-xl">
                            {formattedDate}
                        </p>
                        <div className="flex items-center gap-2">
                            {!isToday ? (
                                <button
                                    className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-label text-[11px] font-bold uppercase tracking-widest text-primary transition-colors hover:bg-primary/20"
                                    onClick={goToday}
                                    type="button"
                                >
                                    Hoy
                                </button>
                            ) : (
                                <span className="rounded-full bg-primary/15 px-3 py-1 font-label text-[11px] font-bold uppercase tracking-widest text-primary">
                                    Hoy
                                </span>
                            )}
                            <input
                                aria-label="Seleccionar fecha"
                                className="h-7 rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-2 text-xs text-on-surface focus:border-primary focus:outline-none"
                                onChange={(e) => {
                                    if (e.target.value) setSelectedDate(e.target.value);
                                }}
                                type="date"
                                value={selectedDate}
                            />
                        </div>
                    </div>

                    <button
                        aria-label="Día siguiente"
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-outline-variant/20 bg-surface-container-lowest text-on-surface-variant transition-colors hover:text-primary"
                        onClick={goNext}
                        type="button"
                    >
                        <MaterialIcon className="text-2xl" name="chevron_right" />
                    </button>
                </div>

                <p className="mt-2 text-center font-label text-xs text-on-surface-variant">
                    {(data?.length ?? 0)} {(data?.length ?? 0) === 1 ? "nota" : "notas"}
                </p>
            </section>

            {isLoading ? (
                <div className="space-y-2">
                    {Array.from({ length: 4 }, (_, i) => (
                        <div className="h-20 animate-pulse rounded-2xl bg-surface-container-low" key={i} />
                    ))}
                </div>
            ) : isError ? (
                <div className="rounded-xl border border-error-dim/30 bg-error-container/10 p-5 text-sm text-error">
                    <div className="flex items-center gap-2">
                        <MaterialIcon filled name="error" />
                        <p>{error instanceof Error ? error.message : "No se pudieron cargar las notas."}</p>
                    </div>
                </div>
            ) : !data || data.length === 0 ? (
                <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-outline-variant/40 bg-surface-container/40 px-6 py-12 text-center">
                    <MaterialIcon className="text-4xl text-on-surface-variant" name="sticky_note_2" />
                    <p className="font-label text-sm text-on-surface-variant">
                        No hay notas para este día.
                    </p>
                </div>
            ) : (
                <ul className="flex flex-col gap-3">
                    {data.map((note) => (
                        <li key={note.id}>
                            <NoteCard date={selectedDate} note={note} />
                        </li>
                    ))}
                </ul>
            )}
        </main>
    );
}
