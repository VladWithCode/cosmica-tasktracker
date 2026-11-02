import { describe, expect, it } from "vitest";
import { formatClock, formatDay, fromISODate, minutesOfDay, shiftISODate, toISODate, weekDays } from "./date";

describe("date helpers", () => {
    it("round-trips ISO dates in the app time zone", () => {
        expect(toISODate(fromISODate("2026-11-02"))).toBe("2026-11-02");
    });

    it("maps an instant to the Mexico City calendar day", () => {
        expect(toISODate(new Date("2026-11-03T04:30:00Z"))).toBe("2026-11-02");
        expect(toISODate(new Date("2026-11-03T06:30:00Z"))).toBe("2026-11-03");
    });

    it("shifts across month boundaries", () => {
        expect(shiftISODate("2026-10-31", 1)).toBe("2026-11-01");
        expect(shiftISODate("2026-03-01", -1)).toBe("2026-02-28");
    });

    it("builds a Monday-first week", () => {
        const days = weekDays("2026-11-05");
        expect(days[0]).toBe("2026-11-02");
        expect(days[6]).toBe("2026-11-08");
    });

    it("formats in Spanish", () => {
        expect(formatDay("2026-11-02")).toBe("Lunes 2 de noviembre");
        expect(formatClock("07:05")).toMatch(/^7:05\s?a/i);
        expect(minutesOfDay("13:30")).toBe(810);
    });
});
