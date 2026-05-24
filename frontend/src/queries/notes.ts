import { mutationOptions, queryOptions } from "@tanstack/react-query";
import { createNote, deleteNote, getNotes, updateNote } from "@/services/notes";
import type { Note } from "@/types/note";
import { queryClient } from "./queryClient";

export const NotesQueryKeys = {
    all: () => ["notes"] as const,
    listing: () => [...NotesQueryKeys.all(), "listing"] as const,
    byDate: (date: string) => [...NotesQueryKeys.listing(), "date", date] as const,
};

export function getNotesOpts(date: string) {
    return queryOptions({
        queryKey: NotesQueryKeys.byDate(date),
        queryFn: () => getNotes(date),
        staleTime: 60_000,
    });
}

function invalidateNotesForDate(date: string) {
    void queryClient.invalidateQueries({ queryKey: NotesQueryKeys.byDate(date) });
}

function invalidateAllNotes() {
    void queryClient.invalidateQueries({ queryKey: NotesQueryKeys.listing() });
}

/** Look up a note in any cached listing query. Returns null if not cached. */
export function findCachedNote(noteId: string): Note | null {
    const entries = queryClient.getQueriesData<Note[]>({ queryKey: NotesQueryKeys.listing() });
    for (const [, notes] of entries) {
        if (!notes) continue;
        const found = notes.find((n) => n.id === noteId);
        if (found) return found;
    }
    return null;
}

export function createNoteMutationOpts(date: string) {
    return mutationOptions({
        mutationFn: (content: string) => createNote(content),
        onSuccess: () => invalidateNotesForDate(date),
    });
}

/** Update mutation invalidates all cached note dates because an edited note may
 *  surface in multiple cached lists. */
export const updateNoteMutationOpts = mutationOptions({
    mutationFn: ({ id, content }: { id: string; content: string }) => updateNote(id, content),
    onSuccess: () => invalidateAllNotes(),
});

export function deleteNoteMutationOpts(date: string) {
    return mutationOptions({
        mutationFn: (id: string) => deleteNote(id),
        onSuccess: () => invalidateNotesForDate(date),
    });
}
