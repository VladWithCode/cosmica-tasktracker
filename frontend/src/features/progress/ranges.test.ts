import { describe, expect, it } from "vitest";
import { heatStep, highDismissal, rangeFor } from "./ranges";

describe("progress ranges", () => {
    it("ends every range today", () => {
        expect(rangeFor("week", "2026-11-04")).toEqual({ from: "2026-10-29", to: "2026-11-04" });
        expect(rangeFor("month", "2026-11-04")).toEqual({ from: "2026-10-06", to: "2026-11-04" });
    });

    it("starts the quarter on a Monday 12 weeks back", () => {
        expect(rangeFor("quarter", "2026-11-04")).toEqual({ from: "2026-08-10", to: "2026-11-04" });
    });

    it("bins completion into monotonic heat steps", () => {
        expect([heatStep(0, 0), heatStep(0, 3), heatStep(20, 5), heatStep(50, 4), heatStep(80, 5), heatStep(100, 2)]).toEqual([0, 1, 2, 3, 4, 5]);
    });

    it("warns about dismissals only past both the rate and the minimum count", () => {
        expect(highDismissal({ dismissed: 2, dismissalRate: 100 })).toBe(false);
        expect(highDismissal({ dismissed: 3, dismissalRate: 19.9 })).toBe(false);
        expect(highDismissal({ dismissed: 3, dismissalRate: 20 })).toBe(true);
    });
});
