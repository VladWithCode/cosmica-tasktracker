import { describe, expect, it } from "vitest";
import { scheduleSchema } from "@/api/schemas";
import { createSchema, toScheduleInput } from "@/features/create/createForm";
import { goalSummary, isOneOffSchedule, repeatSummary, scheduleToValues } from "./schedules";

const base = { id: "s1", title: "Yoga", status: "active", startDate: "2026-11-02T00:00:00-06:00" };

describe("schedule helpers", () => {
    it("summarizes weekly routines with weekdays and time", () => {
        const schedule = scheduleSchema.parse({ ...base, repeatFrequency: "weekly", repeatWeekdays: [1, 3, 5], repeatInterval: 1, startTime: "2026-11-02T06:30:00-06:00" });
        expect(repeatSummary(schedule)).toMatch(/^L X V · 6:30/);
    });

    it("summarizes intervals and goals", () => {
        const schedule = scheduleSchema.parse({ ...base, repeatFrequency: "daily", repeatInterval: 3, targetCount: 2, frequencyConfig: { waterUnit: "L" } });
        expect(repeatSummary(schedule)).toBe("Cada 3 días");
        expect(goalSummary(schedule)).toBe("2 L");
    });

    it("detects one-off schedules", () => {
        expect(isOneOffSchedule(scheduleSchema.parse({ ...base, frequency: "custom", frequencyConfig: { singleInstance: true } }))).toBe(true);
        expect(isOneOffSchedule(scheduleSchema.parse({ ...base, frequency: "daily" }))).toBe(false);
    });

    it("round-trips a schedule through the form", () => {
        const schedule = scheduleSchema.parse({
            ...base,
            repeatFrequency: "weekly",
            repeatWeekdays: [1, 3],
            repeatInterval: 2,
            startTime: "07:00",
            endTime: "07:30",
            targetCount: 3,
            frequencyConfig: { waterUnit: "L", waterReminder: true },
            priority: "urgent",
            isRequired: true,
        });
        const parsed = createSchema.parse(scheduleToValues(schedule));
        expect(toScheduleInput(parsed)).toMatchObject({
            startDate: "2026-11-02",
            startTime: "07:00",
            endTime: "07:30",
            repeatFrequency: "weekly",
            repeatWeekdays: [1, 3],
            repeatInterval: 2,
            targetCount: 3,
            frequencyConfig: { waterUnit: "L", waterReminder: true },
            priority: "urgent",
            isRequired: true,
        });
    });
});
