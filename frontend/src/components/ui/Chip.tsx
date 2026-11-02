import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type ChipProps = ButtonHTMLAttributes<HTMLButtonElement> & { selected: boolean };

export function Chip({ selected, className, type = "button", ...props }: ChipProps) {
    return (
        <button
            type={type}
            aria-pressed={selected}
            className={cn(
                "min-h-9 rounded-full px-3.5 text-footnote font-medium transition-colors active:scale-[0.97] motion-reduce:active:scale-100",
                selected ? "bg-accent text-on-accent" : "bg-fill-secondary text-label",
                className,
            )}
            {...props}
        />
    );
}
