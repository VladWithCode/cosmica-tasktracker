import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Ban, Check, CircleDot, CircleX, Clock, EyeOff, RotateCcw, Trash } from "lucide-react";
import type { TaskDetail, TaskStatus } from "@/api/schemas";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { InlineTextArea } from "@/components/ui/Field";
import { GroupedRow, GroupedSection } from "@/components/ui/GroupedList";
import { Sheet } from "@/components/ui/Sheet";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatDay } from "@/lib/date";
import { haptic } from "@/lib/haptics";
import { spring } from "@/lib/motion";
import { formatDuration, scheduleLabel, statusForCount, statusLabels } from "@/lib/tasks";
import { useAccessForUser } from "@/queries/owner";
import { useDeleteTask, usePingTask, useTask, useUpdateTask } from "@/queries/tasks";
import { toast } from "@/stores/toast";
import { CounterControl } from "./CounterControl";
import { TaskEditForm } from "./TaskEditForm";

const statusIcons: Record<TaskStatus, typeof Check> = {
    pending: RotateCcw,
    in_progress: CircleDot,
    completed: Check,
    skipped: Ban,
    failed: CircleX,
    dismissed: EyeOff,
};

const statusIconClass: Record<TaskStatus, string> = {
    pending: "text-label-secondary",
    in_progress: "text-warning",
    completed: "text-success",
    skipped: "text-label-secondary",
    failed: "text-danger",
    dismissed: "text-dismissed",
};

const statusOrder: TaskStatus[] = ["pending", "in_progress", "completed", "skipped", "failed", "dismissed"];

type TaskSheetProps = { taskId: string | undefined; onClose: () => void };

export function TaskSheet({ taskId, onClose }: TaskSheetProps) {
    const query = useTask(taskId);
    const [editing, setEditing] = useState(false);

    useEffect(() => {
        if (!taskId) setEditing(false);
    }, [taskId]);

    return (
        <Sheet
            open={Boolean(taskId)}
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
            title={editing ? "Editar tarea" : (query.data?.title ?? "Tarea")}
            description="Detalle de la tarea"
        >
            {query.isPending ? <TaskSheetSkeleton /> : null}
            {query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : null}
            {query.data ? (
                editing ? (
                    <EditView task={query.data} onDone={() => setEditing(false)} />
                ) : (
                    <DetailView task={query.data} onEdit={() => setEditing(true)} onDeleted={onClose} />
                )
            ) : null}
        </Sheet>
    );
}

function TaskSheetSkeleton() {
    return (
        <div className="flex flex-col gap-4 px-4 pt-2">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-48 w-full rounded-card" />
        </div>
    );
}

function EditView({ task, onDone }: { task: TaskDetail; onDone: () => void }) {
    const update = useUpdateTask(task.id);
    return (
        <TaskEditForm
            task={task}
            saving={update.isPending}
            onCancel={onDone}
            onSave={(changes) =>
                update.mutate(changes, {
                    onSuccess: () => {
                        toast.show(changes.applyToSchedule ? "Rutina actualizada" : "Tarea actualizada");
                        onDone();
                    },
                })
            }
        />
    );
}

