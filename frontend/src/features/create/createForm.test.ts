import { describe, expect, it } from "vitest";
import { createSchema, defaultCreateValues, toOneOffInput, toScheduleInput, type CreateValues } from "./createForm";

function parse(overrides: Partial<CreateValues>) {
    return createSchema.safeParse({ ...defaultCreateValues("2026-11-02", 1), title: "Tarea", ...overrides });
}

describe("create form", () => {
    it("requires a title", () => {
        const result = parse({ title: "  " });
        expect(result.success).toBe(false);
    });

    it("requires a weekday for weekly routines", () => {
        const result = parse({ kind: "routine", repeat: "weekly", weekdays: [] });
        expect(result.success).toBe(false);
        expect(result.error?.issues[0]?.path).toEqual(["weekdays"]);
    });

    it("rejects an end time before the start", () => {
        const result = parse({ timeMode: "time", startTime: "10:00", endTime: "09:00" });
        expect(result.error?.issues[0]?.path).toEqual(["endTime"]);
    });

    it("maps a timed one-off task", () => {
        const result = parse({ timeMode: "time", startTime: "16:00", urgent: true });
        expect(result.success && toOneOffInput(result.data)).toEqual({
            title: "Tarea",
            description: undefined,
            date: "2026-11-02",
            startTime: "16:00",
            endTime: undefined,
            durationMinutes: undefined,
            targetCount: undefined,
            priority: "urgent",
            isRequired: false,
            category: undefined,
            ownerUserId: undefined,
        });
    });

    it("maps a one-off task for another owner", () => {
        const result = parse({ ownerId: "owner-1" });
        expect(result.success && toOneOffInput(result.data)).toMatchObject({ date: "2026-11-02", ownerUserId: "owner-1" });
    });

    it("maps a weekly water routine for another owner", () => {
        const result = parse({
            kind: "routine",
            repeat: "weekly",
            weekdays: [5, 1, 3],
            interval: 2,
            goal: "water",
            targetCount: "3",
            waterReminder: true,
            ownerId: "owner-1",
        });
        expect(result.success && toScheduleInput(result.data)).toMatchObject({
            startDate: "2026-11-02",
            repeatFrequency: "weekly",
            repeatWeekdays: [1, 3, 5],
            repeatInterval: 2,
            targetCount: 3,
            frequencyConfig: { waterUnit: "L", waterReminder: true },
            ownerUserId: "owner-1",
        });
    });

    it("ignores weekdays and interval for yearly routines", () => {
        const result = parse({ kind: "routine", repeat: "yearly", interval: 5, durationMinutes: "30", timeMode: "duration" });
        expect(result.success && toScheduleInput(result.data)).toMatchObject({ repeatWeekdays: [], repeatInterval: 1, durationMinutes: 30 });
    });
});
