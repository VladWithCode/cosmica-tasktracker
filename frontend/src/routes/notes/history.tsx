import { useCallback, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import {
    DayNavHeader,
    dayNavNeutralAction,
    dayNavPrimaryAction,
} from "@/components/layout/DayNavHeader";
import { NoteCard } from "@/components/notes/NoteCard";
import { NotesCalendar } from "@/components/notes/NotesCalendar";
import { QuickNoteDialog } from "@/components/notes/QuickNoteDialog";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { addDays, isValidDateString, todayDateString } from "@/lib/date";
import { getNotesOpts } from "@/queries/notes";

type NotesHistorySearch = {
    date?: string;
};

export const Route = createFileRoute("/notes/history")({
    component: NotesHistoryRoute,
    validateSearch: (search: Record<string, unknown>): NotesHistorySearch => {
        return isValidDateString(search.date) ? { date: search.date } : {};
    },
});

function NotesHistoryRoute() {
    return (
        <AppShell showBackButton title="Historial de notas" topBarAlign="center">
            <NotesHistoryPage />
        </AppShell>
    );
}

function NotesHistoryPage() {
    const { date } = Route.useSearch();
    if (!date) {
        return <NotesCalendar />;
    }
    return <NotesDayView date={date} />;
}

function NotesDayView({ date: selectedDate }: { date: string }) {
    const navigate = useNavigate();
    const { data, isLoading, isError, error } = useQuery(getNotesOpts(selectedDate));

    const goToDate = useCallback(
        (next: string) => navigate({ to: "/notes/history", search: { date: next } }),
        [navigate],
    );
    const goCalendar = useCallback(
        () => navigate({ to: "/notes/history", search: {} }),
        [navigate],
    );
    const goPrev = useCallback(
        () => goToDate(addDays(selectedDate, -1)),
        [selectedDate, goToDate],
    );
    const goNext = useCallback(
        () => goToDate(addDays(selectedDate, 1)),
        [selectedDate, goToDate],
    );

    // A note is always stamped with the current server day, so creating one is
    // only offered while today is the day in view.
    const isToday = selectedDate === todayDateString();
    const [quickNoteOpen, setQuickNoteOpen] = useState(false);

    return (
        <main className="relative mx-auto min-h-full max-w-3xl px-4 pb-36 sm:px-6">
            <DayNavHeader
                date={selectedDate}
                onPrev={goPrev}
                onNext={goNext}
                leading={
                    <button
                        aria-label="Ver calendario"
                        className={dayNavNeutralAction}
                        onClick={goCalendar}
                        type="button"
                    >
                        <MaterialIcon name="calendar_month" className="text-xl" />
                    </button>
                }
                actions={
                    isToday ? (
                        <button
                            aria-label="Agregar nota"
                            className={dayNavPrimaryAction}
                            onClick={() => setQuickNoteOpen(true)}
                            type="button"
                        >
                            <MaterialIcon name="add" className="text-xl" />
                        </button>
                    ) : undefined
                }
            />

            <QuickNoteDialog
                open={quickNoteOpen}
                onOpenChange={setQuickNoteOpen}
                date={selectedDate}
            />

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
