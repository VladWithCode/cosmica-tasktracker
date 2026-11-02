import { api } from "./client";
import { noteResponseSchema, notesHistoryResponseSchema, notesResponseSchema, type Note } from "./schemas";

export function getNotes(date: string) {
    return api("/api/v1/notes", { query: { date }, schema: notesResponseSchema });
}

export function getNotesHistory(from: string, to: string) {
    return api("/api/v1/notes/history", { query: { from, to }, schema: notesHistoryResponseSchema });
}

export function createNote(content: string): Promise<Note> {
    return api("/api/v1/notes", { method: "POST", body: { content }, schema: noteResponseSchema });
}

export function updateNote(id: string, content: string): Promise<Note> {
    return api(`/api/v1/notes/${encodeURIComponent(id)}`, { method: "PUT", body: { content }, schema: noteResponseSchema });
}

export async function deleteNote(id: string): Promise<void> {
    await api(`/api/v1/notes/${encodeURIComponent(id)}`, { method: "DELETE" });
}
