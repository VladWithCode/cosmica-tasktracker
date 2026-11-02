import { useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronRight, Pause, Play, Repeat } from "lucide-react";
import type { Schedule } from "@/api/schemas";
import { OwnerSwitcher } from "@/components/shell/OwnerSwitcher";
import { Screen } from "@/components/shell/Screen";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { PullToRefresh } from "@/components/ui/PullToRefresh";
import { Skeleton } from "@/components/ui/Skeleton";
import { SwipeRow } from "@/components/ui/SwipeRow";
import { fade, spring } from "@/lib/motion";
import { compareSchedules, goalSummary, isOneOffSchedule, repeatSummary } from "@/lib/schedules";
import { useSchedules, useSetSchedulePaused } from "@/queries/schedules";
import { useCreateStore } from "@/stores/create";
import { useOwnerStore } from "@/stores/owner";

export function RoutinesScreen() {
    const ownerId = useOwnerStore((state) => state.ownerId);
    const schedules = useSchedules(ownerId);
    const openCreate = useCreateStore((state) => state.openCreate);
    const readOnly = ownerId !== null;
    const routines = (schedules.data ?? []).filter((schedule) => schedule.status !== "cancelled" && !isOneOffSchedule(schedule))
        .sort(compareSchedules);
    const active = routines.filter((schedule) => schedule.status === "active");
    const paused = routines.filter((schedule) => schedule.status === "paused");

    return (
        <Screen title="Rutinas" titleAccessory={<OwnerSwitcher />}>
            <PullToRefresh onRefresh={() => schedules.refetch()}>
                {schedules.isPending ? (
                    <div className="flex flex-col gap-3 px-4 pt-2">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-56 rounded-card" />
                    </div>
                ) : null}
                {schedules.isError ? <ErrorState error={schedules.error} onRetry={() => void schedules.refetch()} /> : null}
                {schedules.data && routines.length === 0 ? (
                    <EmptyState
                        icon={Repeat}
                        title="Sin rutinas"
                        message="Las rutinas se repiten y crean tus tareas de cada día."
                        action={readOnly ? undefined : <Button onClick={() => openCreate()}>Nueva rutina</Button>}
                    />
                ) : null}
                {readOnly && routines.length > 0 ? (
                    <p className="px-8 pb-1 text-footnote text-label-secondary">Solo lectura: las rutinas compartidas no se pueden editar desde aquí.</p>
                ) : null}
                <RoutineGroup title="Activas" schedules={active} readOnly={readOnly} />
                <RoutineGroup title="En pausa" schedules={paused} readOnly={readOnly} />
            </PullToRefresh>
        </Screen>
    );
}

function RoutineGroup({ title, schedules, readOnly }: { title: string; schedules: Schedule[]; readOnly: boolean }) {
    const reduceMotion = useReducedMotion();
    if (schedules.length === 0) return null;
    return (
        <motion.section layout="position" transition={reduceMotion ? fade : spring.default} className="px-4 pt-7 first:pt-2">
            <h2 className="px-4 pb-1.5 text-footnote font-medium text-label-secondary">{title}</h2>
            <ul className="overflow-hidden rounded-card bg-bg-elevated">
                <AnimatePresence initial={false}>
                    {schedules.map((schedule) => (
                        <motion.li
                            key={schedule.id}
                            layout="position"
                            layoutId={`routine-${schedule.id}`}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={reduceMotion ? fade : spring.default}
                            className="[&+&]:border-t [&+&]:border-separator"
                        >
                            <RoutineRow schedule={schedule} readOnly={readOnly} />
                        </motion.li>
                    ))}
                </AnimatePresence>
            </ul>
        </motion.section>
    );
}

function RoutineRow({ schedule, readOnly }: { schedule: Schedule; readOnly: boolean }) {
    const navigate = useNavigate();
    const setPaused = useSetSchedulePaused();
    const paused = schedule.status === "paused";
    const goal = goalSummary(schedule);

    return (
        <SwipeRow
            disabled={readOnly}
            trailing={
                readOnly
                    ? []
                    : [
                          {
                              id: paused ? "resume" : "pause",
                              label: paused ? "Reanudar" : "Pausar",
                              icon: paused ? Play : Pause,
                              tone: paused ? "accent" : "warning",
                              onTrigger: () => setPaused.mutate({ id: schedule.id, paused: !paused }),
                          },
                      ]
            }
        >
            <button
                type="button"
                onClick={() => void navigate({ to: "/routines/$id", params: { id: schedule.id } })}
                className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left active:bg-fill-secondary"
            >
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <div className="flex items-center gap-1.5">
                        {schedule.priority === "urgent" ? <span role="img" aria-label="Urgente" className="size-2 shrink-0 rounded-full bg-danger" /> : null}
                        <span className={paused ? "truncate text-body text-label-secondary" : "truncate text-body"}>{schedule.title}</span>
                        {schedule.isRequired ? <span className="shrink-0 rounded-full bg-accent-soft px-1.5 text-caption text-accent">Imprescindible</span> : null}
                    </div>
                    <span className="truncate text-footnote text-label-secondary">
                        {[repeatSummary(schedule), goal].filter(Boolean).join(" · ")}
                    </span>
                </div>
                <ChevronRight aria-hidden className="size-5 shrink-0 text-label-tertiary" />
            </button>
        </SwipeRow>
    );
}
