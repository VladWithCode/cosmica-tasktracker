import { describe, expect, it } from "vitest";
import { sortTasksForFeed } from "@/lib/taskSort";
import type { TaskFeedItem } from "@/types/task";

const baseTask: TaskFeedItem = {
    created_at: "2026-05-03T12:00:00Z",
    current_count: 0,
    id: "base",
    is_required: false,
    priority_level: "low",
    schedule_id: "schedule",
    status_level: "pending",
    title: "Base",
};

function task(overrides: Partial<TaskFeedItem>): TaskFeedItem {
    return { ...baseTask, ...overrides };
}

describe("sortTasksForFeed", () => {
    it("orders by priority, required flag, title, then created_at", () => {
        const sorted = sortTasksForFeed([
            task({ id: "low", priority_level: "low", title: "A" }),
            task({ id: "high-normal", priority_level: "high", title: "A" }),
            task({ id: "urgent-b", priority_level: "urgent", title: "B" }),
            task({ id: "urgent-a-new", priority_level: "urgent", title: "A", created_at: "2026-05-03T12:02:00Z" }),
            task({ id: "urgent-a-old", priority_level: "urgent", title: "A", created_at: "2026-05-03T12:01:00Z" }),
            task({ id: "urgent-required", is_required: true, priority_level: "urgent", title: "Z" }),
        ]);

        expect(sorted.map((item) => item.id)).toEqual([
            "urgent-required",
            "urgent-a-old",
            "urgent-a-new",
            "urgent-b",
            "high-normal",
            "low",
        ]);
    });
});
