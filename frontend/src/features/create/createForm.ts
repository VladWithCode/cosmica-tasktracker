export { intervalUnits, repeatOptions, weekdayOptions } from "@/lib/repeat";
import { z } from "zod";
import type { ScheduleInput } from "@/api/schedules";
import type { OneOffTaskInput } from "@/api/tasks";
import { intervalUnits } from "@/lib/repeat";

const positiveInt = (message: string) => z.coerce.number({ error: message }).int(message).min(1, message).max(999, message);

export const createSchema = z
    .object({
        kind: z.enum(["once", "routine"]),
        title: z.string().trim().min(1, "Escribe un título").max(120, "Usa máximo 120 caracteres"),
        description: z.string().max(500),
        date: z.string().min(1, "Elige una fecha"),
        hasEndDate: z.boolean(),
        endDate: z.string(),
        timeMode: z.enum(["anytime", "time", "duration"]),
        startTime: z.string(),
        endTime: z.string(),
        durationMinutes: z.string(),
        repeat: z.enum(["daily", "weekly", "biweekly", "monthly", "bimonthly", "yearly"]),
        weekdays: z.array(z.number()),
        interval: positiveInt("Usa un número entre 1 y 999"),
        goal: z.enum(["none", "count", "water"]),
        targetCount: z.string(),
        waterReminder: z.boolean(),
        urgent: z.boolean(),
        isRequired: z.boolean(),
        category: z.string().max(60),
        ownerId: z.string(),
    })
    .superRefine((values, ctx) => {
        if (values.timeMode === "time") {
            if (!values.startTime) ctx.addIssue({ code: "custom", path: ["startTime"], message: "Elige la hora de inicio" });
            if (values.startTime && values.endTime && values.endTime <= values.startTime) {
                ctx.addIssue({ code: "custom", path: ["endTime"], message: "Debe terminar después de empezar" });
            }
        }
        if (values.timeMode === "duration") {
            const minutes = Number(values.durationMinutes);
            if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) {
                ctx.addIssue({ code: "custom", path: ["durationMinutes"], message: "Usa entre 1 y 1440 minutos" });
            }
        }
        if (values.goal !== "none") {
            const count = Number(values.targetCount);
            if (!Number.isInteger(count) || count < 1 || count > 99) {
                ctx.addIssue({ code: "custom", path: ["targetCount"], message: "Usa un número entre 1 y 99" });
            }
        }
        if (values.kind === "routine") {
            if ((values.repeat === "weekly" || values.repeat === "biweekly") && values.weekdays.length === 0) {
                ctx.addIssue({ code: "custom", path: ["weekdays"], message: "Elige al menos un día" });
            }
            if (values.hasEndDate && (!values.endDate || values.endDate < values.date)) {
                ctx.addIssue({ code: "custom", path: ["endDate"], message: "Debe ser igual o posterior al inicio" });
            }
        }
    });

export type CreateValues = z.input<typeof createSchema>;
export type CreateParsed = z.output<typeof createSchema>;

export function defaultCreateValues(date: string, weekday: number): CreateValues {
    return {
        kind: "once",
        title: "",
        description: "",
        date,
        hasEndDate: false,
        endDate: "",
        timeMode: "anytime",
        startTime: "",
        endTime: "",
        durationMinutes: "",
        repeat: "daily",
        weekdays: [weekday],
        interval: 1,
        goal: "none",
        targetCount: "",
        waterReminder: false,
        urgent: false,
        isRequired: false,
        category: "",
        ownerId: "",
    };
}

function common(values: CreateParsed) {
    const timed = values.timeMode === "time";
    const durationMinutes = values.timeMode === "duration" ? Number(values.durationMinutes) : undefined;
    return {
        title: values.title,
        description: values.description.trim() || undefined,
        startTime: timed ? values.startTime : undefined,
        endTime: timed && values.endTime ? values.endTime : undefined,
        durationMinutes,
        targetCount: values.goal === "none" ? undefined : Number(values.targetCount),
        priority: values.urgent ? ("urgent" as const) : ("medium" as const),
        isRequired: values.isRequired,
        category: values.category.trim() || undefined,
    };
}

export function toOneOffInput(values: CreateParsed): OneOffTaskInput {
    return { ...common(values), date: values.date };
}

export function toScheduleInput(values: CreateParsed): ScheduleInput {
    const weekly = values.repeat === "weekly" || values.repeat === "biweekly";
    const usesInterval = values.repeat in intervalUnits;
    return {
        ...common(values),
        startDate: values.date,
        endDate: values.hasEndDate ? values.endDate : undefined,
        repeatFrequency: values.repeat,
        repeatWeekdays: weekly ? [...values.weekdays].sort((a, b) => a - b) : [],
        repeatInterval: usesInterval ? values.interval : 1,
        frequencyConfig: values.goal === "water" ? { waterUnit: "L", waterReminder: values.waterReminder } : {},
        ownerUserId: values.ownerId || undefined,
    };
}
