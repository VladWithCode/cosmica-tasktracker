import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useForm } from "react-hook-form";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { useCreateSchedule } from "@/hooks/useCreateSchedule";
import {
    scheduleFormSchema,
    type ScheduleFormInput,
    type ScheduleFormValues,
} from "@/lib/schemas/scheduleForm";
import { cn } from "@/lib/utils";
import type { Priority, ScheduleFrequency } from "@/types/schedule";

const priorityOptions: Array<{ label: string; value: Priority; className: string }> = [
    { label: "Urgent", value: "urgent", className: "border-error/35 text-error" },
    { label: "High", value: "high", className: "border-primary/35 text-primary" },
    { label: "Medium", value: "medium", className: "border-tertiary/35 text-tertiary" },
    { label: "Low", value: "low", className: "border-outline-variant/30 text-on-surface-variant" },
];

const frequencyLabels: Record<ScheduleFrequency, string> = {
    custom: "Intervalo personalizado",
    daily: "Cada día",
    monthly: "Cada mes",
    weekly: "Cada semana",
};

export function TaskNewPage() {
    const createScheduleMutation = useCreateSchedule();
    const {
        formState: { errors },
        handleSubmit,
        register,
        setValue,
        watch,
    } = useForm<ScheduleFormInput, unknown, ScheduleFormValues>({
        defaultValues: {
            category: "",
            description: "",
            frequency: "daily",
            is_required: false,
            priority_level: "high",
            scheduleType: "range",
            schedule_end_time: "10:00",
            schedule_start_time: "09:00",
            title: "",
        },
        resolver: zodResolver(scheduleFormSchema),
    });
    const values = watch();

    const submit = (data: ScheduleFormValues) => {
        createScheduleMutation.mutate({
            category: data.category?.trim() || undefined,
            description: data.description?.trim() || undefined,
            duration_minutes: data.scheduleType === "duration" ? data.duration_minutes : null,
            frequency: data.frequency,
            frequency_config: { scheduleType: data.scheduleType },
            is_required: data.is_required,
            priority_level: data.priority_level,
            schedule_end_time: data.scheduleType === "range" ? data.schedule_end_time : null,
            schedule_start_time: data.scheduleType === "range" ? data.schedule_start_time : null,
            target_count: data.scheduleType === "counter" ? data.target_count : null,
            title: data.title.trim(),
        });
    };

    return (
        <main className="relative mx-auto min-h-full max-w-xl px-6 pb-36 pt-8">
            <div className="pointer-events-none absolute left-1/2 top-16 h-80 w-80 -translate-x-1/2 rounded-full bg-primary/5 blur-[120px]" />
            <form className="relative space-y-5" onSubmit={handleSubmit(submit)}>
                <section>
                    <p className="font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                        Nueva rutina
                    </p>
                    <h2 className="mt-2 font-display text-4xl font-extrabold tracking-tight text-on-surface">
                        Crear tarea
                    </h2>
                </section>

                <section className="flex gap-3 rounded-xl border border-tertiary/20 bg-tertiary/10 p-4 text-tertiary">
                    <MaterialIcon name="info" filled />
                    <p className="text-sm font-semibold">
                        Esta tarea se generará la próxima vez que su horario aplique.
                    </p>
                </section>

                {createScheduleMutation.isError ? (
                    <section className="flex gap-3 rounded-xl border border-error-dim/30 bg-error-container/10 p-4 text-error">
                        <MaterialIcon name="error_outline" />
                        <p className="text-sm font-semibold">
                            {createScheduleMutation.error.message || "No se pudo crear la rutina"}
                        </p>
                    </section>
                ) : null}

                <Card title="Información básica">
                    <Field label="Título" error={errors.title?.message}>
                        <input className={inputClassName} {...register("title")} />
                    </Field>
                    <Field label="Descripción" error={errors.description?.message}>
                        <textarea className={cn(inputClassName, "min-h-24 resize-none")} {...register("description")} />
                    </Field>
                    <Field label="Categoría" error={errors.category?.message}>
                        <input className={inputClassName} placeholder="Focus, salud, admin..." {...register("category")} />
                    </Field>
                </Card>

                <Card title="Prioridad">
                    <div className="grid grid-cols-2 gap-3">
                        {priorityOptions.map((option) => (
                            <button
                                className={cn(
                                    "rounded-xl border bg-surface-container-lowest px-4 py-3 text-sm font-bold transition-all duration-300 hover:-translate-y-1 active:scale-95",
                                    option.className,
                                    values.priority_level === option.value && "bg-primary/10 ring-1 ring-primary/30",
                                )}
                                key={option.value}
                                onClick={() => setValue("priority_level", option.value, { shouldDirty: true })}
                                type="button"
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                    <label className="mt-4 flex items-center justify-between rounded-xl border border-outline-variant/15 bg-surface-container-lowest p-4">
                        <span>
                            <span className="block text-sm font-bold text-on-surface">Vital</span>
                            <span className="text-xs text-on-surface-variant">Resaltar esta rutina en la agenda.</span>
                        </span>
                        <input className="h-5 w-5 accent-primary" type="checkbox" {...register("is_required")} />
                    </label>
                </Card>

                <Card title="Horario">
                    <div className="grid gap-3 sm:grid-cols-3">
                        <ScheduleTypeButton
                            active={values.scheduleType === "range"}
                            icon="schedule"
                            label="Rango horario"
                            onClick={() => setValue("scheduleType", "range", { shouldDirty: true })}
                        />
                        <ScheduleTypeButton
                            active={values.scheduleType === "duration"}
                            icon="timer"
                            label="Duración"
                            onClick={() => setValue("scheduleType", "duration", { shouldDirty: true })}
                        />
                        <ScheduleTypeButton
                            active={values.scheduleType === "counter"}
                            icon="repeat"
                            label="Contador"
                            onClick={() => setValue("scheduleType", "counter", { shouldDirty: true })}
                        />
                    </div>

                    {values.scheduleType === "range" ? (
                        <div className="mt-4 grid grid-cols-2 gap-3">
                            <Field label="Inicio" error={errors.schedule_start_time?.message}>
                                <input className={inputClassName} type="time" {...register("schedule_start_time")} />
                            </Field>
                            <Field label="Fin" error={errors.schedule_end_time?.message}>
                                <input className={inputClassName} type="time" {...register("schedule_end_time")} />
                            </Field>
                        </div>
                    ) : null}
                    {values.scheduleType === "duration" ? (
                        <Field label="Duración (min)" error={errors.duration_minutes?.message}>
                            <input className={inputClassName} type="number" {...register("duration_minutes")} />
                        </Field>
                    ) : null}
                    {values.scheduleType === "counter" ? (
                        <Field label="Objetivo diario" error={errors.target_count?.message}>
                            <input className={inputClassName} type="number" {...register("target_count")} />
                        </Field>
                    ) : null}
                </Card>

                <Card title="Repetición">
                    <Field label="Frecuencia" error={errors.frequency?.message}>
                        <select className={inputClassName} {...register("frequency")}>
                            {Object.entries(frequencyLabels).map(([value, label]) => (
                                <option key={value} value={value}>
                                    {label}
                                </option>
                            ))}
                        </select>
                    </Field>
                    <p className="text-sm font-semibold text-primary">
                        {frequencyLabels[values.frequency]}
                    </p>
                </Card>

                <div className="flex flex-col gap-3">
                    <button
                        className="rounded-full bg-gradient-to-r from-primary to-primary-dim px-6 py-4 font-label text-sm font-extrabold uppercase tracking-widest text-on-primary shadow-[0_15px_40px_rgba(175,162,255,0.28)] transition-all duration-300 hover:-translate-y-1 active:scale-95 disabled:opacity-60"
                        disabled={createScheduleMutation.isPending}
                        type="submit"
                    >
                        {createScheduleMutation.isPending ? "Creando..." : "Crear rutina"}
                    </button>
                    <Link
                        className="rounded-full border border-outline-variant/15 bg-surface-container-highest px-6 py-4 text-center text-sm font-bold text-on-surface transition-all duration-300 hover:-translate-y-1 active:scale-95"
                        to="/tasks"
                    >
                        Cancelar
                    </Link>
                </div>
            </form>
        </main>
    );
}

const inputClassName =
    "w-full rounded-lg border border-outline-variant/15 bg-surface-container-lowest px-4 py-3 text-sm font-semibold text-on-surface outline-none transition-all duration-300 focus:border-primary focus:ring-2 focus:ring-primary/20";

function Card({ children, title }: { children: ReactNode; title: string }) {
    return (
        <section className="rounded-xl border border-outline-variant/10 bg-surface-container-low p-5">
            <h3 className="mb-4 font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                {title}
            </h3>
            <div className="space-y-4">{children}</div>
        </section>
    );
}

function Field({
    children,
    error,
    label,
}: {
    children: ReactNode;
    error?: string;
    label: string;
}) {
    return (
        <label className="block space-y-2">
            <span className="font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                {label}
            </span>
            {children}
            {error ? <span className="block text-xs text-error">{error}</span> : null}
        </label>
    );
}

function ScheduleTypeButton({
    active,
    icon,
    label,
    onClick,
}: {
    active: boolean;
    icon: string;
    label: string;
    onClick: () => void;
}) {
    return (
        <button
            className={cn(
                "flex flex-col items-center gap-2 rounded-xl border border-outline-variant/15 bg-surface-container-lowest p-4 text-sm font-bold text-on-surface-variant transition-all duration-300 hover:-translate-y-1 active:scale-95",
                active && "border-primary/30 bg-primary/10 text-primary ring-1 ring-primary/20",
            )}
            onClick={onClick}
            type="button"
        >
            <MaterialIcon name={icon} filled={active} />
            {label}
        </button>
    );
}
