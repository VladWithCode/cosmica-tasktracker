import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/cn";

export function BackButton({ label = "Atrás", className }: { label?: string; className?: string }) {
    return (
        <button
            type="button"
            onClick={() => window.history.back()}
            className={cn("-ml-1 flex min-h-11 items-center pr-2 text-body text-accent active:opacity-60", className)}
        >
            <ChevronLeft aria-hidden className="size-6" strokeWidth={2.2} />
            {label}
        </button>
    );
}
