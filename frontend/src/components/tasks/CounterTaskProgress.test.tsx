import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { CounterTaskProgress, isCounterTask, isWaterCounter } from "./CounterTaskProgress";

afterEach(cleanup);

describe("isCounterTask", () => {
    it("treats positive target_count or targetCount as a counter task", () => {
        expect(isCounterTask({ target_count: 5 })).toBe(true);
        expect(isCounterTask({ targetCount: 8 })).toBe(true);
    });

    it("rejects null, zero or missing targets", () => {
        expect(isCounterTask({})).toBe(false);
        expect(isCounterTask({ target_count: 0 })).toBe(false);
        expect(isCounterTask({ target_count: null, targetCount: null })).toBe(false);
    });
});

describe("isWaterCounter", () => {
    it("matches Spanish and English hydration keywords across title/category/description", () => {
        expect(isWaterCounter({ title: "Tomar agua" })).toBe(true);
        expect(isWaterCounter({ title: "Drink Water" })).toBe(true);
        expect(isWaterCounter({ category: "hidratación" })).toBe(true);
        expect(isWaterCounter({ description: "Stay hydrated" })).toBe(true);
        expect(isWaterCounter({ title: "Bebe 8 vasos" })).toBe(true);
    });

    it("does not classify generic counters as water", () => {
        expect(isWaterCounter({ title: "Push-ups" })).toBe(false);
        expect(isWaterCounter({})).toBe(false);
        expect(isWaterCounter({ title: null, category: null, description: null })).toBe(false);
    });
});

describe("<CounterTaskProgress />", () => {
    it("renders nothing when targetCount is missing or non-positive", () => {
        const { container, rerender } = render(
            <CounterTaskProgress currentCount={0} targetCount={null} />,
        );
        expect(container.firstChild).toBeNull();

        rerender(<CounterTaskProgress currentCount={2} targetCount={0} />);
        expect(container.firstChild).toBeNull();
    });

    it("renders one icon slot per target up to the visual cap and marks completed/pending", () => {
        render(
            <CounterTaskProgress
                currentCount={3}
                targetCount={5}
                title="Hydration"
                category="hidratación"
                status="pending"
            />,
        );

        const region = screen.getByRole("group");
        expect(region.getAttribute("aria-label")).toBe(
            "Progreso del contador: 3 de 5 litros",
        );

        const items = within(region).getAllByRole("listitem");
        expect(items).toHaveLength(5);

        const completed = items.filter((node) =>
            (node.getAttribute("aria-label") ?? "").endsWith("completada"),
        );
        const pending = items.filter((node) =>
            (node.getAttribute("aria-label") ?? "").endsWith("pendiente"),
        );
        expect(completed).toHaveLength(3);
        expect(pending).toHaveLength(2);
    });

    it("compresses very large targets into a fixed visual ceiling", () => {
        render(
            <CounterTaskProgress
                currentCount={50}
                targetCount={100}
                title="Habit counter"
            />,
        );

        const region = screen.getByRole("group");
        const items = within(region).getAllByRole("listitem");
        // Visual ceiling is 16 slots regardless of how big targetCount is.
        expect(items).toHaveLength(16);

        // 50 of 100 → 50% → 8 of 16 slots filled.
        const completed = items.filter((node) =>
            (node.getAttribute("aria-label") ?? "").endsWith("completada"),
        );
        expect(completed).toHaveLength(8);

        // The component informs the user that it is showing a summary view.
        expect(screen.getByText(/Mostrando resumen visual de 100/i)).toBeTruthy();
    });

    it("clamps currentCount above targetCount and shows the completed badge", () => {
        render(
            <CounterTaskProgress currentCount={99} targetCount={4} title="Reps" />,
        );

        // Percentage badge clamps to 100 even when input exceeds target.
        expect(screen.getByText("100%")).toBeTruthy();

        // Header shows clamped count "/" target.
        expect(screen.getByText(/^4/)).toBeTruthy();
        expect(screen.getByText("/4")).toBeTruthy();
    });
});
