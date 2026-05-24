import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { queryClient } from "@/queries/queryClient";
import { schedulesQueryKey } from "@/queries/schedules";
import { TasksQueryKeys } from "@/queries/tasks";
import { createSchedule } from "@/services/schedules";

interface QuickTaskDialogProps {
    open: boolean;
    onClose: () => void;
}

export function QuickTaskDialog({ open, onClose }: QuickTaskDialogProps) {
    const [title, setTitle] = useState("");
    const [startTime, setStartTime] = useState("");
    const [endTime, setEndTime] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    const timeError = useMemo(() => {
        if (startTime && endTime && endTime <= startTime) {
            return "La hora de fin debe ser posterior a la de inicio";
        }
        return null;
    }, [startTime, endTime]);

    const mutation = useMutation({
        mutationFn: () => {
            const today = new Date().toISOString().slice(0, 10);
            return createSchedule({
                title: title.trim(),
                schedule_start_time: startTime || null,
                schedule_end_time: endTime || null,
                priority_level: "medium",
                repeating: false,
                is_required: false,
                frequency: "daily",
                start_date: today,
                end_date: today,
            });
        },
        onSuccess: () => {
            toast.success("Tarea creada");
            void queryClient.invalidateQueries({ queryKey: TasksQueryKeys.today() });
            void queryClient.invalidateQueries({ queryKey: [...schedulesQueryKey] });
            setTitle("");
            setStartTime("");
            setEndTime("");
            onClose();
        },
        onError: (err: Error) => {
            toast.error(err.message || "Error al crear tarea");
        },
    });

    const canSubmit = title.trim().length > 0 && !timeError && !mutation.isPending;

    const handleSubmit = useCallback(
        (e: React.FormEvent) => {
            e.preventDefault();
            if (!canSubmit) return;
            mutation.mutate();
        },
        [canSubmit, mutation],
    );

    useEffect(() => {
        if (open) {
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
            <div
                aria-hidden
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={onClose}
            />
            <form
                className="relative z-10 mx-4 mb-6 w-full max-w-md rounded-2xl border border-outline-variant/30 bg-surface-container p-6 shadow-2xl sm:mb-0"
                onSubmit={handleSubmit}
            >
                <h3 className="mb-4 font-display text-lg font-bold text-on-surface">
                    Tarea rápida
                </h3>

                <label className="mb-1 block font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                    Título
                </label>
                <input
                    ref={inputRef}
                    autoComplete="off"
                    className="mb-4 w-full rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none"
                    maxLength={120}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="¿Qué necesitas hacer?"
                    required
                    value={title}
                />

                <div className="mb-1 flex gap-3">
                    <div className="flex-1">
                        <label className="mb-1 block font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                            Inicio
                        </label>
                        <input
                            className={cn(
                                "w-full rounded-lg border bg-surface px-3 py-2 text-on-surface focus:outline-none",
                                timeError
                                    ? "border-error focus:border-error"
                                    : "border-outline-variant/40 focus:border-primary",
                            )}
                            onChange={(e) => setStartTime(e.target.value)}
                            type="time"
                            value={startTime}
                        />
                    </div>
                    <div className="flex-1">
                        <label className="mb-1 block font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                            Fin
                        </label>
                        <input
                            className={cn(
                                "w-full rounded-lg border bg-surface px-3 py-2 text-on-surface focus:outline-none",
                                timeError
                                    ? "border-error focus:border-error"
                                    : "border-outline-variant/40 focus:border-primary",
                            )}
                            onChange={(e) => setEndTime(e.target.value)}
                            type="time"
                            value={endTime}
                        />
                    </div>
                </div>
                {timeError ? (
                    <p className="mb-4 text-xs text-error">{timeError}</p>
                ) : (
                    <div className="mb-4" />
                )}

                <div className="flex gap-3">
                    <button
                        className="flex-1 rounded-lg border border-outline-variant/40 px-4 py-2.5 font-label text-sm font-bold text-on-surface-variant transition-colors hover:bg-surface-container-highest"
                        onClick={onClose}
                        type="button"
                    >
                        Cancelar
                    </button>
                    <button
                        className={cn(
                            "flex-1 rounded-lg bg-primary px-4 py-2.5 font-label text-sm font-bold text-on-primary transition-colors hover:bg-primary-dim",
                            mutation.isPending && "opacity-60",
                        )}
                        disabled={!canSubmit}
                        type="submit"
                    >
                        {mutation.isPending ? "Creando…" : "Crear"}
                    </button>
                </div>
            </form>
        </div>
    );
}
