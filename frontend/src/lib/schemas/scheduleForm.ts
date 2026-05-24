import { z } from "zod";

const timePattern = /^\d{2}:\d{2}$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export const repeatPatternValues = [
    "daily",
    "weekly",
    "biweekly",
    "monthly",
    "bimonthly",
    "yearly",
    "custom",
] as const;
export type RepeatPattern = (typeof repeatPatternValues)[number];

export const customUnitValues = ["days", "weeks", "months", "years"] as const;
export type CustomRepeatUnit = (typeof customUnitValues)[number];

export const scheduleFormSchema = z
    .object({
        category: z.string().max(40, "Máximo 40 caracteres").optional(),
        custom_interval: z.coerce.number().int().min(1).max(365).optional(),
        custom_unit: z.enum(customUnitValues).default("days"),
        description: z.string().max(500, "Máximo 500 caracteres").optional(),
        duration_minutes: z.coerce.number().int().min(1).max(1440).optional(),
        end_date: z
            .string()
            .regex(datePattern, "Formato YYYY-MM-DD")
            .optional()
            .or(z.literal("")),
        is_required: z.boolean().default(false),
        priority_level: z.enum(["urgent", "medium"]),
        repeat_pattern: z.enum(repeatPatternValues).default("daily"),
        repeat_weekdays: z.array(z.number().int().min(0).max(6)).default([]),
        scheduleType: z.enum(["range", "duration", "counter"]),
        schedule_end_time: z.string().regex(timePattern, "Formato HH:MM").optional(),
        schedule_start_time: z.string().regex(timePattern, "Formato HH:MM").optional(),
        target_count: z.coerce.number().int().min(1).max(100).optional(),
        title: z.string().trim().min(1, "Requerido").max(120, "Máximo 120 caracteres"),
    })
    .superRefine((value, context) => {
        if (value.scheduleType === "range") {
            if (!value.schedule_start_time) {
                context.addIssue({
                    code: "custom",
                    message: "Requerido",
                    path: ["schedule_start_time"],
                });
            }
            if (!value.schedule_end_time) {
                context.addIssue({
                    code: "custom",
                    message: "Requerido",
                    path: ["schedule_end_time"],
                });
            }
            if (
                value.schedule_start_time &&
                value.schedule_end_time &&
                minutes(value.schedule_end_time) <= minutes(value.schedule_start_time)
            ) {
                context.addIssue({
                    code: "custom",
                    message: "La hora fin debe ser posterior",
                    path: ["schedule_end_time"],
                });
            }
        }
        if (value.scheduleType === "duration" && !value.duration_minutes) {
            context.addIssue({
                code: "custom",
                message: "Requerido",
                path: ["duration_minutes"],
            });
        }
        if (value.scheduleType === "counter" && !value.target_count) {
            context.addIssue({
                code: "custom",
                message: "Requerido",
                path: ["target_count"],
            });
        }
        if (value.repeat_pattern === "weekly" && value.repeat_weekdays.length === 0) {
            context.addIssue({
                code: "custom",
                message: "Selecciona al menos un día",
                path: ["repeat_weekdays"],
            });
        }
        if (value.repeat_pattern === "custom" && !value.custom_interval) {
            context.addIssue({
                code: "custom",
                message: "Requerido",
                path: ["custom_interval"],
            });
        }
    });

export type ScheduleFormValues = z.infer<typeof scheduleFormSchema>;
export type ScheduleFormInput = z.input<typeof scheduleFormSchema>;

function minutes(value: string) {
    const [hour, minute] = value.split(":").map(Number);
    return (hour ?? 0) * 60 + (minute ?? 0);
}
