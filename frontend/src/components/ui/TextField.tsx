import { forwardRef, useId, useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/cn";

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
    label: string;
    error?: string;
    hint?: string;
};

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
    { label, error, hint, type = "text", className, id, ...props },
    ref,
) {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const messageId = `${inputId}-message`;
    const [revealed, setRevealed] = useState(false);
    const isPassword = type === "password";

    return (
        <div className={cn("flex flex-col gap-1.5", className)}>
            <label htmlFor={inputId} className="px-1 text-footnote font-medium text-label-secondary">
                {label}
            </label>
            <div className="relative">
                <input
                    ref={ref}
                    id={inputId}
                    type={isPassword && revealed ? "text" : type}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error || hint ? messageId : undefined}
                    className={cn(
                        "h-12 w-full rounded-control bg-bg-elevated px-4 text-body text-label placeholder:text-label-tertiary",
                        "outline-none ring-1 ring-separator transition-shadow focus:ring-2 focus:ring-accent",
                        error && "ring-2 ring-danger",
                        isPassword && "pr-12",
                    )}
                    {...props}
                />
                {isPassword ? (
                    <button
                        type="button"
                        onClick={() => setRevealed((value) => !value)}
                        aria-label={revealed ? "Ocultar contraseña" : "Mostrar contraseña"}
                        className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-label-secondary"
                    >
                        {revealed ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                    </button>
                ) : null}
            </div>
            {error || hint ? (
                <p id={messageId} className={cn("px-1 text-footnote", error ? "text-danger" : "text-label-secondary")}>
                    {error ?? hint}
                </p>
            ) : null}
        </div>
    );
});
