import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getNotesHistory } from "@/api/notes";
import { getHistory, getMetrics } from "@/api/tasks";
import { queryKeys } from "./keys";

export type DayMark = "full" | "partial" | "empty";

export function useHistory(ownerId: string | null, from: string, to: string) {
    return useQuery({
        queryKey: queryKeys.history(ownerId, from, to),
        queryFn: () => getHistory(from, to, ownerId ?? undefined),
        staleTime: 60_000,
        placeholderData: keepPreviousData,
    });
}

export function useMetrics(ownerId: string | null, from: string, to: string) {
    return useQuery({
        queryKey: queryKeys.metrics(ownerId, from, to),
        queryFn: () => getMetrics(from, to, ownerId ?? undefined),
        staleTime: 60_000,
        placeholderData: keepPreviousData,
    });
}

export function useNotesHistory(from: string, to: string) {
    return useQuery({ queryKey: queryKeys.notesHistory(from, to), queryFn: () => getNotesHistory(from, to), staleTime: 60_000, placeholderData: keepPreviousData });
}

export function useTaskMarks(ownerId: string | null, from: string, to: string): Map<string, DayMark> {
    const history = useHistory(ownerId, from, to);
    const marks = new Map<string, DayMark>();
    for (const day of history.data?.days ?? []) {
        if (day.total === 0) continue;
        marks.set(day.date, day.completed === day.total ? "full" : day.completed > 0 ? "partial" : "empty");
    }
    return marks;
}
