import { motion } from "motion/react";
import { cn } from "@/lib/cn";
import { spring } from "@/lib/motion";

type SwitchProps = { checked: boolean; onChange: (checked: boolean) => void; label: string; disabled?: boolean };

export function Switch({ checked, onChange, label, disabled }: SwitchProps) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={label}
            disabled={disabled}
            onClick={() => onChange(!checked)}
            className={cn(
                "relative flex h-[1.9375rem] w-[3.1875rem] shrink-0 items-center rounded-full p-0.5 transition-colors disabled:opacity-40",
                checked ? "bg-success" : "bg-fill",
            )}
        >
            <motion.span
                layout
                transition={spring.snappy}
                className={cn("size-[1.6875rem] rounded-full bg-white shadow-[0_2px_6px_rgb(0_0_0/0.18)]", checked && "ml-auto")}
            />
        </button>
    );
}
