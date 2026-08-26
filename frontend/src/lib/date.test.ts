import { describe, expect, it } from "vitest";
import {
    addDays,
    isValidDateString,
    parseDateString,
    toDateString,
    todayDateString,
} from "./date";

describe("toDateString", () => {
    it("pads month and day", () => {
        expect(toDateString(new Date(2026, 0, 5))).toBe("2026-01-05");
    });

    it("uses local calendar fields, not UTC", () => {
        // 23:30 local on the 26th stays the 26th even when UTC has rolled over.
        expect(toDateString(new Date(2026, 7, 26, 23, 30))).toBe("2026-08-26");
    });

    it("round-trips through parseDateString", () => {
        expect(toDateString(parseDateString("2026-02-29"))).toBe("2026-03-01");
        expect(toDateString(parseDateString("2026-08-26"))).toBe("2026-08-26");
    });
});

describe("isValidDateString", () => {
    it("accepts a real calendar date", () => {
        expect(isValidDateString("2026-08-26")).toBe(true);
        expect(isValidDateString("2024-02-29")).toBe(true);
    });

    it("rejects non-strings", () => {
        expect(isValidDateString(undefined)).toBe(false);
        expect(isValidDateString(20260826)).toBe(false);
    });

    it("rejects malformed input", () => {
        expect(isValidDateString("2026-8-26")).toBe(false);
        expect(isValidDateString("26-08-2026")).toBe(false);
        expect(isValidDateString("")).toBe(false);
    });

    it("rejects dates that do not exist", () => {
        expect(isValidDateString("2026-02-30")).toBe(false);
        expect(isValidDateString("2026-13-01")).toBe(false);
        expect(isValidDateString("2026-00-10")).toBe(false);
    });
});

describe("addDays", () => {
    it("steps forward and backward", () => {
        expect(addDays("2026-08-26", 1)).toBe("2026-08-27");
        expect(addDays("2026-08-26", -1)).toBe("2026-08-25");
    });

    it("crosses month boundaries", () => {
        expect(addDays("2026-08-31", 1)).toBe("2026-09-01");
        expect(addDays("2026-09-01", -1)).toBe("2026-08-31");
    });

    it("crosses year boundaries", () => {
        expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
        expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
    });

    it("handles leap days", () => {
        expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
        expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    });
});

describe("todayDateString", () => {
    it("matches toDateString of now", () => {
        expect(todayDateString()).toBe(toDateString(new Date()));
    });
});
