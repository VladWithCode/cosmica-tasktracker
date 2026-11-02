import { Minus, Plus } from "lucide-react";
import { usePressRepeat } from "@/hooks/usePressRepeat";
import { cn } from "@/lib/cn";

type CounterControlProps = {
    value: number;
    target: number;
    onChange: (value: number) => void;
    disabled?: boolean;
    size?: "sm" | "lg";
    title: string;
};

export function CounterControl({ value, target, onChange, disabled, size = "sm", title }: CounterControlProps) {
    const decrement = usePressRepeat(() => {
        if (value > 0) onChange(value - 1);
    }, !disabled && value > 0);
    const increment = usePressRepeat(() => onChange(value + 1), !disabled);
    const large = size === "lg";
    const button = cn(
        "flex shrink-0 items-center justify-center rounded-full bg-fill-secondary text-accent active:bg-fill disabled:opacity-30",
        large ? "size-14" : "size-9",
    );

    return (
        <div className={cn("flex items-center", large ? "gap-6" : "gap-1.5")} onClick={(event) => event.stopPropagation()}>
            <button type="button" aria-label={`Restar uno a «${title}»`} disabled={disabled || value <= 0} className={button} {...decrement}>
                <Minus aria-hidden className={large ? "size-6" : "size-4"} strokeWidth={2.5} />
            </button>
            <span aria-live="polite" className={cn("tabular text-center font-semibold", large ? "min-w-24 text-title-1" : "min-w-10 text-callout")}>
                {value}
                <span className="font-normal text-label-secondary">/{target}</span>
            </span>
            <button type="button" aria-label={`Sumar uno a «${title}»`} disabled={disabled} className={button} {...increment}>
                <Plus aria-hidden className={large ? "size-6" : "size-4"} strokeWidth={2.5} />
            </button>
        </div>
    );
}
