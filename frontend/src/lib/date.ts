/**
 * Local-calendar date helpers.
 *
 * Every date string in the app is `YYYY-MM-DD` interpreted in the user's local
 * timezone, never UTC. Parsing goes through local noon so that DST shifts and
 * negative UTC offsets cannot move a value onto the neighbouring calendar day.
 */

export function toDateString(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

/** Parse a `YYYY-MM-DD` string as a local Date anchored at noon. */
export function parseDateString(value: string): Date {
    return new Date(value + "T12:00:00");
}

/** Narrow unknown input (search params, form values) to a real calendar date. */
export function isValidDateString(value: unknown): value is string {
    if (typeof value !== "string") return false;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const d = parseDateString(value);
    if (Number.isNaN(d.getTime())) return false;
    return toDateString(d) === value;
}

export function todayDateString(): string {
    return toDateString(new Date());
}

/** Step a date string by whole days. Negative values step backwards. */
export function addDays(value: string, days: number): string {
    const d = parseDateString(value);
    d.setDate(d.getDate() + days);
    return toDateString(d);
}

/** "jueves, 26 de agosto de 2026" */
export function formatDayLong(value: string): string {
    return parseDateString(value).toLocaleDateString("es-MX", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
    });
}

/** "jue, 26 ago" — for narrow viewports where the long form wraps. */
export function formatDayShort(value: string): string {
    return parseDateString(value).toLocaleDateString("es-MX", {
        weekday: "short",
        day: "2-digit",
        month: "short",
    });
}
