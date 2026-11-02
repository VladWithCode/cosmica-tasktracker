import { describe, expect, it } from "vitest";
import { toOneOffBody, toTaskUpdateBody } from "./tasks";
import { toScheduleBody } from "./schedules";
import { clockFromWire, dateFromWire, dayTasksSchema, grantsResponseSchema, scheduleSchema, taskDetailSchema } from "./schemas";

describe("wire normalization", () => {
    it("reads clocks from HH:MM and RFC3339 values", () => {
        expect(clockFromWire("07:30")).toBe("07:30");
        expect(clockFromWire("0000-01-01T19:05:00Z")).toBe("19:05");
        expect(clockFromWire("")).toBeNull();
    });

    it("drops zero dates", () => {
        expect(dateFromWire("2026-11-02T00:00:00-06:00")).toBe("2026-11-02");
        expect(dateFromWire("0001-01-01T00:00:00Z")).toBeNull();
    });

    it("normalizes the day feed to camelCase", () => {
        const parsed = dayTasksSchema.parse({
            date: "2026-11-02",
            owner_user_id: "u1",
            tasks: [
                {
                    id: "t1",
                    title: "Agua",
                    schedule_id: "s1",
                    priority_level: "high",
                    status_level: "in_progress",
                    is_required: true,
                    schedule_start_time: "08:00",
                    target_count: 8,
                    current_count: 3,
                    created_at: "2026-11-02T08:00:00Z",
                },
            ],
        });
        expect(parsed.ownerUserId).toBe("u1");
        expect(parsed.tasks[0]).toMatchObject({
            scheduleId: "s1",
            priority: "urgent",
            status: "in_progress",
            isRequired: true,
            startTime: "08:00",
            endTime: null,
            targetCount: 8,
            currentCount: 3,
        });
    });

    it("tolerates a null task list", () => {
        expect(dayTasksSchema.parse({ tasks: null, date: "2026-11-02" }).tasks).toEqual([]);
    });

    it("normalizes task details and schedules", () => {
        const task = taskDetailSchema.parse({
            id: "t1",
            scheduleTaskId: "s1",
            status: "completed",
            priority: "low",
            required: true,
            startTime: "0000-01-01T07:00:00Z",
            duration: 30,
            currentCount: 0,
            canEdit: true,
        });
        expect(task).toMatchObject({ scheduleId: "s1", priority: "medium", isRequired: true, startTime: "07:00", durationMinutes: 30, canApplyToSchedule: false });

        const schedule = scheduleSchema.parse({ id: "s1", status: "paused", repeatFrequency: "weekly", repeatWeekdays: [1, 3], frequencyConfig: { waterReminder: true } });
        expect(schedule).toMatchObject({ status: "paused", repeatFrequency: "weekly", repeatWeekdays: [1, 3], frequencyConfig: { waterReminder: true } });
    });

    it("exposes grant permission flags", () => {
        const [grant] = grantsResponseSchema.parse({
            grants: [{ id: "g1", owner_user_id: "o1", access_level: "manage", can_view: true, can_create: true, can_edit_tasks: true, can_ping: true, owner_fullname: "Ana" }],
        });
        expect(grant).toMatchObject({ ownerUserId: "o1", accessLevel: "manage", canCreate: true, owner: { fullname: "Ana" } });
    });
});

describe("request bodies", () => {
    it("maps task updates to backend field names and drops undefined", () => {
        expect(toTaskUpdateBody({ status: "completed", currentCount: 0, applyToSchedule: true })).toEqual({
            status_level: "completed",
            current_count: 0,
            apply_to_schedule: true,
        });
    });

    it("sends one-off tasks as literal UTC wall-clock values", () => {
        const body = toOneOffBody({ title: "Cita", date: "2026-11-09", startTime: "23:30", priority: "medium", isRequired: false });
        expect(body).toMatchObject({
            startDate: "2026-11-09T00:00:00Z",
            startTime: "2026-11-09T23:30:00Z",
            frequency: "custom",
            frequencyConfig: { singleInstance: true },
            repeating: false,
        });
        expect(body).not.toHaveProperty("endTime");
    });

    it("builds routine bodies with snake_case clocks", () => {
        const body = toScheduleBody({
            title: "Correr",
            startDate: "2026-11-02",
            startTime: "07:00",
            repeatFrequency: "weekly",
            repeatWeekdays: [1, 3, 5],
            priority: "urgent",
            isRequired: true,
        });
        expect(body).toMatchObject({
            schedule_start_time: "07:00",
            schedule_end_time: null,
            repeatFrequency: "weekly",
            repeatWeekdays: [1, 3, 5],
            repeatInterval: 1,
            frequency: "weekly",
            priority_level: "urgent",
            is_required: true,
        });
    });
});
