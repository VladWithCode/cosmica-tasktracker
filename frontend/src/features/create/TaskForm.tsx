import { useEffect, useId, type ReactNode } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronRight, Minus, Plus } from "lucide-react";
import { Controller, useForm, useWatch, type Control } from "react-hook-form";
import { errorMessage } from "@/api/client";
import type { Grant } from "@/api/schemas";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { FieldRow, InlineInput, InlineTextArea, TrailingInput } from "@/components/ui/Field";
import { GroupedSection } from "@/components/ui/GroupedList";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Switch } from "@/components/ui/Switch";
import { cn } from "@/lib/cn";
import { fade, spring } from "@/lib/motion";
import { createSchema, intervalUnits, repeatOptions, weekdayOptions, type CreateParsed, type CreateValues } from "./createForm";

export function Reveal({ show, children }: { show: boolean; children: ReactNode }) {
    const reduceMotion = useReducedMotion();
    return (
        <AnimatePresence initial={false}>
            {show ? (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={reduceMotion ? fade : spring.default}
                    className="overflow-hidden"
                >
                    {children}
                </motion.div>
            ) : null}
        </AnimatePresence>
    );
}

type TaskFormProps = {
    defaultValues: CreateValues;
    mode: "create" | "edit";
    owners?: Grant[];
    pending: boolean;
    error: unknown;
    submitLabel?: string;
    readOnly?: boolean;
    onSubmit: (values: CreateParsed) => void;
};

