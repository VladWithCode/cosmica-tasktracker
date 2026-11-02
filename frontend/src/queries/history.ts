import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getNotesHistory } from "@/api/notes";
import { getHistory, getMetrics } from "@/api/tasks";
import { queryKeys } from "./keys";

export type DayMark = "full" | "partial" | "empty";

export function useHistory(from: string, to: string, enabled = true) {
    return useQuery({ queryKey: queryKeys.history(from, to), queryFn: () => getHistory(from, to), enabled, staleTime: 60_000, placeholderData: keepPreviousData });
}

export function useMetrics(from: string, to: string) {
    return useQuery({ queryKey: queryKeys.metrics(from, to), queryFn: () => getMetrics(from, to), staleTime: 60_000, placeholderData: keepPreviousData });
}

export function useNotesHistory(from: string, to: string) {
    return useQuery({ queryKey: queryKeys.notesHistory(from, to), queryFn: () => getNotesHistory(from, to), staleTime: 60_000, placeholderData: keepPreviousData });
}

export function useTaskMarks(from: string, to: string, enabled = true): Map<string, DayMark> {
    const history = useHistory(from, to, enabled);
    const marks = new Map<string, DayMark>();
    for (const day of history.data?.days ?? []) {
        if (day.total === 0) continue;
        marks.set(day.date, day.completed === day.total ? "full" : day.completed > 0 ? "partial" : "empty");
    }
    return marks;
}
