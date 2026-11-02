import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { NotebookPen, Plus, Trash } from "lucide-react";
import type { Note } from "@/api/schemas";
import { Screen } from "@/components/shell/Screen";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Pressable } from "@/components/ui/Pressable";
import { PullToRefresh } from "@/components/ui/PullToRefresh";
import { Skeleton } from "@/components/ui/Skeleton";
import { SwipeRow } from "@/components/ui/SwipeRow";
import { DayPicker, MonthToggle, visibleRange } from "@/features/calendar/DayPicker";
import { formatDay, isToday, todayISO } from "@/lib/date";
import { fade, spring } from "@/lib/motion";
import { useNotesHistory } from "@/queries/history";
import { useDeleteNoteWithUndo, useNotes } from "@/queries/notes";
import { NoteSheet, type NoteTarget } from "./NoteSheet";

function timeOf(value: string): string {
    return new Date(value).toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit", timeZone: "America/Mexico_City" });
}

export function NotesScreen({ date, onSelectDate }: { date: string; onSelectDate: (date: string) => void }) {
    const reduceMotion = useReducedMotion();
    const [monthOpen, setMonthOpen] = useState(false);
    const [target, setTarget] = useState<NoteTarget>(null);
    const notes = useNotes(date);
    const range = visibleRange(date, monthOpen);
    const history = useNotesHistory(range.from, range.to);
    const dotDays = new Set((history.data?.days ?? []).filter((day) => day.total > 0).map((day) => day.date));
    const removeNote = useDeleteNoteWithUndo(date);
    const today = isToday(date);
    const list = notes.data?.notes ?? [];

    return (
        <Screen
            title="Notas"
            titleAccessory={<MonthToggle date={date} open={monthOpen} onToggle={() => setMonthOpen((value) => !value)} />}
            actions={
                <>
                    {today ? null : (
                        <Button variant="plain" size="sm" onClick={() => onSelectDate(todayISO())}>
                            Hoy
                        </Button>
                    )}
                    {today ? (
                        <Pressable aria-label="Nueva nota" onClick={() => setTarget({ mode: "new" })} className="flex size-11 items-center justify-center text-accent">
                            <Plus aria-hidden className="size-6" strokeWidth={2.2} />
                        </Pressable>
                    ) : null}
                </>
            }
        >
            <DayPicker date={date} monthOpen={monthOpen} onSelect={onSelectDate} dotDays={dotDays} />
            <h2 className="px-8 pt-4 pb-1 text-headline">{formatDay(date)}</h2>
            <PullToRefresh onRefresh={() => notes.refetch()}>
                {notes.isPending ? (
                    <div className="flex flex-col gap-3 px-4 pt-2">
                        <Skeleton className="h-24 rounded-card" />
                        <Skeleton className="h-16 rounded-card" />
                    </div>
                ) : null}
                {notes.isError ? <ErrorState error={notes.error} onRetry={() => void notes.refetch()} /> : null}
                {notes.data && list.length === 0 ? (
                    <EmptyState
                        icon={NotebookPen}
                        title={today ? "Sin notas todavía" : "Sin notas este día"}
                        message={today ? "Anota lo que quieras recordar de hoy." : "Solo se pueden añadir notas al día de hoy."}
                        action={today ? <Button onClick={() => setTarget({ mode: "new" })}>Escribir nota</Button> : undefined}
                    />
                ) : null}
                <ul className="flex flex-col gap-3 px-4 pt-2">
                    <AnimatePresence initial={false}>
                        {list.map((note) => (
                            <motion.li
                                key={note.id}
                                layout="position"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0, transition: fade }}
                                transition={reduceMotion ? fade : spring.default}
                            >
                                <NoteCard note={note} onOpen={() => setTarget({ mode: "edit", note })} onDelete={() => removeNote(note)} />
                            </motion.li>
                        ))}
                    </AnimatePresence>
                </ul>
            </PullToRefresh>
            <NoteSheet target={target} onClose={() => setTarget(null)} />
        </Screen>
    );
}

function NoteCard({ note, onOpen, onDelete }: { note: Note; onOpen: () => void; onDelete: () => void }) {
    const edited = Boolean(note.updatedAt) && Date.parse(note.updatedAt) - Date.parse(note.createdAt) > 1000;
    return (
        <SwipeRow className="rounded-card" trailing={[{ id: "delete", label: "Eliminar", icon: Trash, tone: "danger", onTrigger: onDelete }]}>
            <button type="button" onClick={onOpen} className="flex w-full flex-col gap-1.5 p-4 text-left active:bg-fill-secondary">
                <p className="line-clamp-6 text-body whitespace-pre-wrap">{note.content}</p>
                <p className="text-footnote text-label-secondary">
                    {timeOf(note.createdAt)}
                    {edited ? " · editada" : ""}
                </p>
            </button>
        </SwipeRow>
    );
}
