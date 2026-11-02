export const DECELERATION_RATE = 0.998;
export const DIRECTION_LOCK_DISTANCE = 10;

export function project(velocity: number, decelerationRate = DECELERATION_RATE): number {
    return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
    if (dimension <= 0) return 0;
    const sign = Math.sign(overshoot);
    const distance = Math.abs(overshoot);
    return (sign * (distance * dimension * constant)) / (dimension + constant * distance);
}

export function clampWithRubberband(value: number, min: number, max: number, dimension: number): number {
    if (value < min) return min + rubberband(value - min, dimension);
    if (value > max) return max + rubberband(value - max, dimension);
    return value;
}

export function nearest(value: number, points: readonly number[]): number {
    let best = points[0] ?? value;
    for (const point of points) {
        if (Math.abs(point - value) < Math.abs(best - value)) best = point;
    }
    return best;
}

export type Axis = "x" | "y";

export function lockDirection(dx: number, dy: number, threshold = DIRECTION_LOCK_DISTANCE): Axis | null {
    if (Math.hypot(dx, dy) < threshold) return null;
    return Math.abs(dx) > Math.abs(dy) ? "x" : "y";
}

type Sample = { value: number; time: number };

export class VelocityTracker {
    private samples: Sample[] = [];

    constructor(private readonly windowMs = 100) {}

    add(value: number, time: number) {
        this.samples.push({ value, time });
        const cutoff = time - this.windowMs;
        while (this.samples.length > 2 && (this.samples[0]?.time ?? time) < cutoff) {
            this.samples.shift();
        }
    }

    velocity(): number {
        const first = this.samples[0];
        const last = this.samples[this.samples.length - 1];
        if (!first || !last || last.time === first.time) return 0;
        return ((last.value - first.value) / (last.time - first.time)) * 1000;
    }

    reset() {
        this.samples = [];
    }
}
