import { afterEach, describe, expect, it } from "vitest";
import type { ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DayProgress } from "./DayProgress";
import { TasksQueryKeys, type DayProgress as DayProgressData } from "@/queries/tasks";

afterEach(cleanup);

function withQueryClient(client: QueryClient) {
    return function Wrapper({ children }: { children: ReactNode }) {
        return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    };
}

function makeClient(progress: DayProgressData | null) {
    const client = new QueryClient({
        defaultOptions: {
            queries: { retry: false, gcTime: 0, staleTime: Infinity },
        },
    });
    if (progress) {
        client.setQueryData(TasksQueryKeys.progressByDate("today"), progress);
    }
    return client;
}

describe("<DayProgress />", () => {
    it("shows the empty state when total is 0", () => {
        const client = makeClient({
            date: "2026-05-05",
            total: 0,
            completed: 0,
            pending: 0,
            skipped: 0,
            failed: 0,
            in_progress: 0,
            percentage: 0,
        });

        render(<DayProgress />, { wrapper: withQueryClient(client) });

        expect(screen.getByText(/Sin tareas para hoy/i)).toBeTruthy();
    });

    it("shows X/Y completed and percentage when data is present", () => {
        const client = makeClient({
            date: "2026-05-05",
            total: 8,
            completed: 3,
            pending: 5,
            skipped: 0,
            failed: 0,
            in_progress: 0,
            percentage: 37.5,
        });

        render(<DayProgress />, { wrapper: withQueryClient(client) });

        // Header shows the numerator/denominator and the literal "completadas".
        expect(screen.getByText("3")).toBeTruthy();
        expect(screen.getByText("/8")).toBeTruthy();
        expect(screen.getByText(/completadas/i)).toBeTruthy();
        // Percentage badge.
        expect(screen.getByText("37.5%")).toBeTruthy();
        // Secondary breakdown for pending tasks.
        expect(screen.getByText(/5 pendientes/i)).toBeTruthy();

        // The progress section exposes an accessible role with the percentage.
        const bar = screen.getByRole("progressbar");
        expect(bar.getAttribute("aria-valuenow")).toBe("37.5");
        expect(bar.getAttribute("aria-valuemin")).toBe("0");
        expect(bar.getAttribute("aria-valuemax")).toBe("100");
    });

    it("renders the all-done style when completed equals total", () => {
        const client = makeClient({
            date: "2026-05-05",
            total: 4,
            completed: 4,
            pending: 0,
            skipped: 0,
            failed: 0,
            in_progress: 0,
            percentage: 100,
        });

        render(<DayProgress />, { wrapper: withQueryClient(client) });

        expect(screen.getByText("100%")).toBeTruthy();
        expect(screen.getByText("4")).toBeTruthy();
        expect(screen.getByText("/4")).toBeTruthy();
    });
});
