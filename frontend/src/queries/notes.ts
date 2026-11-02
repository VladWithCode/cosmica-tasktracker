import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { errorMessage } from "@/api/client";
import { createNote, deleteNote, getNotes, updateNote } from "@/api/notes";
import type { Note } from "@/api/schemas";
import { toast } from "@/stores/toast";
import { queryKeys } from "./keys";

type NotesData = { notes: Note[]; date: string };

export function useNotes(date: string) {
    return useQuery({ queryKey: queryKeys.notes(date), queryFn: () => getNotes(date) });
}

function useInvalidateNotes() {
    const queryClient = useQueryClient();
    return () => {
        void queryClient.invalidateQueries({ queryKey: ["notes"] });
        void queryClient.invalidateQueries({ queryKey: ["notes-history"] });
    };
}

export function useCreateNote() {
    const invalidate = useInvalidateNotes();
    return useMutation({ mutationFn: (content: string) => createNote(content), onSuccess: invalidate });
}

export function useUpdateNote() {
    const invalidate = useInvalidateNotes();
    return useMutation({ mutationFn: ({ id, content }: { id: string; content: string }) => updateNote(id, content), onSuccess: invalidate });
}

export function useDeleteNoteWithUndo(date: string) {
    const queryClient = useQueryClient();
    const invalidate = useInvalidateNotes();
    const remove = useMutation({
        mutationFn: (id: string) => deleteNote(id),
        onSettled: invalidate,
    });

    return (note: Note) => {
        const key = queryKeys.notes(date);
        const previous = queryClient.getQueryData<NotesData>(key);
        queryClient.setQueryData<NotesData>(key, (data) => (data ? { ...data, notes: data.notes.filter((item) => item.id !== note.id) } : data));
        const restore = () => {
            if (previous) queryClient.setQueryData(key, previous);
        };
        toast.show("Nota eliminada", {
            duration: 5000,
            action: { label: "Deshacer", onAction: restore },
            onExpire: () =>
                remove.mutate(note.id, {
                    onError: (error) => {
                        restore();
                        toast.error(errorMessage(error));
                    },
                }),
        });
    };
}