function DetailView({ task, onEdit, onDeleted }: { task: TaskDetail; onEdit: () => void; onDeleted: () => void }) {
    const update = useUpdateTask(task.id);
    const remove = useDeleteTask();
    const [notes, setNotes] = useState(task.notes);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const canEdit = task.canEdit;
    const isOneOff = task.frequency === "custom";
    const access = useAccessForUser(task.userId);

    useEffect(() => setNotes(task.notes), [task.notes]);

    const setStatus = (status: TaskStatus) => {
        if (status === task.status) return;
        if (status === "completed") haptic();
        const count = status === "completed" && task.targetCount !== null ? { currentCount: Math.max(task.currentCount, task.targetCount) } : {};
        update.mutate({ status, ...count });
    };

    const setCount = (count: number) => {
        const status = statusForCount(count, task.targetCount, task.status);
        if (status === "completed" && task.status !== "completed") haptic();
        update.mutate({ currentCount: count, ...(status !== task.status ? { status } : {}) });
    };

    const saveNotes = () => {
        const trimmed = notes.trim();
        if (trimmed !== task.notes) update.mutate({ notes: trimmed });
    };

    const details: { label: string; value: string }[] = [];
    details.push({ label: "Horario", value: scheduleLabel(task) });
    if (task.durationMinutes && task.startTime) details.push({ label: "Duración", value: formatDuration(task.durationMinutes) });
    if (task.date) details.push({ label: "Fecha", value: formatDay(task.date) });
    if (task.category) details.push({ label: "Categoría", value: task.category });
    if (task.actualStart) details.push({ label: "Inicio real", value: new Date(task.actualStart).toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit" }) });
    if (task.completedAt) details.push({ label: "Completada", value: new Date(task.completedAt).toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit" }) });

    return (
        <div className="flex flex-col">
            <div className="flex flex-wrap items-center gap-2 px-4 pb-1">
                <span className="inline-flex items-center gap-1 text-footnote text-label-secondary">
                    <Clock aria-hidden className="size-3.5" />
                    {scheduleLabel(task)}
                </span>
                {task.isRequired ? <span className="rounded-full bg-accent-soft px-2 py-0.5 text-caption text-accent">Imprescindible</span> : null}
                {task.priority === "urgent" ? <span className="rounded-full bg-danger-soft px-2 py-0.5 text-caption text-danger">Urgente</span> : null}
            </div>
            {task.description ? <p className="px-4 pt-2 text-body text-label-secondary">{task.description}</p> : null}

            {task.targetCount !== null ? (
                <div className="flex justify-center px-4 pt-5 pb-1">
                    <CounterControl size="lg" value={task.currentCount} target={task.targetCount} onChange={setCount} disabled={!canEdit} title={task.title} />
                </div>
            ) : null}

            <GroupedSection title="Estado" footer={isOneOff ? undefined : "«Descartada» la quita de hoy sin borrar la rutina; cuenta en tu progreso aparte de las omitidas."}>
                <div role="radiogroup" aria-label="Estado">
                    {statusOrder.map((status) => {
                        const Icon = statusIcons[status];
                        const selected = task.status === status;
                        return (
                            <div key={status} className="border-separator [&+&]:border-t">
                                <GroupedRow
                                    icon={<Icon aria-hidden className={`size-5 ${statusIconClass[status]}`} />}
                                    label={statusLabels[status]}
                                    disabled={!canEdit}
                                    onPress={() => setStatus(status)}
                                    trailing={selected ? <Check aria-label="Seleccionado" className="size-5 text-accent" strokeWidth={2.5} /> : null}
                                />
                            </div>
                        );
                    })}
                </div>
            </GroupedSection>

            {access.canPing && task.status !== "completed" ? <PingSection taskId={task.id} ownerName={access.name} /> : null}

            <GroupedSection title="Notas" footer={canEdit ? "Se guardan al salir del campo." : undefined}>
                <InlineTextArea
                    label="Añade una nota"
                    value={notes}
                    disabled={!canEdit}
                    onChange={(event) => setNotes(event.target.value)}
                    onBlur={saveNotes}
                    maxLength={1000}
                />
            </GroupedSection>

            <GroupedSection title="Detalles">
                {details.map((item) => (
                    <GroupedRow key={item.label} label={item.label} detail={item.value} />
                ))}
            </GroupedSection>

            {canEdit ? (
                <div className="flex flex-col gap-3 px-4 pt-8">
                    <Button variant="tinted" size="lg" onClick={onEdit}>
                        Editar
                    </Button>
                    {isOneOff ? <AnimatePresence initial={false} mode="popLayout">
                        {confirmDelete ? (
                            <motion.div
                                key="confirm"
                                initial={{ opacity: 0, scale: 0.96 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.96 }}
                                transition={spring.default}
                                className="flex flex-col gap-2 rounded-card bg-bg-elevated p-4"
                            >
                                <p className="text-callout">Se eliminará esta tarea. Esta acción no se puede deshacer.</p>
                                <div className="flex gap-2">
                                    <Button variant="tinted" className="flex-1" onClick={() => setConfirmDelete(false)}>
                                        Cancelar
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        className="flex-1"
                                        loading={remove.isPending}
                                        onClick={() =>
                                            remove.mutate(task.id, {
                                                onSuccess: () => {
                                                    toast.show("Tarea eliminada");
                                                    onDeleted();
                                                },
                                            })
                                        }
                                    >
                                        Eliminar
                                    </Button>
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div key="trigger" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                <Button variant="destructive" size="lg" onClick={() => setConfirmDelete(true)}>
                                    <Trash aria-hidden className="size-5" />
                                    Eliminar tarea
                                </Button>
                            </motion.div>
                        )}
                    </AnimatePresence> : null}
                </div>
            ) : null}
        </div>
    );
}

function PingSection({ taskId, ownerName }: { taskId: string; ownerName: string | null }) {
    const [message, setMessage] = useState("");
    const ping = usePingTask();
    return (
        <GroupedSection title="Recordatorio" footer={`${ownerName ?? "La persona"} recibirá una notificación.`}>
            <InlineTextArea label="Mensaje opcional" rows={2} maxLength={280} value={message} onChange={(event) => setMessage(event.target.value)} />
            <div className="px-4 py-2.5">
                <Button
                    variant="tinted"
                    className="w-full"
                    loading={ping.isPending}
                    onClick={() => ping.mutate({ id: taskId, message: message.trim() }, { onSuccess: () => setMessage("") })}
                >
                    Enviar recordatorio
                </Button>
            </div>
        </GroupedSection>
    );
}
