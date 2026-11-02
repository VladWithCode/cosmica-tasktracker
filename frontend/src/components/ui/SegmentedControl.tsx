import { useId } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/cn";
import { spring } from "@/lib/motion";

type Option<T extends string> = { value: T; label: string };

type SegmentedControlProps<T extends string> = {
    value: T;
    options: Option<T>[];
    onChange: (value: T) => void;
    label: string;
    className?: string;
};

export function SegmentedControl<T extends string>({ value, options, onChange, label, className }: SegmentedControlProps<T>) {
    const layoutId = useId();
    const reduceMotion = useReducedMotion();
    return (
        <div role="radiogroup" aria-label={label} className={cn("flex h-9 rounded-control bg-fill-secondary p-0.5", className)}>
            {options.map((option) => {
                const selected = option.value === value;
                return (
                    <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => onChange(option.value)}
                        className="relative flex-1 rounded-[0.4rem] px-2 text-footnote font-medium"
                    >
                        {selected ? (
                            <motion.span
                                layoutId={layoutId}
                                transition={reduceMotion ? { duration: 0 } : spring.default}
                                className="absolute inset-0 rounded-[0.4rem] bg-bg-elevated shadow-[0_1px_3px_rgb(0_0_0/0.12)]"
                            />
                        ) : null}
                        <span className={cn("relative", selected ? "text-label font-semibold" : "text-label-secondary")}>{option.label}</span>
                    </button>
                );
            })}
        </div>
    );
}
