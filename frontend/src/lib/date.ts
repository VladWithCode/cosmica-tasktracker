import { TZDate } from "@date-fns/tz";
import { addDays, format, isSameDay, startOfWeek } from "date-fns";
import { es } from "date-fns/locale/es";

export const APP_TIME_ZONE = "America/Mexico_City";

export function now(): TZDate {
    return new TZDate(Date.now(), APP_TIME_ZONE);
}

export function toISODate(date: Date): string {
    return format(new TZDate(date, APP_TIME_ZONE), "yyyy-MM-dd");
}

export function todayISO(): string {
    return toISODate(now());
}

export function fromISODate(value: string): TZDate {
    const [year, month, day] = value.split("-").map(Number);
    return new TZDate(year ?? 1970, (month ?? 1) - 1, day ?? 1, 12, 0, 0, APP_TIME_ZONE);
}

export function shiftISODate(value: string, days: number): string {
    return toISODate(addDays(fromISODate(value), days));
}

export function weekDays(value: string): string[] {
    const start = startOfWeek(fromISODate(value), { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, index) => toISODate(addDays(start, index)));
}

export function isToday(value: string): boolean {
    return isSameDay(fromISODate(value), now());
}

export function formatDay(value: string, pattern = "EEEE d 'de' MMMM"): string {
    const text = format(fromISODate(value), pattern, { locale: es });
    return text.charAt(0).toUpperCase() + text.slice(1);
}

export function formatClock(value: string): string {
    const [hours, minutes] = value.split(":").map(Number);
    const date = new TZDate(2000, 0, 1, hours ?? 0, minutes ?? 0, 0, APP_TIME_ZONE);
    return format(date, "h:mm a", { locale: es });
}

export function minutesOfDay(value: string): number {
    const [hours, minutes] = value.split(":").map(Number);
    return (hours ?? 0) * 60 + (minutes ?? 0);
}

export function monthGrid(value: string): string[][] {
    const date = fromISODate(value);
    const first = new TZDate(date.getFullYear(), date.getMonth(), 1, 12, 0, 0, APP_TIME_ZONE);
    const start = startOfWeek(first, { weekStartsOn: 1 });
    const weeks: string[][] = [];
    for (let week = 0; week < 6; week++) {
        const days = Array.from({ length: 7 }, (_, index) => toISODate(addDays(start, week * 7 + index)));
        if (week > 3 && !days.some((day) => day.slice(0, 7) === value.slice(0, 7))) break;
        weeks.push(days);
    }
    return weeks;
}

export function shiftMonth(value: string, months: number): string {
    const date = fromISODate(value);
    const target = new TZDate(date.getFullYear(), date.getMonth() + months, 1, 12, 0, 0, APP_TIME_ZONE);
    const lastDay = new TZDate(target.getFullYear(), target.getMonth() + 1, 0, 12, 0, 0, APP_TIME_ZONE).getDate();
    return toISODate(new TZDate(target.getFullYear(), target.getMonth(), Math.min(date.getDate(), lastDay), 12, 0, 0, APP_TIME_ZONE));
}

export function formatMonth(value: string): string {
    const text = format(fromISODate(value), "MMMM yyyy", { locale: es });
    return text.charAt(0).toUpperCase() + text.slice(1);
}
