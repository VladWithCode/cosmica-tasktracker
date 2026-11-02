import type { RepeatFrequency } from "@/api/schemas";

export const weekdayOptions = [
    { value: 1, short: "L", label: "Lunes" },
    { value: 2, short: "M", label: "Martes" },
    { value: 3, short: "X", label: "Miércoles" },
    { value: 4, short: "J", label: "Jueves" },
    { value: 5, short: "V", label: "Viernes" },
    { value: 6, short: "S", label: "Sábado" },
    { value: 0, short: "D", label: "Domingo" },
] as const;

export const repeatOptions: { value: RepeatFrequency; label: string }[] = [
    { value: "daily", label: "Diario" },
    { value: "weekly", label: "Semanal" },
    { value: "biweekly", label: "Cada 2 semanas" },
    { value: "monthly", label: "Mensual" },
    { value: "bimonthly", label: "Cada 2 meses" },
    { value: "yearly", label: "Anual" },
];

export const intervalUnits: Partial<Record<RepeatFrequency, [string, string]>> = {
    daily: ["día", "días"],
    weekly: ["semana", "semanas"],
    monthly: ["mes", "meses"],
};
