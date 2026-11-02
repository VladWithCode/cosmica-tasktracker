import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft } from "lucide-react";
import { Screen } from "@/components/shell/Screen";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { FieldRow } from "@/components/ui/Field";
import { GroupedSection } from "@/components/ui/GroupedList";
import { Skeleton } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { TaskForm } from "@/features/create/TaskForm";
import { toScheduleInput } from "@/features/create/createForm";
import { spring } from "@/lib/motion";
import { scheduleToValues } from "@/lib/schedules";
import { useCancelSchedule, useSchedule, useSetSchedulePaused, useUpdateSchedule } from "@/queries/schedules";
import { useSession } from "@/queries/session";
import { toast } from "@/stores/toast";

function BackLink() {
    return (
        <Link to="/routines" className="-ml-1 flex min-h-11 items-center pr-2 text-body text-accent active:opacity-60">
            <ChevronLeft aria-hidden className="size-6" strokeWidth={2.2} />
            Rutinas
        </Link>
    );
}

export function RoutineDetailScreen({ id }: { id: string }) {
    const user = useSession();
    const query = useSchedule(id);
    const schedule = query.data;
    const readOnly = schedule ? schedule.userId !== user.id : true;

    return (
        <Screen title={schedule?.title ?? "Rutina"} leading={<BackLink />} largeTitle={false}>
            {query.isPending ? (
                <div className="flex flex-col gap-3 px-4 pt-4">
                    <Skeleton className="h-24 rounded-card" />
                    <Skeleton className="h-64 rounded-card" />
                </div>
            ) : null}
            {query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : null}
            {schedule ? <RoutineEditor key={schedule.id} id={id} readOnly={readOnly} /> : null}
        </Screen>
    );
}

function RoutineEditor({ id, readOnly }: { id: string; readOnly: boolean }) {
    const navigate = useNavigate();
    const schedule = useSchedule(id).data;
    const update = useUpdateSchedule(id);
    const setPaused = useSetSchedulePaused();
    const cancel = useCancelSchedule();
    const [confirmCancel, setConfirmCancel] = useState(false);
    if (!schedule) return null;
    const paused = schedule.status === "paused";

    return (
        <div className="flex flex-col pt-2">
            <GroupedSection footer={paused ? "En pausa no se crean tareas nuevas. Las de días anteriores se conservan." : undefined}>
                <FieldRow label="Activa">
                    <Switch
                        label="Rutina activa"
                        checked={!paused}
                        disabled={readOnly || setPaused.isPending}
                        onChange={(checked) => setPaused.mutate({ id, paused: !checked })}
                    />
                </FieldRow>
            </GroupedSection>

            <TaskForm
                mode="edit"
                readOnly={readOnly}
                defaultValues={scheduleToValues(schedule)}
                pending={update.isPending}
                error={update.error}
                submitLabel="Guardar cambios"
                onSubmit={(values) =>
                    update.mutate(toScheduleInput(values), {
                        onSuccess: () => toast.show("Rutina actualizada"),
                    })
                }
            />

            {readOnly ? (
                <p className="px-8 pt-2 text-footnote text-label-secondary">Esta rutina es de otra persona. Solo quien la tiene puede editarla.</p>
            ) : (
                <div className="px-4 pt-6">
                    <AnimatePresence initial={false} mode="popLayout">
                        {confirmCancel ? (
                            <motion.div
                                key="confirm"
                                initial={{ opacity: 0, scale: 0.96 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.96 }}
                                transition={spring.default}
                                className="flex flex-col gap-2 rounded-card bg-bg-elevated p-4"
                            >
                                <p className="text-callout">
                                    La rutina deja de crear tareas. Tu historial se conserva, pero no podrás reactivarla.
                                </p>
                                <div className="flex gap-2">
                                    <Button variant="tinted" className="flex-1" onClick={() => setConfirmCancel(false)}>
                                        Volver
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        className="flex-1"
                                        loading={cancel.isPending}
                                        onClick={() =>
                                            cancel.mutate(id, {
                                                onSuccess: () => {
                                                    toast.show("Rutina cancelada");
                                                    void navigate({ to: "/routines" });
                                                },
                                            })
                                        }
                                    >
                                        Cancelar rutina
                                    </Button>
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div key="trigger" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                <Button variant="destructive" size="lg" onClick={() => setConfirmCancel(true)}>
                                    Cancelar rutina
                                </Button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}
        </div>
    );
}
