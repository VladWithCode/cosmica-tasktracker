import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { useCreateSchedule } from "@/hooks/useCreateSchedule";
import {
    type CustomRepeatUnit,
    type RepeatPattern,
    scheduleFormSchema,
    type ScheduleFormInput,
    type ScheduleFormValues,
} from "@/lib/schemas/scheduleForm";
import { cn } from "@/lib/utils";
import type {
    CreateScheduleInput,
    LegacyRepeatFrequency,
    Priority,
    ScheduleFrequency,
} from "@/types/schedule";

const priorityOptions: Array<{ label: string; value: Priority; className: string }> = [
    { label: "Urgent", value: "urgent", className: "border-error/35 text-error" },
    { label: "High", value: "high", className: "border-primary/35 text-primary" },
    { label: "Medium", value: "medium", className: "border-tertiary/35 text-tertiary" },
    { label: "Low", value: "low", className: "border-outline-variant/30 text-on-surface-variant" },
];

const repeatPatternOptions: Array<{ label: string; value: RepeatPattern; hint: string }> = [
    { label: "Diario", value: "daily", hint: "Todos los días" },
    { label: "Semanal", value: "weekly", hint: "Elige días" },
    { label: "Quincenal", value: "biweekly", hint: "Cada 2 semanas" },
    { label: "Mensual", value: "monthly", hint: "Cada mes" },
    { label: "Bimestral", value: "bimonthly", hint: "Cada 2 meses" },
    { label: "Anual", value: "yearly", hint: "Cada año" },
    { label: "Personalizado", value: "custom", hint: "Intervalo libre" },
];

const customUnitLabels: Record<CustomRepeatUnit, string> = {
    days: "días",
    months: "meses",
    weeks: "semanas",
    years: "años",
};