export function TaskForm({ defaultValues, mode, owners = [], pending, error, submitLabel, readOnly, onSubmit }: TaskFormProps) {
    const form = useForm<CreateValues, unknown, CreateParsed>({
        resolver: zodResolver(createSchema),
        mode: "onTouched",
        defaultValues,
    });
    const { errors } = form.formState;
    const [kind, timeMode, repeat, goal, hasEndDate] = useWatch({
        control: form.control,
        name: ["kind", "timeMode", "repeat", "goal", "hasEndDate"],
    });

    useEffect(() => {
        if (goal === "water" && !form.getValues("targetCount")) form.setValue("targetCount", "2");
    }, [goal, form]);

    useEffect(() => {
        if (kind === "once" && goal === "water") form.setValue("goal", "count");
    }, [kind, goal, form]);

    const submit = form.handleSubmit(onSubmit);
    const interval = intervalUnits[repeat];

    return (
        <form noValidate onSubmit={submit} className="flex flex-col">
            <fieldset disabled={readOnly} className="contents">
            {mode === "create" ? <div className="px-4 pt-1 pb-2">
                <Controller
                    control={form.control}
                    name="kind"
                    render={({ field }) => (
                        <SegmentedControl
                            label="Tipo"
                            value={field.value}
                            onChange={field.onChange}
                            options={[
                                { value: "once", label: "Una vez" },
                                { value: "routine", label: "Rutina" },
                            ]}
                        />
                    )}
                />
                <p className="px-1 pt-2 text-footnote text-label-secondary">
                    {kind === "once" ? "Una tarea para un solo día." : "Se repite y genera una tarea cada día que toque."}
                </p>
            </div> : null}

            <GroupedSection>
                <InlineInput label="Título" autoFocus={mode === "create"} autoComplete="off" enterKeyHint="next" error={errors.title?.message} {...form.register("title")} />
                <InlineTextArea label="Descripción (opcional)" rows={2} {...form.register("description")} />
            </GroupedSection>

            <GroupedSection title="Cuándo" footer={errors.date?.message ?? errors.endDate?.message}>
                <FieldRow label={kind === "once" ? "Fecha" : "Empieza"} htmlFor="create-date">
                    <TrailingInput id="create-date" type="date" {...form.register("date")} />
                </FieldRow>
                {kind === "routine" ? (
                    <>
                        <FieldRow label="Fecha de fin">
                            <Controller
                                control={form.control}
                                name="hasEndDate"
                                render={({ field }) => <Switch label="Fecha de fin" checked={field.value} onChange={field.onChange} />}
                            />
                        </FieldRow>
                        <Reveal show={hasEndDate}>
                            <FieldRow label="Termina" htmlFor="create-end-date">
                                <TrailingInput id="create-end-date" type="date" {...form.register("endDate")} />
                            </FieldRow>
                        </Reveal>
                    </>
                ) : null}
            </GroupedSection>

            <Reveal show={kind === "routine"}>
                <RepeatSection control={form.control} repeat={repeat} interval={interval} weekdaysError={errors.weekdays?.message} intervalError={errors.interval?.message} />
            </Reveal>

            <GroupedSection title="Horario" footer={errors.startTime?.message ?? errors.endTime?.message ?? errors.durationMinutes?.message}>
                <div className="px-4 py-3">
                    <Controller
                        control={form.control}
                        name="timeMode"
                        render={({ field }) => (
                            <SegmentedControl
                                label="Horario"
                                value={field.value}
                                onChange={field.onChange}
                                options={[
                                    { value: "anytime", label: "Cualquier hora" },
                                    { value: "time", label: "A una hora" },
                                    { value: "duration", label: "Duración" },
                                ]}
                            />
                        )}
                    />
                </div>
                <Reveal show={timeMode === "time"}>
                    <FieldRow label="Empieza" htmlFor="create-start">
                        <TrailingInput id="create-start" type="time" {...form.register("startTime")} />
                    </FieldRow>
                    <FieldRow label="Termina (opcional)" htmlFor="create-end">
                        <TrailingInput id="create-end" type="time" {...form.register("endTime")} />
                    </FieldRow>
                </Reveal>
                <Reveal show={timeMode === "duration"}>
                    <FieldRow label="Minutos" htmlFor="create-duration">
                        <TrailingInput id="create-duration" inputMode="numeric" placeholder="30" className="w-20" {...form.register("durationMinutes")} />
                    </FieldRow>
                </Reveal>
            </GroupedSection>

            <GroupedSection title="Meta" footer={errors.targetCount?.message ?? (goal === "water" ? "Cada botella es 1 litro." : undefined)}>
                <div className="px-4 py-3">
                    <Controller
                        control={form.control}
                        name="goal"
                        render={({ field }) => (
                            <SegmentedControl
                                label="Meta"
                                value={field.value}
                                onChange={field.onChange}
                                options={[
                                    { value: "none", label: "Ninguna" },
                                    { value: "count", label: "Veces" },
                                    ...(kind === "routine" ? [{ value: "water" as const, label: "Agua" }] : []),
                                ]}
                            />
                        )}
                    />
                </div>
                <Reveal show={goal !== "none"}>
                    <FieldRow label={goal === "water" ? "Litros al día" : "Veces al día"} htmlFor="create-target">
                        <TrailingInput id="create-target" inputMode="numeric" className="w-20" {...form.register("targetCount")} />
                    </FieldRow>
                    {goal === "water" ? (
                        <FieldRow label="Recordatorios de agua" hint="Notificaciones a lo largo del día">
                            <Controller
                                control={form.control}
                                name="waterReminder"
                                render={({ field }) => <Switch label="Recordatorios de agua" checked={field.value} onChange={field.onChange} />}
                            />
                        </FieldRow>
                    ) : null}
                </Reveal>
            </GroupedSection>

            <MoreOptions control={form.control} register={form.register} />

            {mode === "create" && owners.length > 0 ? (
                <GroupedSection title="Para" footer="Puedes crear tareas y rutinas para quien te dio permiso de gestionar sus tareas.">
                    <Controller
                        control={form.control}
                        name="ownerId"
                        render={({ field }) => (
                            <div className="flex flex-wrap gap-2 px-4 py-3">
                                <Chip selected={field.value === ""} onClick={() => field.onChange("")}>
                                    Yo
                                </Chip>
                                {owners.map((grant) => (
                                    <Chip key={grant.id} selected={field.value === grant.ownerUserId} onClick={() => field.onChange(grant.ownerUserId)}>
                                        {grant.owner.fullname || grant.owner.username}
                                    </Chip>
                                ))}
                            </div>
                        )}
                    />
                </GroupedSection>
            ) : null}

            {error ? (
                <p role="alert" className="px-8 pt-2 text-footnote text-danger">
                    {errorMessage(error)}
                </p>
            ) : null}

            {readOnly ? null : (
                <div className="px-4 pt-8">
                    <Button type="submit" size="lg" loading={pending}>
                        {submitLabel ?? (kind === "once" ? "Crear tarea" : "Crear rutina")}
                    </Button>
                </div>
            )}
            </fieldset>
        </form>
    );
}

type RepeatSectionProps = {
    control: Control<CreateValues, unknown, CreateParsed>;
    repeat: CreateValues["repeat"];
    interval: [string, string] | undefined;
    weekdaysError?: string;
    intervalError?: string;
};

