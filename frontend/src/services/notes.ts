import type { ApiResponse } from "@/types/api";
import { getApiError } from "@/types/api";
import type { Note } from "@/types/note";

interface NoteData {
    note: Note;
}

interface NotesListData {
    notes: Note[];
    date: string;
}

export async function getNotes(date: string): Promise<Note[]> {
    const response = await fetch(`/api/v1/notes?date=${encodeURIComponent(date)}`, {
        credentials: "include",
    });
    const data = (await response.json()) as ApiResponse<NotesListData>;
    if (!response.ok) {
        throw new Error(getApiError(data, "Error al obtener notas"));
    }
    return data.data?.notes ?? [];
}

export async function getNote(id: string): Promise<Note> {
    const response = await fetch(`/api/v1/notes/${id}`, { credentials: "include" });
    const data = (await response.json()) as ApiResponse<NoteData>;
    if (!response.ok) {
        throw new Error(getApiError(data, "Error al obtener nota"));
    }
    if (!data.data?.note) {
        throw new Error("La respuesta no incluyó la nota");
    }
    return data.data.note;
}

export async function createNote(content: string): Promise<Note> {
    const response = await fetch("/api/v1/notes", {
        body: JSON.stringify({ content }),
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        method: "POST",
    });
    const data = (await response.json()) as ApiResponse<NoteData>;
    if (!response.ok) {
        throw new Error(getApiError(data, "Error al crear nota"));
    }
    if (!data.data?.note) {
        throw new Error("La respuesta no incluyó la nota");
    }
    return data.data.note;
}

export async function updateNote(id: string, content: string): Promise<Note> {
    const response = await fetch(`/api/v1/notes/${id}`, {
        body: JSON.stringify({ content }),
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        method: "PUT",
    });
    const data = (await response.json()) as ApiResponse<NoteData>;
    if (!response.ok) {
        throw new Error(getApiError(data, "Error al actualizar nota"));
    }
    if (!data.data?.note) {
        throw new Error("La respuesta no incluyó la nota");
    }
    return data.data.note;
}

export async function deleteNote(id: string): Promise<void> {
    const response = await fetch(`/api/v1/notes/${id}`, {
        credentials: "include",
        method: "DELETE",
    });
    if (!response.ok) {
        const data = (await response.json().catch(() => null)) as ApiResponse<unknown> | null;
        throw new Error(getApiError(data ?? ({} as ApiResponse<unknown>), "Error al eliminar nota"));
    }
}