const weekdayLabels = [
    { full: "Domingo", short: "D", value: 0 },
    { full: "Lunes", short: "L", value: 1 },
    { full: "Martes", short: "M", value: 2 },
    { full: "Miércoles", short: "X", value: 3 },
    { full: "Jueves", short: "J", value: 4 },
    { full: "Viernes", short: "V", value: 5 },
    { full: "Sábado", short: "S", value: 6 },
];

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
            custom_interval: 3,
            custom_unit: "days",
            description: "",
            end_date: "",
            is_required: false,
            priority_level: "high",
            repeat_pattern: "daily",
            repeat_weekdays: [],
            scheduleType: "range",
            schedule_end_time: "10:00",
            schedule_start_time: "09:00",
            title: "",
        },
        resolver: zodResolver(scheduleFormSchema),
    });
    const values = watch();

    const [waterUnit, setWaterUnit] = useState<"vasos" | "litros">("vasos");
    const [waterReminder, setWaterReminder] = useState(false);

    const applyWaterPreset = (unit: "vasos" | "litros" = waterUnit) => {
        const defaultTarget = unit === "litros" ? 2 : 8;
        const desc = unit === "litros" ? "Meta: litros de agua al día" : "";
        setValue("title", "Tomar agua", { shouldDirty: true });
        setValue("category", "Hidratación", { shouldDirty: true });
        setValue("description", desc, { shouldDirty: true });
        setValue("scheduleType", "counter", { shouldDirty: true });
        setValue("target_count", defaultTarget, { shouldDirty: true });
        setValue("repeat_pattern", "daily", { shouldDirty: true });
        setValue("priority_level", "medium", { shouldDirty: true });
        setValue("is_required", false, { shouldDirty: true });
    };

    const toggleWeekday = (day: number) => {
        const current = values.repeat_weekdays ?? [];
        const next = current.includes(day)
            ? current.filter((value) => value !== day)
            : [...current, day].sort((a, b) => a - b);
        setValue("repeat_weekdays", next, { shouldDirty: true, shouldValidate: true });
    };

    const isWaterPreset =
        values.title === "Tomar agua" && values.category === "Hidratación";

    const submit = (data: ScheduleFormValues) => {
        const payload = buildPayload(data, isWaterPreset ? { unit: waterUnit, reminder: waterReminder } : undefined);
        createScheduleMutation.mutate(payload);
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

                <section className="rounded-xl border border-outline-variant/10 bg-surface-container-low p-4">
                    <p className="mb-3 font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                        Presets rápidos
                    </p>
                    <div className={cn(
                        "rounded-xl border border-outline-variant/15 bg-surface-container-lowest transition-all duration-300",
                        isWaterPreset && "border-tertiary/30 bg-tertiary/10 ring-1 ring-tertiary/20",
                    )}>
                        <button
                            className="group flex w-full items-center gap-3 px-4 py-3 text-left"
                            onClick={() => {
                                applyWaterPreset(waterUnit);
                            }}
                            type="button"
                        >
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-tertiary/15 text-tertiary">
                                <MaterialIcon name="local_drink" filled className="text-xl" />
                            </span>
                            <span>
                                <span className="block text-sm font-bold text-on-surface">
                                    Tomar agua
                                </span>
                                <span className="block text-xs text-on-surface-variant">
                                    Contador diario · {waterUnit === "litros" ? "2 litros" : "8 vasos"} · Hidratación
                                </span>
                            </span>
                            <MaterialIcon
                                name={isWaterPreset ? "check_circle" : "arrow_forward"}
                                className={cn(
                                    "ml-auto transition-colors",
                                    isWaterPreset ? "text-tertiary" : "text-on-surface-variant group-hover:text-tertiary",
                                )}
                                filled={isWaterPreset}
                            />
                        </button>

                        {isWaterPreset ? (
                            <div className="border-t border-tertiary/15 px-4 pb-3 pt-2 space-y-2">
                                <div className="flex items-center gap-2">
                                    <span className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                                        Unidad:
                                    </span>
                                    {(["vasos", "litros"] as const).map((unit) => (
                                        <button
                                            className={cn(
                                                "rounded-full border px-3 py-1 font-label text-[11px] font-bold uppercase tracking-widest transition-all duration-200",
                                                waterUnit === unit
                                                    ? "border-tertiary/40 bg-tertiary/15 text-tertiary"
                                                    : "border-outline-variant/20 bg-surface-container-lowest text-on-surface-variant hover:text-tertiary",
                                            )}
                                            key={unit}
                                            onClick={() => {
                                                setWaterUnit(unit);
                                                applyWaterPreset(unit);
                                            }}
                                            type="button"
                                        >
                                            {unit}
                                        </button>
                                    ))}
                                </div>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        checked={waterReminder}
                                        className="h-4 w-4 accent-tertiary"
                                        onChange={(e) => setWaterReminder(e.target.checked)}
                                        type="checkbox"
                                    />
                                    <span className="text-xs font-semibold text-on-surface-variant">
                                        Recordarme tomar agua (notificación guardada)
                                    </span>
                                </label>
                            </div>
                        ) : null}
                    </div>
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
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {repeatPatternOptions.map((option) => (
                            <button
                                className={cn(
                                    "flex flex-col items-start gap-1 rounded-xl border border-outline-variant/15 bg-surface-container-lowest p-3 text-left transition-all duration-300 hover:-translate-y-0.5 active:scale-95",
                                    values.repeat_pattern === option.value &&
                                        "border-primary/30 bg-primary/10 ring-1 ring-primary/20",
                                )}
                                key={option.value}
                                onClick={() =>
                                    setValue("repeat_pattern", option.value, { shouldDirty: true, shouldValidate: true })
                                }
                                type="button"
                            >
                                <span
                                    className={cn(
                                        "text-sm font-bold",
                                        values.repeat_pattern === option.value
                                            ? "text-primary"
                                            : "text-on-surface",
                                    )}
                                >
                                    {option.label}
                                </span>
                                <span className="text-[11px] text-on-surface-variant">{option.hint}</span>
                            </button>
                        ))}
                    </div>

                    {values.repeat_pattern === "weekly" ? (
                        <Field label="Días de la semana" error={errors.repeat_weekdays?.message as string | undefined}>
                            <div className="flex flex-wrap gap-2">
                                {weekdayLabels.map((day) => {
                                    const active = (values.repeat_weekdays ?? []).includes(day.value);
                                    return (
                                        <button
                                            aria-label={day.full}
                                            className={cn(
                                                "flex h-10 w-10 items-center justify-center rounded-full border border-outline-variant/20 bg-surface-container-lowest text-sm font-bold text-on-surface-variant transition-all duration-200 active:scale-95",
                                                active && "border-primary/40 bg-primary/15 text-primary",
                                            )}
                                            key={day.value}
                                            onClick={() => toggleWeekday(day.value)}
                                            type="button"
                                        >
                                            {day.short}
                                        </button>
                                    );
                                })}
                            </div>
                        </Field>
                    ) : null}

                    {values.repeat_pattern === "custom" ? (
                        <div className="grid grid-cols-2 gap-3">
                            <Field label="Cada" error={errors.custom_interval?.message}>
                                <input
                                    className={inputClassName}
                                    min={1}
                                    type="number"
                                    {...register("custom_interval")}
                                />
                            </Field>
                            <Field label="Unidad">
                                <select className={inputClassName} {...register("custom_unit")}>
                                    {Object.entries(customUnitLabels).map(([value, label]) => (
                                        <option key={value} value={value}>
                                            {label}
                                        </option>
                                    ))}
                                </select>
                            </Field>
                        </div>
                    ) : null}

                    <Field label="Fecha final (opcional)" error={errors.end_date?.message}>
                        <input className={inputClassName} type="date" {...register("end_date")} />
                    </Field>

                    <p className="text-sm font-semibold text-primary">{summarizeRecurrence(values)}</p>
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

function buildPayload(
    data: ScheduleFormValues,
    water?: { unit: "vasos" | "litros"; reminder: boolean },
): CreateScheduleInput {
    const frequency: ScheduleFrequency = deriveFrequency(data.repeat_pattern);
    const { repeatFrequency, repeatInterval, repeating } = deriveRepeat(
        data.repeat_pattern,
        data.custom_interval,
        data.custom_unit,
    );
    const repeatWeekdays = data.repeat_pattern === "weekly" ? data.repeat_weekdays : [];

    return {
        category: data.category?.trim() || undefined,
        description: data.description?.trim() || undefined,
        duration_minutes: data.scheduleType === "duration" ? data.duration_minutes : null,
        end_date: data.end_date ? data.end_date : null,
        frequency,
        frequency_config: {
            pattern: data.repeat_pattern,
            scheduleType: data.scheduleType,
            ...(data.repeat_pattern === "custom"
                ? { customInterval: data.custom_interval, customUnit: data.custom_unit }
                : {}),
            ...(water ? { waterUnit: water.unit, waterReminder: water.reminder } : {}),
        },
        is_required: data.is_required,
        priority_level: data.priority_level,
        repeatFrequency,
        repeatInterval,
        repeatWeekdays,
        repeating,
        schedule_end_time: data.scheduleType === "range" ? data.schedule_end_time : null,
        schedule_start_time: data.scheduleType === "range" ? data.schedule_start_time : null,
        target_count: data.scheduleType === "counter" ? data.target_count : null,
        title: data.title.trim(),
    };
}

function deriveFrequency(pattern: RepeatPattern): ScheduleFrequency {
    switch (pattern) {
        case "daily":
            return "daily";
        case "weekly":
            return "weekly";
        case "monthly":
            return "monthly";
        default:
            return "custom";
    }
}

function deriveRepeat(
    pattern: RepeatPattern,
    customInterval: number | undefined,
    customUnit: CustomRepeatUnit,
): { repeatFrequency: LegacyRepeatFrequency; repeatInterval: number; repeating: boolean } {
    if (pattern === "custom") {
        const interval = Math.max(1, customInterval ?? 1);
        const map: Record<CustomRepeatUnit, LegacyRepeatFrequency> = {
            days: "daily",
            months: "monthly",
            weeks: "weekly",
            years: "yearly",
        };
        return { repeatFrequency: map[customUnit], repeatInterval: interval, repeating: true };
    }
    const intervalMap: Record<Exclude<RepeatPattern, "custom">, number> = {
        biweekly: 2,
        bimonthly: 2,
        daily: 1,
        monthly: 1,
        weekly: 1,
        yearly: 1,
    };
    const frequencyMap: Record<Exclude<RepeatPattern, "custom">, LegacyRepeatFrequency> = {
        biweekly: "biweekly",
        bimonthly: "bimonthly",
        daily: "daily",
        monthly: "monthly",
        weekly: "weekly",
        yearly: "yearly",
    };
    return {
        repeatFrequency: frequencyMap[pattern],
        repeatInterval: intervalMap[pattern],
        repeating: true,
    };
}

function summarizeRecurrence(values: ScheduleFormInput): string {
    const pattern = values.repeat_pattern ?? "daily";
    switch (pattern) {
        case "daily":
            return "Se repetirá todos los días";
        case "weekly": {
            const days = values.repeat_weekdays ?? [];
            if (days.length === 0) return "Selecciona los días de la semana";
            const labels = days
                .map((day) => weekdayLabels.find((entry) => entry.value === day)?.full)
                .filter(Boolean)
                .join(", ");
            return `Cada semana: ${labels}`;
        }
        case "biweekly":
            return "Cada 2 semanas";
        case "monthly":
            return "Cada mes";
        case "bimonthly":
            return "Cada 2 meses";
        case "yearly":
            return "Cada año";
        case "custom": {
            const interval = Number(values.custom_interval ?? 1);
            const unit = values.custom_unit ?? "days";
            return `Cada ${interval} ${customUnitLabels[unit]}`;
        }
        default:
            return "";
    }
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
