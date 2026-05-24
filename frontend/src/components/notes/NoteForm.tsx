import { useState } from "react";
import { cn } from "@/lib/utils";

interface NoteFormProps {
    initialContent?: string;
    onSubmit: (content: string) => void;
    onCancel?: () => void;
    isSubmitting?: boolean;
    submitLabel?: string;
    errorMessage?: string | null;
}

export function NoteForm({
    initialContent = "",
    onSubmit,
    onCancel,
    isSubmitting = false,
    submitLabel = "Guardar",
    errorMessage,
}: NoteFormProps) {
    const [content, setContent] = useState(initialContent);
    const trimmed = content.trim();
    const canSubmit = trimmed.length > 0 && !isSubmitting;

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        if (!canSubmit) return;
        onSubmit(trimmed);
    };

    return (
        <form className="flex w-full flex-col gap-4" onSubmit={handleSubmit}>
            <label className="block font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                Contenido
            </label>
            <textarea
                aria-label="Contenido de la nota"
                autoFocus
                className={cn(
                    "min-h-[200px] w-full resize-y rounded-2xl border border-outline-variant/40 bg-surface-container px-4 py-3 text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none",
                )}
                onChange={(event) => setContent(event.target.value)}
                placeholder="Escribe tu nota..."
                value={content}
            />

            {errorMessage ? (
                <p className="text-sm text-error">{errorMessage}</p>
            ) : null}

            <div className="flex gap-3">
                {onCancel ? (
                    <button
                        className="flex-1 rounded-xl border border-outline-variant/40 px-4 py-3 font-label text-sm font-bold text-on-surface-variant transition-colors hover:bg-surface-container-highest"
                        disabled={isSubmitting}
                        onClick={onCancel}
                        type="button"
                    >
                        Cancelar
                    </button>
                ) : null}
                <button
                    className={cn(
                        "flex-1 rounded-xl bg-primary px-4 py-3 font-label text-sm font-bold text-on-primary transition-colors hover:bg-primary-dim",
                        !canSubmit && "opacity-60",
                    )}
                    disabled={!canSubmit}
                    type="submit"
                >
                    {isSubmitting ? "Guardando…" : submitLabel}
                </button>
            </div>
        </form>
    );
}
