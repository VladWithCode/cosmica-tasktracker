import { useEffect, useState } from "react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import { ChevronUp, Flame } from "lucide-react";
import type { TaskItem } from "@/api/schemas";
import { cn } from "@/lib/cn";
import { fade, spring } from "@/lib/motion";
import { scheduleLabel } from "@/lib/tasks";
import { useTaskActions } from "@/features/task/useTaskActions";

const PEEK = 12;
const MAX_PEEKING = 2;

type VitalStackProps = {
    tasks: TaskItem[];
    canEdit: boolean;
    onOpenTask: (id: string) => void;
};

function progressLabel(task: TaskItem): string {
    const parts = [scheduleLabel(task)];
    if (task.targetCount !== null) parts.unshift(`${task.currentCount} de ${task.targetCount}`);
    if (task.status === "in_progress") parts.unshift("En curso");
    return parts.join(" · ");
}

function VitalCheck({ task, canEdit }: { task: TaskItem; canEdit: boolean }) {
    const { toggle } = useTaskActions(task);
    return (
        <motion.button
            type="button"
            aria-label={`Completar «${task.title}»`}
            disabled={!canEdit}
            onClick={(event) => {
                event.stopPropagation();
                toggle();
            }}
            whileTap={{ scale: 0.86 }}
            transition={spring.snappy}
            className="-m-2 flex size-12 shrink-0 items-center justify-center disabled:opacity-50"
        >
            <span className="flex size-7 items-center justify-center rounded-full border-2 border-on-accent/90">
                {task.status === "in_progress" ? <span aria-hidden className="size-2.5 rounded-full bg-on-accent" /> : null}
            </span>
        </motion.button>
    );
}

type CardProps = {
    task: TaskItem;
    index: number;
    expanded: boolean;
    canEdit: boolean;
    onActivate: () => void;
    activateLabel: string;
};

function VitalCard({ task, index, expanded, canEdit, onActivate, activateLabel }: CardProps) {
    const reduceMotion = useReducedMotion();
    const behind = !expanded && index > 0;
    const hidden = !expanded && index > MAX_PEEKING;
    const depth = Math.min(index, MAX_PEEKING);

    return (
        <motion.li
            layout={!reduceMotion}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{
                opacity: hidden ? 0 : behind ? 1 - depth * 0.2 : 1,
                scale: behind ? 1 - depth * 0.045 : 1,
                y: behind ? depth * PEEK : 0,
            }}
            exit={reduceMotion ? { opacity: 0, transition: fade } : { opacity: 0, scale: 1.04, transition: spring.snappy }}
            transition={reduceMotion ? fade : spring.default}
            aria-hidden={behind || undefined}
            style={{ zIndex: 10 - index, transformOrigin: "50% 100%" }}
            className={cn(behind ? "pointer-events-none absolute inset-x-0 top-0" : "relative")}
        >
            <div className="flex items-center gap-3 rounded-sheet bg-accent p-4 text-on-accent shadow-[0_12px_32px_color-mix(in_oklab,var(--color-accent)_38%,transparent),0_2px_6px_rgb(0_0_0/0.12)]">
                {behind ? <span className="size-8 shrink-0" /> : <VitalCheck task={task} canEdit={canEdit} />}
                <button type="button" tabIndex={behind ? -1 : 0} onClick={onActivate} aria-label={activateLabel} className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left">
                    <span className="w-full truncate text-headline">{task.title}</span>
                    <span className="w-full truncate text-footnote text-on-accent/85">{progressLabel(task)}</span>
                </button>
            </div>
        </motion.li>
    );
}

export function VitalStack({ tasks, canEdit, onOpenTask }: VitalStackProps) {
    const reduceMotion = useReducedMotion();
    const [expanded, setExpanded] = useState(false);
    const stacked = tasks.length > 1 && !expanded;

    useEffect(() => {
        if (tasks.length <= 1) setExpanded(false);
    }, [tasks.length]);

    return (
        <AnimatePresence initial={false}>
            {tasks.length > 0 ? (
                <motion.section
                    key="vital"
                    aria-labelledby="vital-heading"
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={reduceMotion ? fade : spring.default}
                    className="px-4 pb-2"
                >
                    <div className="flex min-h-11 items-center gap-2 px-1">
                        <Flame aria-hidden className="size-5 text-accent" />
                        <h2 id="vital-heading" className="flex-1 text-headline">
                            Sí o sí <span className="font-normal text-label-secondary">· {tasks.length} {tasks.length === 1 ? "imprescindible" : "imprescindibles"}</span>
                        </h2>
                        {tasks.length > 1 && expanded ? (
                            <button
                                type="button"
                                onClick={() => setExpanded(false)}
                                className="flex min-h-11 items-center gap-1 px-1 text-footnote font-semibold text-accent"
                            >
                                Agrupar
                                <ChevronUp aria-hidden className="size-4" />
                            </button>
                        ) : null}
                    </div>
                    <LayoutGroup>
                        <motion.ul
                            layout={!reduceMotion}
                            transition={reduceMotion ? fade : spring.default}
                            className={cn("relative flex flex-col", expanded ? "gap-2.5" : "gap-0")}
                            style={{ paddingBottom: stacked ? Math.min(tasks.length - 1, MAX_PEEKING) * PEEK : 0 }}
                        >
                            <AnimatePresence initial={false} mode="popLayout">
                                {tasks.map((task, index) => (
                                    <VitalCard
                                        key={task.id}
                                        task={task}
                                        index={index}
                                        expanded={!stacked}
                                        canEdit={canEdit}
                                        activateLabel={stacked ? `Ver las ${tasks.length} imprescindibles` : `Abrir «${task.title}»`}
                                        onActivate={() => (stacked ? setExpanded(true) : onOpenTask(task.id))}
                                    />
                                ))}
                            </AnimatePresence>
                        </motion.ul>
                    </LayoutGroup>
                </motion.section>
            ) : null}
        </AnimatePresence>
    );
}
