import { forwardRef } from "react";
import { cn } from "@/lib/cn";
import { Pressable, type PressableProps } from "./Pressable";
import { Spinner } from "./Spinner";

type Variant = "filled" | "tinted" | "plain" | "destructive";
type Size = "md" | "lg" | "sm";

const variants: Record<Variant, string> = {
    filled: "bg-accent text-on-accent",
    tinted: "bg-accent-soft text-accent",
    plain: "bg-transparent text-accent",
    destructive: "bg-danger-soft text-danger",
};

const sizes: Record<Size, string> = {
    sm: "h-9 px-3 text-footnote font-semibold rounded-full",
    md: "h-11 px-4 text-callout font-semibold rounded-control",
    lg: "h-[3.25rem] px-5 text-headline rounded-card w-full",
};

export type ButtonProps = PressableProps & { variant?: Variant; size?: Size; loading?: boolean };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
    { variant = "filled", size = "md", loading = false, disabled, className, children, ...props },
    ref,
) {
    return (
        <Pressable
            ref={ref}
            disabled={disabled || loading}
            aria-busy={loading || undefined}
            className={cn(
                "inline-flex items-center justify-center gap-2 select-none disabled:opacity-40",
                variants[variant],
                sizes[size],
                className,
            )}
            {...props}
        >
            {loading ? <Spinner className="size-5" /> : children}
        </Pressable>
    );
});
