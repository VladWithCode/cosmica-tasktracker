import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const control = "w-full bg-transparent text-body text-label outline-none placeholder:text-label-tertiary";

export const InlineInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }>(
    function InlineInput({ label, error, className, id, ...props }, ref) {
        const generated = useId();
        const inputId = id ?? generated;
        return (
            <div className="px-4 py-2.5">
                <label htmlFor={inputId} className="sr-only">
                    {label}
                </label>
                <input ref={ref} id={inputId} aria-invalid={error ? true : undefined} placeholder={label} className={cn(control, "h-7", className)} {...props} />
                {error ? <p className="pt-1 text-footnote text-danger">{error}</p> : null}
            </div>
        );
    },
);

export const InlineTextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }>(
    function InlineTextArea({ label, className, id, rows = 3, ...props }, ref) {
        const generated = useId();
        const inputId = id ?? generated;
        return (
            <div className="px-4 py-2.5">
                <label htmlFor={inputId} className="sr-only">
                    {label}
                </label>
                <textarea ref={ref} id={inputId} rows={rows} placeholder={label} className={cn(control, "block resize-none leading-snug", className)} {...props} />
            </div>
        );
    },
);

export function FieldRow({ label, htmlFor, children, hint }: { label: string; htmlFor?: string; children: ReactNode; hint?: string }) {
    return (
        <div className="flex min-h-12 items-center gap-3 px-4 py-1.5">
            <label htmlFor={htmlFor} className="flex-1 text-body">
                {label}
                {hint ? <span className="block text-footnote text-label-secondary">{hint}</span> : null}
            </label>
            {children}
        </div>
    );
}

export const TrailingInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function TrailingInput({ className, ...props }, ref) {
    return (
        <input
            ref={ref}
            className={cn("tabular h-9 rounded-[0.5rem] bg-fill-secondary px-2.5 text-right text-body text-label outline-none focus:ring-2 focus:ring-accent", className)}
            {...props}
        />
    );
});
