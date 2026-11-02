import { describe, expect, it } from "vitest";
import { clampWithRubberband, lockDirection, nearest, project, rubberband, VelocityTracker } from "./gesture";

describe("project", () => {
    it("matches Apple's exponential-decay projection", () => {
        expect(project(1000)).toBeCloseTo(499, 0);
        expect(project(-500)).toBeCloseTo(-249.5, 1);
        expect(project(0)).toBe(0);
    });

    it("travels less with a lower deceleration rate", () => {
        expect(Math.abs(project(1000, 0.99))).toBeLessThan(Math.abs(project(1000)));
    });
});

describe("rubberband", () => {
    it("resists progressively and keeps direction", () => {
        const small = rubberband(20, 300);
        const large = rubberband(200, 300);
        expect(small).toBeGreaterThan(0);
        expect(small).toBeLessThan(20);
        expect(large / 200).toBeLessThan(small / 20);
        expect(rubberband(-50, 300)).toBeLessThan(0);
    });

    it("never exceeds the dimension times the constant", () => {
        expect(rubberband(1e6, 300)).toBeLessThan(300);
    });
});

describe("clampWithRubberband", () => {
    it("passes values inside bounds through", () => {
        expect(clampWithRubberband(50, 0, 100, 300)).toBe(50);
    });

    it("softens values outside bounds", () => {
        const over = clampWithRubberband(150, 0, 100, 300);
        expect(over).toBeGreaterThan(100);
        expect(over).toBeLessThan(150);
        const under = clampWithRubberband(-50, 0, 100, 300);
        expect(under).toBeLessThan(0);
        expect(under).toBeGreaterThan(-50);
    });
});

describe("nearest", () => {
    it("returns the closest snap point", () => {
        expect(nearest(130, [0, 100, 300])).toBe(100);
        expect(nearest(260, [0, 100, 300])).toBe(300);
    });
});

describe("lockDirection", () => {
    it("waits for the threshold and then picks the dominant axis", () => {
        expect(lockDirection(4, 3)).toBeNull();
        expect(lockDirection(12, 3)).toBe("x");
        expect(lockDirection(3, -14)).toBe("y");
    });
});

describe("VelocityTracker", () => {
    it("computes px per second over recent samples", () => {
        const tracker = new VelocityTracker();
        tracker.add(0, 0);
        tracker.add(10, 16);
        tracker.add(20, 32);
        expect(tracker.velocity()).toBeCloseTo(625, 0);
    });

    it("drops samples older than the window", () => {
        const tracker = new VelocityTracker(50);
        tracker.add(0, 0);
        tracker.add(100, 200);
        tracker.add(110, 216);
        tracker.add(120, 232);
        expect(tracker.velocity()).toBeCloseTo(625, 0);
    });
});
