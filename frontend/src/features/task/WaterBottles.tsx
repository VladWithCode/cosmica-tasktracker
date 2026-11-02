import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/cn";
import { haptic } from "@/lib/haptics";
import { spring } from "@/lib/motion";

type WaterBottlesProps = { value: number; target: number; unit: string; onChange: (value: number) => void; disabled?: boolean };

function Bottle({ filled }: { filled: boolean }) {
    return (
        <svg viewBox="0 0 24 32" aria-hidden className="h-8 w-6">
            <path
                d="M9 2h6v4l2.5 3.2A4 4 0 0 1 18.4 11.7V27a3 3 0 0 1-3 3H8.6a3 3 0 0 1-3-3V11.7a4 4 0 0 1 .9-2.5L9 6z"
                className={cn("stroke-[1.6]", filled ? "fill-accent stroke-accent" : "fill-transparent stroke-label-tertiary")}
                strokeLinejoin="round"
            />
            {filled ? <path d="M8.5 16h7" className="stroke-on-accent stroke-[1.6] opacity-60" strokeLinecap="round" /> : null}
        </svg>
    );
}

export function WaterBottles({ value, target, unit, onChange, disabled }: WaterBottlesProps) {
    const reduceMotion = useReducedMotion();
    return (
        <div role="group" aria-label={`Agua: ${value} de ${target} ${unit}`} className="flex flex-wrap gap-1" onClick={(event) => event.stopPropagation()}>
            {Array.from({ length: target }, (_, index) => {
                const filled = index < value;
                const next = filled && index === value - 1 ? index : index + 1;
                return (
                    <motion.button
                        key={index}
                        type="button"
                        disabled={disabled}
                        aria-label={`${index + 1} ${unit}${filled ? ", tomado" : ""}`}
                        aria-pressed={filled}
                        whileTap={{ scale: 0.85, transition: spring.snappy }}
                        animate={filled && !reduceMotion ? { scale: [1, 1.12, 1] } : { scale: 1 }}
                        transition={{ duration: 0.32, ease: [0.2, 0.9, 0.3, 1] }}
                        onClick={() => {
                            if (next >= target && value < target) haptic();
                            onChange(next);
                        }}
                        className="-m-1 flex size-10 items-center justify-center disabled:opacity-50"
                    >
                        <Bottle filled={filled} />
                    </motion.button>
                );
            })}
        </div>
    );
}
