import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TaskItem } from "@/api/schemas";
import { TaskRow } from "./TaskRow";

const updateTask = vi.fn();

vi.mock("@/api/tasks", () => ({
    updateTask: (...args: unknown[]) => updateTask(...args),
}));

function task(partial: Partial<TaskItem> = {}): TaskItem {
    return {
        id: "t1",
        title: "Correr",
        description: "",
        scheduleId: "s1",
        priority: "medium",
        status: "pending",
        isRequired: false,
        startTime: "18:30",
        endTime: null,
        durationMinutes: 40,
        targetCount: null,
        currentCount: 0,
        completedAt: null,
        ...partial,
    };
}

function renderRow(item: TaskItem, canEdit = true) {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const onOpen = vi.fn();
    render(
        <QueryClientProvider client={client}>
            <TaskRow task={item} canEdit={canEdit} onOpen={onOpen} />
        </QueryClientProvider>,
    );
    return { onOpen };
}

beforeEach(() => {
    updateTask.mockReset();
    updateTask.mockImplementation(async (id: string) => ({ id, status: "completed" }));
});

afterEach(cleanup);

describe("TaskRow", () => {
    it("completes a pending task from the check button", async () => {
        renderRow(task());
        fireEvent.click(screen.getByRole("button", { name: "Completar «Correr»" }));
        await waitFor(() => expect(updateTask).toHaveBeenCalledWith("t1", { status: "completed" }));
    });

    it("reopens a completed task", async () => {
        renderRow(task({ status: "completed" }));
        fireEvent.click(screen.getByRole("button", { name: "Marcar «Correr» como pendiente" }));
        await waitFor(() => expect(updateTask).toHaveBeenCalledWith("t1", { status: "pending" }));
    });

    it("completes a counter task when the count reaches its target", async () => {
        renderRow(task({ targetCount: 3, currentCount: 2 }));
        const plus = screen.getByRole("button", { name: "Sumar uno a «Correr»" });
        fireEvent.click(plus, { detail: 0 });
        await waitFor(() => expect(updateTask).toHaveBeenCalledWith("t1", { currentCount: 3, status: "completed" }));
    });

    it("opens the task when the row is activated", () => {
        const { onOpen } = renderRow(task());
        fireEvent.click(screen.getByRole("button", { name: /^Correr, Pendiente/ }));
        expect(onOpen).toHaveBeenCalledWith("t1");
    });

    it("hides edit affordances without permission", () => {
        renderRow(task(), false);
        expect((screen.getByRole("button", { name: "Completar «Correr»" }) as HTMLButtonElement).disabled).toBe(true);
    });
});
