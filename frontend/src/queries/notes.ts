import { mutationOptions, queryOptions } from "@tanstack/react-query";
import { createNote, deleteNote, getNotes, updateNote } from "@/services/notes";
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

export function createNoteMutationOpts(date: string) {
    return mutationOptions({
        mutationFn: (content: string) => createNote(content),
        onSuccess: () => invalidateNotesForDate(date),
    });
}

export function updateNoteMutationOpts(date: string) {
    return mutationOptions({
        mutationFn: ({ id, content }: { id: string; content: string }) => updateNote(id, content),
        onSuccess: () => invalidateNotesForDate(date),
    });
}

export function deleteNoteMutationOpts(date: string) {
    return mutationOptions({
        mutationFn: (id: string) => deleteNote(id),
        onSuccess: () => invalidateNotesForDate(date),
    });
}
