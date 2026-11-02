import { useMemo, useState } from "react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import { ChevronRight, Sun } from "lucide-react";
import type { Schedule, TaskItem } from "@/api/schemas";
import { CreateButton } from "@/components/shell/CreateButton";
import { Screen } from "@/components/shell/Screen";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { PullToRefresh } from "@/components/ui/PullToRefresh";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import { formatDay, todayISO } from "@/lib/date";
import { fade, spring } from "@/lib/motion";
import { groupTasks, summarize } from "@/lib/tasks";
import { useSchedules, useTodayTasks } from "@/queries/tasks";
import { useCreateStore } from "@/stores/create";
import { useOwnerStore } from "@/stores/owner";
import { TaskRow, type WaterConfig } from "@/features/task/TaskRow";
import { TaskSheet } from "@/features/task/TaskSheet";

type TodayScreenProps = { taskId?: string; onOpenTask: (id: string) => void; onCloseTask: () => void };

export function waterConfigs(schedules: Schedule[] | undefined): Map<string, WaterConfig> {
    const map = new Map<string, WaterConfig>();
    for (const schedule of schedules ?? []) {
        const config = schedule.frequencyConfig;
        if ("waterUnit" in config || "waterReminder" in config) {
            map.set(schedule.id, { unit: typeof config.waterUnit === "string" && config.waterUnit ? config.waterUnit : "L" });
        }
    }
    return map;
}

export function TodayScreen({ taskId, onOpenTask, onCloseTask }: TodayScreenProps) {
    const ownerId = useOwnerStore((state) => state.ownerId);
    const openCreate = useCreateStore((state) => state.openCreate);
    const today = useTodayTasks(ownerId);
    const schedules = useSchedules(ownerId);
    const water = useMemo(() => waterConfigs(schedules.data), [schedules.data]);
    const tasks = today.data?.tasks;

    return (
        <Screen title="Hoy" actions={<CreateButton />} titleAccessory={<p className="text-callout text-label-secondary">{formatDay(today.data?.date || todayISO())}</p>}>
            <PullToRefresh onRefresh={() => Promise.all([today.refetch(), schedules.refetch()])}>
                {today.isPending ? <TodaySkeleton /> : null}
                {today.isError ? <ErrorState error={today.error} onRetry={() => void today.refetch()} /> : null}
                {tasks && tasks.length === 0 ? (
                    <EmptyState
                        icon={Sun}
                        title="Nada para hoy"
                        message="Crea una tarea o una rutina y aparecerá aquí."
                        action={<Button onClick={() => openCreate()}>Nueva tarea</Button>}
                    />
                ) : null}
                {tasks && tasks.length > 0 ? <TodayList tasks={tasks} water={water} canEdit onOpenTask={onOpenTask} /> : null}
            </PullToRefresh>
            <TaskSheet taskId={taskId} onClose={onCloseTask} />
        </Screen>
    );
}

function TodaySkeleton() {
    return (
        <div className="flex flex-col gap-3 px-4 pt-2" aria-busy>
            <Skeleton className="h-24 rounded-card" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-44 rounded-card" />
        </div>
    );
}

function SummaryCard({ tasks }: { tasks: TaskItem[] }) {
    const summary = summarize(tasks);
    const ratio = summary.total ? summary.completed / summary.total : 0;
    const allDone = summary.total > 0 && summary.completed === summary.total;
    return (
        <section aria-label="Progreso del día" className="mx-4 mt-1 flex items-center gap-4 rounded-card bg-bg-elevated p-4">
            <ProgressRing value={ratio} label={`${Math.round(summary.percentage)}% completado`} />
            <div className="flex min-w-0 flex-col gap-0.5">
                <p className="text-headline">
                    {allDone ? "¡Día completado!" : `${summary.completed} de ${summary.total} completadas`}
                </p>
                <p className="tabular text-footnote text-label-secondary">
                    {Math.round(summary.percentage)}%
                    {summary.required > 0 ? ` · Imprescindibles ${summary.requiredCompleted}/${summary.required}` : ""}
                </p>
            </div>
        </section>
    );
}

type TodayListProps = { tasks: TaskItem[]; water: Map<string, WaterConfig>; canEdit: boolean; onOpenTask: (id: string) => void };

export function TodayList({ tasks, water, canEdit, onOpenTask }: TodayListProps) {
    const reduceMotion = useReducedMotion();
    const [showDone, setShowDone] = useState(false);
    const { sections, done } = groupTasks(tasks);
    const rowTransition = reduceMotion ? fade : spring.default;

    const renderRow = (task: TaskItem) => (
        <motion.li
            key={task.id}
            layout="position"
            layoutId={`task-${task.id}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: fade }}
            transition={rowTransition}
            className="[&+&]:border-t [&+&]:border-separator"
        >
            <TaskRow task={task} canEdit={canEdit} water={water.get(task.scheduleId)} onOpen={onOpenTask} />
        </motion.li>
    );

    return (
        <LayoutGroup>
            <SummaryCard tasks={tasks} />
            {sections.map((section) => (
                <motion.section key={section.id} layout="position" transition={rowTransition} className="px-4 pt-5" aria-labelledby={`section-${section.id}`}>
                    <h2 id={`section-${section.id}`} className="px-4 pb-1.5 text-footnote font-medium text-label-secondary">
                        {section.title}
                    </h2>
                    <ul className="overflow-hidden rounded-card bg-bg-elevated">
                        <AnimatePresence initial={false}>{section.tasks.map(renderRow)}</AnimatePresence>
                    </ul>
                </motion.section>
            ))}
            {sections.length === 0 && done.length > 0 ? (
                <p className="px-8 pt-6 text-center text-callout text-label-secondary">No quedan tareas pendientes.</p>
            ) : null}
            {done.length > 0 ? (
                <motion.section layout="position" transition={rowTransition} className="px-4 pt-5">
                    <button
                        type="button"
                        aria-expanded={showDone}
                        onClick={() => setShowDone((value) => !value)}
                        className="flex min-h-11 w-full items-center gap-1 px-4 text-footnote font-medium text-label-secondary"
                    >
                        <ChevronRight aria-hidden className={cn("size-4 transition-transform motion-reduce:transition-none", showDone && "rotate-90")} />
                        Terminadas ({done.length})
                    </button>
                    <AnimatePresence initial={false}>
                        {showDone ? (
                            <motion.ul
                                key="done"
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={rowTransition}
                                className="overflow-hidden rounded-card bg-bg-elevated"
                            >
                                <AnimatePresence initial={false}>{done.map(renderRow)}</AnimatePresence>
                            </motion.ul>
                        ) : null}
                    </AnimatePresence>
                </motion.section>
            ) : null}
        </LayoutGroup>
    );
}
