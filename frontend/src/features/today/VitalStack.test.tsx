import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TaskItem } from "@/api/schemas";
import { VitalStack } from "./VitalStack";

vi.mock("@/api/tasks", () => ({ updateTask: vi.fn() }));

function task(id: string, title: string): TaskItem {
    return {
        id,
        title,
        description: "",
        scheduleId: "s",
        priority: "medium",
        status: "pending",
        isRequired: true,
        startTime: null,
        endTime: null,
        durationMinutes: null,
        targetCount: null,
        currentCount: 0,
        completedAt: null,
    };
}

function renderStack(tasks: TaskItem[]) {
    const onOpenTask = vi.fn();
    render(
        <QueryClientProvider client={new QueryClient()}>
            <VitalStack tasks={tasks} canEdit onOpenTask={onOpenTask} />
        </QueryClientProvider>,
    );
    return { onOpenTask };
}

afterEach(cleanup);

describe("VitalStack", () => {
    it("renders nothing without pending vital tasks", () => {
        renderStack([]);
        expect(screen.queryByRole("heading", { name: /Sí o sí/ })).toBeNull();
    });

    it("stacks several tasks and expands them on tap", () => {
        const { onOpenTask } = renderStack([task("a", "Vitaminas"), task("b", "Agua")]);
        expect(screen.getByRole("heading", { name: /2 imprescindibles/ })).toBeTruthy();
        expect(screen.queryByRole("button", { name: "Abrir «Agua»" })).toBeNull();

        fireEvent.click(screen.getByRole("button", { name: "Ver las 2 imprescindibles" }));
        fireEvent.click(screen.getByRole("button", { name: "Abrir «Agua»" }));
        expect(onOpenTask).toHaveBeenCalledWith("b");
        expect(screen.getByRole("button", { name: /Agrupar/ })).toBeTruthy();
    });

    it("opens a single task directly", () => {
        const { onOpenTask } = renderStack([task("a", "Vitaminas")]);
        fireEvent.click(screen.getByRole("button", { name: "Abrir «Vitaminas»" }));
        expect(onOpenTask).toHaveBeenCalledWith("a");
    });
});
