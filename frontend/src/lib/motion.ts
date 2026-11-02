import type { Transition } from "motion/react";

export const spring = {
    default: { type: "spring", visualDuration: 0.35, bounce: 0 },
    snappy: { type: "spring", visualDuration: 0.2, bounce: 0 },
    sheet: { type: "spring", visualDuration: 0.3, bounce: 0.15 },
    momentum: { type: "spring", visualDuration: 0.35, bounce: 0.2 },
} as const satisfies Record<string, Transition>;

export const fade: Transition = { duration: 0.15, ease: "easeOut" };

export function withVelocity(transition: Transition, velocity: number): Transition {
    return { ...transition, velocity };
}
