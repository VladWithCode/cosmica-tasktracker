import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/cn";
import { spring } from "@/lib/motion";

type ProgressRingProps = { value: number; size?: number; stroke?: number; className?: string; label: string };

export function ProgressRing({ value, size = 72, stroke = 9, className, label }: ProgressRingProps) {
    const reduceMotion = useReducedMotion();
    const clamped = Math.min(1, Math.max(0, value));
    const radius = (size - stroke) / 2;
    const complete = clamped >= 1;
    return (
        <svg
            role="img"
            aria-label={label}
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            className={cn("shrink-0 -rotate-90", className)}
        >
            <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} className="stroke-fill" />
            <motion.circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                strokeWidth={stroke}
                strokeLinecap="round"
                className={complete ? "stroke-success" : "stroke-accent"}
                initial={false}
                animate={{ pathLength: clamped, opacity: clamped > 0 ? 1 : 0 }}
                transition={reduceMotion ? { duration: 0 } : spring.default}
            />
        </svg>
    );
}
