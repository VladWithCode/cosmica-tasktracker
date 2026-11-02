import { describe, expect, it } from "vitest";
import type { TaskItem } from "@/api/schemas";
import { groupTasks, scheduleLabel, statusForCount, summarize } from "./tasks";

function task(partial: Partial<TaskItem> & { id: string }): TaskItem {
    return {
        title: partial.id,
        description: "",
        scheduleId: "s",
        priority: "medium",
        status: "pending",
        isRequired: false,
        startTime: null,
        endTime: null,
        durationMinutes: null,
        targetCount: null,
        currentCount: 0,
        completedAt: null,
        ...partial,
    };
}

describe("groupTasks", () => {
    it("puts required first, then time-of-day sections, then anytime", () => {
        const { sections, done } = groupTasks([
            task({ id: "anytime" }),
            task({ id: "night", startTime: "21:00" }),
            task({ id: "req", isRequired: true, startTime: "22:00" }),
            task({ id: "morning", startTime: "07:00" }),
            task({ id: "afternoon", startTime: "12:00" }),
            task({ id: "done", status: "completed", startTime: "06:00" }),
            task({ id: "skipped", status: "skipped" }),
        ]);
        expect(sections.map((section) => section.id)).toEqual(["required", "morning", "afternoon", "evening", "anytime"]);
        expect(done.map((item) => item.id)).toEqual(["done", "skipped"]);
    });

    it("sorts by start time, then urgency, then title", () => {
        const { sections } = groupTasks([
            task({ id: "b", startTime: "08:00" }),
            task({ id: "a", startTime: "08:00", priority: "urgent" }),
            task({ id: "c", startTime: "07:30" }),
        ]);
        expect(sections[0]?.tasks.map((item) => item.id)).toEqual(["c", "a", "b"]);
    });
});

describe("summarize", () => {
    it("counts completed only, like the backend percentage", () => {
        const summary = summarize([
            task({ id: "1", status: "completed", isRequired: true }),
            task({ id: "2", status: "skipped" }),
            task({ id: "3", isRequired: true }),
        ]);
        expect(summary).toEqual({ total: 3, completed: 1, percentage: 33.3, required: 2, requiredCompleted: 1 });
    });
});

describe("statusForCount", () => {
    it("completes at target and reopens below it", () => {
        expect(statusForCount(3, 3, "pending")).toBe("completed");
        expect(statusForCount(2, 3, "completed")).toBe("in_progress");
        expect(statusForCount(0, 3, "completed")).toBe("pending");
        expect(statusForCount(1, 3, "pending")).toBe("pending");
        expect(statusForCount(1, null, "pending")).toBe("pending");
    });
});

describe("scheduleLabel", () => {
    it("describes time window and duration", () => {
        expect(scheduleLabel({ startTime: null, endTime: null, durationMinutes: null })).toBe("Cualquier hora");
        expect(scheduleLabel({ startTime: null, endTime: null, durationMinutes: 90 })).toBe("1 h 30 min");
        expect(scheduleLabel({ startTime: "07:00", endTime: null, durationMinutes: 40 })).toMatch(/^7:00.* · 40 min$/);
    });
});
