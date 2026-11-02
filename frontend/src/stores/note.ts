import { create } from "zustand";
import type { Note } from "@/api/schemas";

export type NoteTarget = { mode: "new" } | { mode: "edit"; note: Note } | null;

type NoteSheetState = {
    target: NoteTarget;
    openNew: () => void;
    openEdit: (note: Note) => void;
    close: () => void;
};

export const useNoteSheetStore = create<NoteSheetState>((set) => ({
    target: null,
    openNew: () => set({ target: { mode: "new" } }),
    openEdit: (note) => set({ target: { mode: "edit", note } }),
    close: () => set({ target: null }),
}));
