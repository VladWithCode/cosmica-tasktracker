import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import type { Priority, TaskDetail } from "@/api/schemas";
import type { TaskUpdate } from "@/api/tasks";
import { Button } from "@/components/ui/Button";
import { FieldRow, InlineInput, InlineTextArea, TrailingInput } from "@/components/ui/Field";
import { GroupedSection } from "@/components/ui/GroupedList";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Switch } from "@/components/ui/Switch";

const optionalNumber = z.union([z.literal(""), z.coerce.number().int().min(1, "Debe ser mayor a 0").max(999)]);

const schema = z
    .object({
        scope: z.enum(["instance", "routine"]),
        title: z.string().trim().min(1, "Escribe un título").max(120),
        description: z.string().max(500),
        targetCount: optionalNumber,
        startTime: z.string(),
        endTime: z.string(),
        durationMinutes: optionalNumber,
        urgent: z.boolean(),
        isRequired: z.boolean(),
        category: z.string().max(60),
    })
    .refine((values) => !values.startTime || !values.endTime || values.endTime > values.startTime, {
        path: ["endTime"],
        message: "Debe terminar después de empezar",
    });

type Values = z.input<typeof schema>;
type Parsed = z.output<typeof schema>;

type TaskEditFormProps = {
    task: TaskDetail;
    saving: boolean;
    onCancel: () => void;
    onSave: (update: TaskUpdate) => void;
};

function diff(task: TaskDetail, values: Parsed): TaskUpdate {
    const update: TaskUpdate = {};
    if (values.title !== task.title) update.title = values.title;
    if (values.description !== task.description) update.description = values.description;
    const target = values.targetCount === "" ? null : values.targetCount;
    if (target !== null && target !== task.targetCount) update.targetCount = target;
    if (values.scope === "routine") update.applyToSchedule = true;
    if (values.startTime && values.startTime !== task.startTime) update.startTime = values.startTime;
    if (values.endTime && values.endTime !== task.endTime) update.endTime = values.endTime;
    const duration = values.durationMinutes === "" ? null : values.durationMinutes;
    if (duration !== null && duration !== task.durationMinutes) update.durationMinutes = duration;
    const priority: Priority = values.urgent ? "urgent" : "medium";
    if (priority !== task.priority) update.priority = priority;
    if (values.isRequired !== task.isRequired) update.isRequired = values.isRequired;
    if (values.category.trim() !== task.category) update.category = values.category.trim();
    return update;
}

export function TaskEditForm({ task, saving, onCancel, onSave }: TaskEditFormProps) {
    const form = useForm<Values, unknown, Parsed>({
        resolver: zodResolver(schema),
        mode: "onTouched",
        defaultValues: {
            scope: "instance",
            title: task.title,
            description: task.description,
            targetCount: task.targetCount ?? "",
            startTime: task.startTime ?? "",
            endTime: task.endTime ?? "",
            durationMinutes: task.durationMinutes ?? "",
            urgent: task.priority === "urgent",
            isRequired: task.isRequired,
            category: task.category,
        },
    });
    const scope = useWatch({ control: form.control, name: "scope" });
    const { errors } = form.formState;

    const submit = form.handleSubmit((values) => {
        const update = diff(task, values);
        const changed = Object.keys(update).filter((key) => key !== "applyToSchedule");
        if (changed.length === 0) onCancel();
        else onSave(update);
    });

    return (
        <form noValidate onSubmit={submit} className="flex flex-col">
            {task.canApplyToSchedule ? (
                <div className="px-4 pt-1 pb-2">
                    <Controller
                        control={form.control}
                        name="scope"
                        render={({ field }) => (
                            <SegmentedControl
                                label="Aplicar cambios a"
                                value={field.value}
                                onChange={field.onChange}
                                options={[
                                    { value: "instance", label: "Solo hoy" },
                                    { value: "routine", label: "Toda la rutina" },
                                ]}
                            />
                        )}
                    />
                    <p className="px-1 pt-2 text-footnote text-label-secondary">
                        {scope === "routine"
                            ? "Los cambios se aplican a esta tarea y a las próximas de la rutina."
                            : "Solo cambia la tarea de este día. La rutina sigue igual."}
                    </p>
                </div>
            ) : null}

            <GroupedSection>
                <InlineInput label="Título" autoComplete="off" error={errors.title?.message} {...form.register("title")} />
                <InlineTextArea label="Descripción" {...form.register("description")} />
            </GroupedSection>

            <GroupedSection footer={errors.targetCount?.message}>
                <FieldRow label="Meta de repeticiones" htmlFor="edit-target" hint="Déjalo vacío si no cuenta veces">
                    <TrailingInput id="edit-target" inputMode="numeric" className="w-20" {...form.register("targetCount")} />
                </FieldRow>
            </GroupedSection>

            <GroupedSection title="Horario" footer={errors.endTime?.message ?? errors.durationMinutes?.message}>
                <FieldRow label="Empieza" htmlFor="edit-start">
                    <TrailingInput id="edit-start" type="time" {...form.register("startTime")} />
                </FieldRow>
                <FieldRow label="Termina" htmlFor="edit-end">
                    <TrailingInput id="edit-end" type="time" {...form.register("endTime")} />
                </FieldRow>
                <FieldRow label="Duración (min)" htmlFor="edit-duration">
                    <TrailingInput id="edit-duration" inputMode="numeric" className="w-20" {...form.register("durationMinutes")} />
                </FieldRow>
            </GroupedSection>
            <GroupedSection>
                <FieldRow label="Urgente">
                    <Controller control={form.control} name="urgent" render={({ field }) => <Switch label="Urgente" checked={field.value} onChange={field.onChange} />} />
                </FieldRow>
                <FieldRow label="Imprescindible">
                    <Controller
                        control={form.control}
                        name="isRequired"
                        render={({ field }) => <Switch label="Imprescindible" checked={field.value} onChange={field.onChange} />}
                    />
                </FieldRow>
                <FieldRow label="Categoría" htmlFor="edit-category">
                    <TrailingInput id="edit-category" className="w-40 text-left" placeholder="Ninguna" {...form.register("category")} />
                </FieldRow>
            </GroupedSection>

            <div className="flex gap-3 px-4 pt-8">
                <Button type="button" variant="tinted" size="lg" className="flex-1" onClick={onCancel}>
                    Cancelar
                </Button>
                <Button type="submit" size="lg" className="flex-1" loading={saving}>
                    Guardar
                </Button>
            </div>
        </form>
    );
}
