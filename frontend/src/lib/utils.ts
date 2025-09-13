import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function numberToHour(n: number) {
    let hour = String(n % 12);
    if (n >= 12) {
        if (n === 12) {
            hour = "12";
        }
        hour += ":00 PM";
    } else {
        hour += ":00 AM";
    }
    return hour;
}

export function formatStartTime(date: Date) {
    return date.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}
