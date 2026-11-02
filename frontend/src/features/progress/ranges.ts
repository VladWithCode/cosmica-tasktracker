import { shiftISODate, todayISO, weekDays } from "@/lib/date";

export type RangeId = "week" | "month" | "quarter";

export const rangeOptions: { value: RangeId; label: string }[] = [
    { value: "week", label: "7 días" },
    { value: "month", label: "30 días" },
    { value: "quarter", label: "3 meses" },
];

export function rangeFor(id: RangeId, today = todayISO()): { from: string; to: string } {
    if (id === "week") return { from: shiftISODate(today, -6), to: today };
    if (id === "month") return { from: shiftISODate(today, -29), to: today };
    const monday = weekDays(today)[0] ?? today;
    return { from: shiftISODate(monday, -12 * 7), to: today };
}

export function heatStep(percentage: number, total: number): number {
    if (total === 0) return 0;
    if (percentage <= 0) return 1;
    if (percentage < 34) return 2;
    if (percentage < 67) return 3;
    if (percentage < 100) return 4;
    return 5;
}
