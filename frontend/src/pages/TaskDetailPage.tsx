import { useEffect, useId, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { CounterTaskProgress } from "@/components/tasks/CounterTaskProgress";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { cn, formatStartTime } from "@/lib/utils";
import type { TTask, TTaskStatus } from "@/lib/schemas/task";
import { getTaskByIdOpts, updateTaskOpts } from "@/queries/tasks";
import { pingTaskOpts } from "@/queries/sharing";
import type { Priority } from "@/types/task";

const taskStatuses: Array<{
    icon: string;
    label: string;
    status: TTaskStatus;
}> = [
    { icon: "pending_actions", label: "Pendiente", status: "pending" },
    { icon: "play_arrow", label: "En progreso", status: "in_progress" },
    { icon: "done_all", label: "Completada", status: "completed" },
    { icon: "skip_next", label: "Omitida", status: "skipped" },
    { icon: "error", label: "Fallida", status: "failed" },
];

const priorities: Array<{
    label: string;
    priority: Priority;
}> = [
    { label: "Urgente", priority: "urgent" },
    { label: "Alta", priority: "high" },
    { label: "Media", priority: "medium" },
    { label: "Baja", priority: "low" },
];

interface TaskDetailPageProps {
    taskId: string;
}

interface TaskFormState {
    currentCount: string;
    date: string;
    description: string;
    durationMinutes: string;
    endTime: string;
    isRequired: boolean;
    notes: string;
    priority: Priority;
    startTime: string;
    status: TTaskStatus;
    targetCount: string;
    title: string;
}

export function TaskDetailPage({ taskId }: TaskDetailPageProps) {
    const { data, error, isError, isLoading } = useQuery(getTaskByIdOpts(taskId));

    return (
        <AppShell showBackButton showBottomNav={false} title="Detalle de tarea" topBarAlign="center">
            <main className="relative min-h-full bg-surface px-6 pb-12 pt-8 text-on-surface">
                <div className="pointer-events-none absolute left-1/2 top-16 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/5 blur-[120px]" />
                <div className="relative mx-auto flex max-w-3xl flex-col gap-6">
                    {isLoading ? <TaskDetailLoading /> : null}
                    {isError ? <TaskDetailError error={error} /> : null}
                    {!isLoading && !isError && data?.task ? (
                        <TaskDetailContent task={data.task} />
                    ) : null}
                </div>
            </main>
        </AppShell>
    );
}

function TaskDetailContent({ task }: { task: TTask }) {
    const [formState, setFormState] = useState(() => toFormState(task));
    const [applyToSchedule, setApplyToSchedule] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const updateTaskMutation = useMutation(updateTaskOpts);
    const pingMutation = useMutation(pingTaskOpts);
    const titleInputId = useId();
    const descriptionInputId = useId();
    const dateInputId = useId();
    const startTimeInputId = useId();
    const endTimeInputId = useId();
    const durationInputId = useId();
    const currentCountInputId = useId();
    const targetCountInputId = useId();
    const notesInputId = useId();
    const statusMeta = getStatusMeta(task.status);
    const scheduledRange = formatScheduledRange(task);
    const durationLabel = formatDuration(task.duration);
    const canEdit = task.canEdit !== false;
    const canApplyToSchedule = canEdit && task.canApplyToSchedule !== false;

    useEffect(() => {
        setFormState(toFormState(task));
        setApplyToSchedule(false);
        setShowConfirmModal(false);
    }, [task]);

    useEffect(() => {
        if (!canApplyToSchedule) {
            setApplyToSchedule(false);
        }
    }, [canApplyToSchedule]);

    const hasChanges = useMemo(() => {
        const original = toFormState(task);
        return (
            formState.date !== original.date ||
            formState.description !== original.description ||
            formState.durationMinutes !== original.durationMinutes ||
            formState.endTime !== original.endTime ||
            formState.isRequired !== original.isRequired ||
            formState.currentCount !== original.currentCount ||
            formState.notes !== original.notes ||
            formState.priority !== original.priority ||
            formState.startTime !== original.startTime ||
            formState.status !== original.status ||
            formState.targetCount !== original.targetCount ||
            formState.title !== original.title
        );
    }, [formState, task]);

    function updateField<K extends keyof TaskFormState>(key: K, value: TaskFormState[K]) {
        setFormState((current) => ({ ...current, [key]: value }));
    }

    function onSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!canEdit) {
            toast.error("No tienes permiso para editar esta tarea");
            return;
        }
        if (applyToSchedule && !canApplyToSchedule) {
            toast.error("Sólo el owner puede aplicar cambios a la rutina");
            setApplyToSchedule(false);
            return;
        }
        if (applyToSchedule) {
            setShowConfirmModal(true);
            return;
        }
        submitTaskUpdate(false);
    }

    function submitTaskUpdate(nextApplyToSchedule: boolean) {
        updateTaskMutation.mutate(
            {
                apply_to_schedule: nextApplyToSchedule,
                currentCount: toOptionalNumber(formState.currentCount),
                date: toApiDate(formState.date),
                description: formState.description,
                duration_minutes: toOptionalNumber(formState.durationMinutes),
                is_required: formState.isRequired,
                notes: formState.notes,
                priority_level: formState.priority,
                schedule_end_time: emptyToUndefined(formState.endTime),
                schedule_start_time: emptyToUndefined(formState.startTime),
                status: formState.status,
                targetCount: toOptionalNumber(formState.targetCount),
                taskId: task.id,
                title: formState.title,
            },
            {
                onError: (mutationError) => {
                    toast.error(
                        mutationError instanceof Error
                            ? mutationError.message
                            : "No se pudo actualizar la tarea",
                    );
                },
                onSuccess: () => {
                    toast.success(
                        nextApplyToSchedule
                            ? "Rutina actualizada"
                            : "Instancia actualizada",
                    );
                    setShowConfirmModal(false);
                },
            },
        );
    }

    function sendPing() {
        pingMutation.mutate(
            { taskId: task.id },
            {
                onError: (mutationError) => {
                    toast.error(
                        mutationError instanceof Error
                            ? mutationError.message
                            : "No se pudo enviar el ping",
                    );
                },
                onSuccess: (result) => {
                    toast.success(
                        result.notification_sent
                            ? "Ping enviado con notificación"
                            : "Ping registrado sin notificación push",
                    );
                },
            },
        );
    }

    return (
        <>
            <section className="overflow-hidden rounded-xl border border-outline-variant/10 bg-surface-container-low p-6 shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                        <p className="font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                            Detalle de tarea
                        </p>
                        <h2 className="mt-2 font-display text-4xl font-extrabold tracking-tight text-on-surface">
                            {task.title}
                        </h2>
                        {task.description ? (
                            <p className="mt-3 max-w-2xl text-sm leading-6 text-on-surface-variant">
                                {task.description}
                            </p>
                        ) : null}
                    </div>
                    <span
                        className={cn(
                            "inline-flex w-fit items-center gap-2 rounded-full border px-3 py-2 font-label text-xs font-bold uppercase tracking-widest",
                            statusMeta.className,
                        )}
                    >
                        <MaterialIcon name={statusMeta.icon} filled className="text-base" />
                        {statusMeta.label}
                    </span>
                </div>

                <div className="mt-5 flex justify-end">
                    <button
                        className="inline-flex items-center rounded-full border border-outline-variant/15 bg-surface-container-highest px-4 py-3 text-sm font-bold text-primary transition-all duration-300 hover:-translate-y-1 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={pingMutation.isPending}
                        onClick={sendPing}
                        type="button"
                    >
                        <MaterialIcon name="notifications_active" className="mr-2 text-base" />
                        {pingMutation.isPending ? "Enviando..." : "Enviar ping"}
                    </button>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    <DetailMetric icon="calendar_today" label="Fecha" value={formatDate(task.date)} />
                    <DetailMetric icon="schedule" label="Horario" value={scheduledRange} />
                    <DetailMetric icon="timer" label="Duración" value={durationLabel} />
                </div>
                {task.targetCount && task.targetCount > 0 ? (
                    <div className="mt-6">
                        <CounterTaskProgress
                            category={task.category ?? null}
                            currentCount={task.currentCount}
                            description={task.description ?? null}
                            status={task.status}
                            targetCount={task.targetCount}
                            title={task.title}
                        />
                    </div>
                ) : null}
            </section>

            {!canEdit ? (
                <section className="rounded-xl border border-tertiary/20 bg-tertiary/10 p-4 text-sm text-tertiary">
                    <div className="flex items-center gap-2">
                        <MaterialIcon name="visibility" className="text-base" />
                        <p>Esta tarea compartida está en modo lectura. Necesitas permiso Gestionar para editarla.</p>
                    </div>
                </section>
            ) : null}

            <form
                className="rounded-xl border border-outline-variant/10 bg-surface-container-low p-6"
                onSubmit={onSubmit}
            >
                <div className="mb-6 rounded-xl border border-outline-variant/10 bg-surface-container-high p-4">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                                Alcance de edición
                            </p>
                            <h3 className="mt-1 font-headline text-xl font-bold text-on-surface">
                                Aplicar a la rutina
                            </h3>
                            <p
                                className={cn(
                                    "mt-1 text-sm",
                                    applyToSchedule ? "text-primary" : "text-on-surface-variant",
                                )}
                            >
                                {applyToSchedule
                                    ? "Los cambios actualizarán la rutina y futuras instancias."
                                    : canEdit && !canApplyToSchedule
                                      ? "Puedes editar esta instancia compartida, pero no la rutina base."
                                    : "Los cambios afectarán solo esta instancia."}
                            </p>
                        </div>
                        <button
                            aria-pressed={applyToSchedule}
                            className={cn(
                                "flex h-9 w-16 items-center rounded-full border p-1 transition-all duration-300 active:scale-95",
                                applyToSchedule
                                    ? "justify-end border-primary/40 bg-primary/20"
                                    : "justify-start border-outline-variant/15 bg-surface-container-lowest",
                            )}
                            disabled={!canApplyToSchedule}
                            onClick={() => setApplyToSchedule((current) => !current)}
                            type="button"
                        >
                            <span className="h-7 w-7 rounded-full bg-gradient-to-r from-primary to-primary-dim shadow-[0_0_18px_rgba(175,162,255,0.32)]" />
                        </button>
                    </div>
                </div>

                <fieldset className="contents" disabled={!canEdit || updateTaskMutation.isPending}>
                <div className="grid gap-4">
                    <label className="space-y-2" htmlFor={titleInputId}>
                        <span className="block font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                            Título
                        </span>
                        <input
                            className="w-full rounded-lg border border-outline-variant/15 bg-surface-container-lowest px-4 py-3 text-sm font-semibold text-on-surface outline-none transition-all duration-300 focus:border-primary focus:ring-2 focus:ring-primary/20"
                            id={titleInputId}
                            maxLength={120}
                            onChange={(event) => updateField("title", event.target.value)}
                            required
                            type="text"
                            value={formState.title}
                        />
                    </label>
                    <label className="space-y-2" htmlFor={descriptionInputId}>
                        <span className="block font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                            Descripción
                        </span>
                        <textarea
                            className="min-h-24 w-full resize-none rounded-lg border border-outline-variant/15 bg-surface-container-lowest px-4 py-3 text-sm font-semibold text-on-surface outline-none transition-all duration-300 focus:border-primary focus:ring-2 focus:ring-primary/20"
                            id={descriptionInputId}
                            maxLength={500}
                            onChange={(event) => updateField("description", event.target.value)}
                            value={formState.description}
                        />
                    </label>
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <label className="space-y-2" htmlFor={dateInputId}>
                        <span className="block font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                            Fecha
                        </span>
                        <input
                            className="w-full rounded-lg border border-outline-variant/15 bg-surface-container-lowest px-4 py-3 text-sm font-semibold text-on-surface outline-none transition-all duration-300 focus:border-primary focus:ring-2 focus:ring-primary/20"
                            id={dateInputId}
                            onChange={(event) => updateField("date", event.target.value)}
                            type="date"
                            value={formState.date}
                        />
                    </label>
                    <StatusSelect status={formState.status} onChange={(value) => updateField("status", value)} />
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-3">
                    <label className="space-y-2" htmlFor={startTimeInputId}>
                        <span className="block font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                            Inicio
                        </span>
                        <input
                            className="w-full rounded-lg border border-outline-variant/15 bg-surface-container-lowest px-4 py-3 text-sm font-semibold text-on-surface outline-none transition-all duration-300 focus:border-primary focus:ring-2 focus:ring-primary/20"
                            id={startTimeInputId}
                            onChange={(event) => updateField("startTime", event.target.value)}
                            type="time"
                            value={formState.startTime}
                        />
                    </label>
                    <label className="space-y-2" htmlFor={endTimeInputId}>
                        <span className="block font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                            Fin
                        </span>
                        <input
                            className="w-full rounded-lg border border-outline-variant/15 bg-surface-container-lowest px-4 py-3 text-sm font-semibold text-on-surface outline-none transition-all duration-300 focus:border-primary focus:ring-2 focus:ring-primary/20"
                            id={endTimeInputId}
                            onChange={(event) => updateField("endTime", event.target.value)}
                            type="time"
                            value={formState.endTime}
                        />
                    </label>
                    <label className="space-y-2" htmlFor={durationInputId}>
                        <span className="block font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                            Duración
                        </span>
                        <input
                            className="w-full rounded-lg border border-outline-variant/15 bg-surface-container-lowest px-4 py-3 text-sm font-semibold text-on-surface outline-none transition-all duration-300 focus:border-primary focus:ring-2 focus:ring-primary/20"
                            id={durationInputId}
                            min={1}
                            onChange={(event) => updateField("durationMinutes", event.target.value)}
                            placeholder="Min"
                            type="number"
                            value={formState.durationMinutes}
                        />
                    </label>
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <label className="space-y-2" htmlFor={currentCountInputId}>
                        <span className="block font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                            Conteo actual
                        </span>
                        <input
                            aria-describedby={`${currentCountInputId}-help`}
                            className="w-full rounded-lg border border-outline-variant/15 bg-surface-container-lowest px-4 py-3 text-sm font-semibold text-on-surface outline-none transition-all duration-300 focus:border-primary focus:ring-2 focus:ring-primary/20"
                            id={currentCountInputId}
                            max={formState.targetCount || undefined}
                            min={0}
                            onChange={(event) =>
                                updateField(
                                    "currentCount",
                                    clampCounterValue(event.target.value, formState.targetCount),
                                )
                            }
                            type="number"
                            value={formState.currentCount}
                        />
                        <span
                            className="block text-xs text-on-surface-variant"
                            id={`${currentCountInputId}-help`}
                        >
                            {formState.targetCount
                                ? `Entre 0 y ${formState.targetCount}.`
                                : "Sin meta definida."}
                        </span>
                    </label>
                    <label className="space-y-2" htmlFor={targetCountInputId}>
                        <span className="block font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                            Meta de conteo
                        </span>
                        <input
                            className="w-full rounded-lg border border-outline-variant/15 bg-surface-container-lowest px-4 py-3 text-sm font-semibold text-on-surface outline-none transition-all duration-300 focus:border-primary focus:ring-2 focus:ring-primary/20"
                            id={targetCountInputId}
                            min={1}
                            onChange={(event) => updateField("targetCount", event.target.value)}
                            placeholder="Opcional"
                            type="number"
                            value={formState.targetCount}
                        />
                    </label>
                </div>

                <label className="mt-5 block space-y-2" htmlFor={notesInputId}>
                    <span className="block font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                        Notas de esta instancia
                    </span>
                    <textarea
                        className="min-h-20 w-full resize-none rounded-lg border border-outline-variant/15 bg-surface-container-lowest px-4 py-3 text-sm font-semibold text-on-surface outline-none transition-all duration-300 focus:border-primary focus:ring-2 focus:ring-primary/20"
                        id={notesInputId}
                        maxLength={500}
                        onChange={(event) => updateField("notes", event.target.value)}
                        value={formState.notes}
                    />
                </label>

                <div className="mt-5 grid gap-4">
                    <section>
                        <p className="mb-2 font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                            Prioridad
                        </p>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                            {priorities.map((item) => (
                                <button
                                    aria-pressed={formState.priority === item.priority}
                                    className={cn(
                                        "rounded-full border px-3 py-3 text-sm font-bold transition-all duration-300 hover:-translate-y-1 active:scale-95",
                                        formState.priority === item.priority
                                            ? "border-primary/40 bg-primary/15 text-primary shadow-[0_0_20px_rgba(175,162,255,0.18)]"
                                            : "border-outline-variant/15 bg-surface-container-highest text-on-surface-variant",
                                    )}
                                    key={item.priority}
                                    onClick={() => updateField("priority", item.priority)}
                                    type="button"
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    </section>

                    <button
                        aria-pressed={formState.isRequired}
                        className={cn(
                            "flex items-center justify-between rounded-xl border px-4 py-4 text-left transition-all duration-300 hover:-translate-y-1 active:scale-95",
                            formState.isRequired
                                ? "border-primary/40 bg-primary/15 text-primary"
                                : "border-outline-variant/15 bg-surface-container-highest text-on-surface-variant",
                        )}
                        onClick={() => updateField("isRequired", !formState.isRequired)}
                        type="button"
                    >
                        <span>
                            <span className="block font-label text-xs font-bold uppercase tracking-widest">
                                Vital
                            </span>
                            <span className="text-sm">Resaltar esta tarea como requerida.</span>
                        </span>
                        <MaterialIcon
                            name={formState.isRequired ? "check_circle" : "radio_button_unchecked"}
                            filled={formState.isRequired}
                        />
                    </button>
                </div>
                </fieldset>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
                    <button
                        className="rounded-full border border-outline-variant/15 bg-surface-container-highest px-5 py-3 text-sm font-bold text-on-surface transition-all duration-300 hover:-translate-y-1 active:scale-95"
                        disabled={!canEdit || updateTaskMutation.isPending || !hasChanges}
                        onClick={() => {
                            setFormState(toFormState(task));
                            setApplyToSchedule(false);
                        }}
                        type="button"
                    >
                        Restaurar
                    </button>
                    <button
                        className="rounded-full bg-gradient-to-r from-primary to-primary-dim px-6 py-3 text-sm font-extrabold uppercase tracking-widest text-on-primary shadow-[0_15px_40px_rgba(175,162,255,0.28)] transition-all duration-300 hover:-translate-y-1 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={!canEdit || updateTaskMutation.isPending || !hasChanges}
                        type="submit"
                    >
                        {updateTaskMutation.isPending
                            ? "Guardando..."
                            : applyToSchedule
                              ? "Guardar y aplicar a la rutina"
                              : "Guardar cambios"}
                    </button>
                </div>
            </form>

            {showConfirmModal ? (
                <ConfirmApplyModal
                    isPending={updateTaskMutation.isPending}
                    onCancel={() => setShowConfirmModal(false)}
                    onConfirm={() => submitTaskUpdate(true)}
                    title={task.title}
                />
            ) : null}
        </>
    );
}

function StatusSelect({
    onChange,
    status,
}: {
    onChange: (status: TTaskStatus) => void;
    status: TTaskStatus;
}) {
    const statusInputId = useId();

    return (
        <label className="space-y-2" htmlFor={statusInputId}>
            <span className="block font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                Estado
            </span>
            <select
                className="w-full rounded-lg border border-outline-variant/15 bg-surface-container-lowest px-4 py-3 text-sm font-semibold text-on-surface outline-none transition-all duration-300 focus:border-primary focus:ring-2 focus:ring-primary/20"
                id={statusInputId}
                onChange={(event) => onChange(event.target.value as TTaskStatus)}
                value={status}
            >
                {taskStatuses.map((item) => (
                    <option key={item.status} value={item.status}>
                        {item.label}
                    </option>
                ))}
            </select>
        </label>
    );
}

function ConfirmApplyModal({
    isPending,
    onCancel,
    onConfirm,
    title,
}: {
    isPending: boolean;
    onCancel: () => void;
    onConfirm: () => void;
    title: string;
}) {
    return (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-surface-container-lowest/70 px-4 pb-6 backdrop-blur-sm md:items-center">
            <section className="w-full max-w-md rounded-xl border border-outline-variant/15 bg-surface-container-low p-6 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
                <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-tertiary/10 text-tertiary">
                        <MaterialIcon name="warning_amber" className="text-2xl" />
                    </div>
                    <div>
                        <h3 className="font-headline text-xl font-bold text-on-surface">
                            Aplicar a la rutina
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                            Esto actualizará la rutina "{title}". Las próximas instancias usarán
                            esta nueva configuración. ¿Continuar?
                        </p>
                    </div>
                </div>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
                    <button
                        className="rounded-full border border-outline-variant/15 bg-surface-container-highest px-5 py-3 text-sm font-bold text-on-surface transition-all duration-300 hover:-translate-y-1 active:scale-95"
                        disabled={isPending}
                        onClick={onCancel}
                        type="button"
                    >
                        Cancelar
                    </button>
                    <button
                        className="rounded-full bg-gradient-to-r from-primary to-primary-dim px-6 py-3 text-sm font-extrabold uppercase tracking-widest text-on-primary shadow-[0_15px_40px_rgba(175,162,255,0.28)] transition-all duration-300 hover:-translate-y-1 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={isPending}
                        onClick={onConfirm}
                        type="button"
                    >
                        {isPending ? "Aplicando..." : "Aplicar a la rutina"}
                    </button>
                </div>
            </section>
        </div>
    );
}

interface DetailMetricProps {
    icon: string;
    label: string;
    value: string;
}

function DetailMetric({ icon, label, value }: DetailMetricProps) {
    return (
        <article className="rounded-xl border border-outline-variant/10 bg-surface-container-high p-4">
            <MaterialIcon name={icon} className="text-xl text-tertiary" />
            <p className="mt-3 font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                {label}
            </p>
            <p className="mt-1 font-display text-lg font-black tracking-tighter text-on-surface tabular-nums">
                {value}
            </p>
        </article>
    );
}

function TaskDetailLoading() {
    return (
        <section className="space-y-4">
            <div className="h-56 animate-pulse rounded-xl bg-surface-container-low" />
            <div className="h-96 animate-pulse rounded-xl bg-surface-container-low" />
        </section>
    );
}

function TaskDetailError({ error }: { error: Error | null }) {
    return (
        <section className="rounded-xl border border-error-dim/30 bg-error-container/10 p-6 text-error">
            <div className="flex items-center gap-2">
                <MaterialIcon name="error" filled />
                <p>{error?.message || "No se pudo cargar la tarea"}</p>
            </div>
        </section>
    );
}

function formatDate(date: Date) {
    return date.toLocaleDateString("es-MX", {
        day: "2-digit",
        month: "short",
        weekday: "short",
    });
}

function formatDuration(duration: number | null) {
    if (!duration || duration <= 0) {
        return "Sin duración";
    }
    return `${duration} min`;
}

function formatScheduledRange(task: TTask) {
    if (task.startTime && task.endTime) {
        return `${formatStartTime(task.startTime)} - ${formatStartTime(task.endTime)}`;
    }
    if (task.startTime) {
        return formatStartTime(task.startTime);
    }
    return "Sin horario";
}

function getStatusMeta(status: TTaskStatus) {
    switch (status) {
        case "completed":
            return {
                className: "border-tertiary/30 bg-tertiary/10 text-tertiary",
                icon: "done_all",
                label: "Completada",
            };
        case "in_progress":
            return {
                className: "border-primary/30 bg-primary/10 text-primary",
                icon: "play_arrow",
                label: "En progreso",
            };
        case "failed":
            return {
                className: "border-error-dim/30 bg-error-container/10 text-error",
                icon: "error",
                label: "Fallida",
            };
        case "skipped":
            return {
                className: "border-error/20 bg-error/10 text-error",
                icon: "skip_next",
                label: "Omitida",
            };
        case "pending":
        default:
            return {
                className: "border-primary/25 bg-primary/10 text-primary",
                icon: "pending_actions",
                label: "Pendiente",
            };
    }
}

function toFormState(task: TTask): TaskFormState {
    return {
        currentCount: String(task.currentCount ?? 0),
        date: toDateInputValue(task.date),
        description: task.description ?? "",
        durationMinutes: task.duration ? String(task.duration) : "",
        endTime: toTimeInputValue(task.endTime),
        isRequired: task.isRequired || task.required,
        notes: task.notes ?? "",
        priority: task.priority,
        startTime: toTimeInputValue(task.startTime),
        status: task.status,
        targetCount: task.targetCount ? String(task.targetCount) : "",
        title: task.title,
    };
}

function toDateInputValue(date: Date) {
    return date.toISOString().slice(0, 10);
}

function toTimeInputValue(date: Date | null) {
    if (!date) {
        return "";
    }
    return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function toApiDate(date: string) {
    return `${date}T12:00:00Z`;
}

function toOptionalNumber(value: string) {
    if (value.trim() === "") {
        return undefined;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
}

function emptyToUndefined(value: string) {
    return value.trim() === "" ? undefined : value;
}

function clampCounterValue(rawValue: string, targetCountString: string): string {
    if (rawValue.trim() === "") {
        return "";
    }
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) {
        return "";
    }
    const target = Number(targetCountString);
    const hasTarget = Number.isFinite(target) && target > 0;
    const clamped = hasTarget ? Math.min(Math.max(parsed, 0), target) : Math.max(parsed, 0);
    return String(Math.floor(clamped));
}