function RepeatSection({ control, repeat, interval, weekdaysError, intervalError }: RepeatSectionProps) {
    const weekly = repeat === "weekly" || repeat === "biweekly";
    const labelId = useId();
    return (
        <GroupedSection title="Repetir" footer={weekdaysError ?? intervalError}>
            <Controller
                control={control}
                name="repeat"
                render={({ field }) => (
                    <div role="group" aria-label="Frecuencia" className="flex flex-wrap gap-2 px-4 py-3">
                        {repeatOptions.map((option) => (
                            <Chip key={option.value} selected={field.value === option.value} onClick={() => field.onChange(option.value)}>
                                {option.label}
                            </Chip>
                        ))}
                    </div>
                )}
            />
            {weekly ? (
                <Controller
                    control={control}
                    name="weekdays"
                    render={({ field }) => (
                        <div role="group" aria-label="Días de la semana" className="flex justify-between gap-1 px-4 py-3">
                            {weekdayOptions.map((day) => {
                                const selected = field.value.includes(day.value);
                                return (
                                    <button
                                        key={day.value}
                                        type="button"
                                        aria-label={day.label}
                                        aria-pressed={selected}
                                        onClick={() => field.onChange(selected ? field.value.filter((value) => value !== day.value) : [...field.value, day.value])}
                                        className={cn(
                                            "flex size-10 items-center justify-center rounded-full text-callout font-semibold transition-colors",
                                            selected ? "bg-accent text-on-accent" : "bg-fill-secondary text-label",
                                        )}
                                    >
                                        {day.short}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                />
            ) : null}
            {interval ? (
                <Controller
                    control={control}
                    name="interval"
                    render={({ field }) => {
                        const value = Number(field.value) || 1;
                        return (
                            <div className="flex min-h-12 items-center gap-3 px-4 py-1.5">
                                <span id={labelId} className="flex-1 text-body">
                                    Cada {value} {value === 1 ? interval[0] : interval[1]}
                                </span>
                                <div role="group" aria-labelledby={labelId} className="flex overflow-hidden rounded-[0.5rem] bg-fill-secondary">
                                    <button type="button" aria-label="Menos" disabled={value <= 1} onClick={() => field.onChange(value - 1)} className="flex h-9 w-11 items-center justify-center text-label disabled:opacity-30">
                                        <Minus aria-hidden className="size-4" />
                                    </button>
                                    <span aria-hidden className="my-2 w-px bg-separator" />
                                    <button type="button" aria-label="Más" disabled={value >= 30} onClick={() => field.onChange(value + 1)} className="flex h-9 w-11 items-center justify-center text-label disabled:opacity-30">
                                        <Plus aria-hidden className="size-4" />
                                    </button>
                                </div>
                            </div>
                        );
                    }}
                />
            ) : null}
        </GroupedSection>
    );
}

type MoreOptionsProps = {
    control: Control<CreateValues, unknown, CreateParsed>;
    register: ReturnType<typeof useForm<CreateValues, unknown, CreateParsed>>["register"];
};

function MoreOptions({ control, register }: MoreOptionsProps) {
    return (
        <details className="group px-4 py-3 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex min-h-11 cursor-default list-none items-center gap-1 px-4 text-footnote font-medium text-label-secondary">
                <ChevronRight aria-hidden className="size-4 transition-transform group-open:rotate-90 motion-reduce:transition-none" />
                Más opciones
            </summary>
            <div className="overflow-hidden rounded-card bg-bg-elevated [&>*+*]:border-t [&>*+*]:border-separator">
                <FieldRow label="Urgente" hint="Aparece primero en su horario">
                    <Controller control={control} name="urgent" render={({ field }) => <Switch label="Urgente" checked={field.value} onChange={field.onChange} />} />
                </FieldRow>
                <FieldRow label="Imprescindible" hint="Se destaca al inicio de Hoy">
                    <Controller control={control} name="isRequired" render={({ field }) => <Switch label="Imprescindible" checked={field.value} onChange={field.onChange} />} />
                </FieldRow>
                <FieldRow label="Categoría" htmlFor="create-category">
                    <TrailingInput id="create-category" placeholder="Ninguna" className="w-40 text-left" {...register("category")} />
                </FieldRow>
            </div>
        </details>
    );
}
