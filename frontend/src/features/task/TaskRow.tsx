import * as ContextMenu from "@radix-ui/react-context-menu";
import { Ban, Check, CircleDot, CircleX, NotebookPen, RotateCcw, SquarePen } from "lucide-react";
import type { TaskItem, TaskStatus } from "@/api/schemas";
import { SwipeRow, type SwipeAction } from "@/components/ui/SwipeRow";
import { cn } from "@/lib/cn";
import { haptic } from "@/lib/haptics";
import { scheduleLabel, statusForCount, statusLabels } from "@/lib/tasks";
import { useUpdateTask } from "@/queries/tasks";
import { CounterControl } from "./CounterControl";
import { StatusCheck } from "./StatusCheck";
import { WaterBottles } from "./WaterBottles";

export type WaterConfig = { unit: string };

type TaskRowProps = {
    task: TaskItem;
    canEdit: boolean;
    water?: WaterConfig;
    onOpen: (id: string) => void;
};

const menuItem =
    "flex min-h-11 cursor-default items-center gap-3 rounded-[0.5rem] px-3 text-body text-label outline-none select-none data-[highlighted]:bg-fill-secondary data-[disabled]:opacity-40";

export function TaskRow({ task, canEdit, water, onOpen }: TaskRowProps) {
    const update = useUpdateTask(task.id);
    const done = task.status === "completed";

    const setStatus = (status: TaskStatus) => {
        if (status === "completed") haptic();
        update.mutate({ status });
    };

    const setCount = (count: number) => {
        const status = statusForCount(count, task.targetCount, task.status);
        if (status === "completed" && task.status !== "completed") haptic();
        update.mutate({ currentCount: count, ...(status !== task.status ? { status } : {}) });
    };

    const toggle = () => {
        if (task.targetCount !== null && !done) {
            setCount(task.targetCount);
            return;
        }
        setStatus(done ? "pending" : "completed");
    };

    const leading: SwipeAction = done
        ? { id: "undo", label: "Pendiente", icon: RotateCcw, tone: "neutral", onTrigger: () => setStatus("pending") }
        : { id: "complete", label: "Completar", icon: Check, tone: "success", onTrigger: toggle };
    const skip: SwipeAction = { id: "skip", label: "Omitir", icon: Ban, tone: "neutral", onTrigger: () => setStatus("skipped") };
    const fail: SwipeAction = { id: "fail", label: "Fallida", icon: CircleX, tone: "danger", onTrigger: () => setStatus("failed") };
    const trailing = [skip, fail].filter((action) => !(action === skip && task.status === "skipped") && !(action === fail && task.status === "failed"));

    const meta = [scheduleLabel(task)];
    if (task.status === "in_progress") meta.unshift("En curso");
    if (task.status === "skipped" || task.status === "failed") meta.unshift(statusLabels[task.status]);

    return (
        <ContextMenu.Root>
            <SwipeRow leading={canEdit ? leading : undefined} trailing={canEdit ? trailing : []} disabled={!canEdit}>
                <ContextMenu.Trigger asChild disabled={!canEdit}>
                    <div
                        role="button"
                        tabIndex={0}
                        aria-label={`${task.title}, ${statusLabels[task.status]}, ${scheduleLabel(task)}`}
                        onClick={() => onOpen(task.id)}
                        onKeyDown={(event) => {
                            if (event.target !== event.currentTarget) return;
                            if (event.key === "Enter") onOpen(task.id);
                            if (event.key === " " && canEdit) {
                                event.preventDefault();
                                toggle();
                            }
                        }}
                        className="flex min-h-14 items-center gap-3 py-2.5 pr-4 pl-4 outline-offset-[-2px] active:bg-fill-secondary"
                    >
                        <StatusCheck status={task.status} title={task.title} onToggle={canEdit ? toggle : undefined} />
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <div className="flex items-center gap-1.5">
                                {task.priority === "urgent" && !done ? (
                                    <span aria-label="Urgente" role="img" className="size-2 shrink-0 rounded-full bg-danger" />
                                ) : null}
                                <span className={cn("truncate text-body", done && "text-label-secondary")}>{task.title}</span>
                            </div>
                            <span
                                className={cn(
                                    "truncate text-footnote text-label-secondary",
                                    task.status === "in_progress" && "text-warning",
                                    task.status === "failed" && "text-danger",
                                )}
                            >
                                {meta.join(" · ")}
                            </span>
                            {water && task.targetCount !== null ? (
                                <div className="pt-1.5">
                                    <WaterBottles value={task.currentCount} target={task.targetCount} unit={water.unit} onChange={setCount} disabled={!canEdit} />
                                </div>
                            ) : null}
                        </div>
                        {!water && task.targetCount !== null ? (
                            <CounterControl value={task.currentCount} target={task.targetCount} onChange={setCount} disabled={!canEdit} title={task.title} />
                        ) : null}
                    </div>
                </ContextMenu.Trigger>
            </SwipeRow>
            <ContextMenu.Portal>
                <ContextMenu.Content
                    collisionPadding={12}
                    className="z-50 min-w-56 origin-[var(--radix-context-menu-content-transform-origin)] rounded-card bg-bg-elevated p-1.5 shadow-float ring-1 ring-separator data-[state=open]:animate-[menu-in_180ms_cubic-bezier(0.2,0.9,0.3,1)] motion-reduce:animate-none"
                >
                    <ContextMenu.Item className={menuItem} disabled={task.status === "in_progress"} onSelect={() => setStatus("in_progress")}>
                        <CircleDot aria-hidden className="size-5 text-warning" /> Iniciar
                    </ContextMenu.Item>
                    <ContextMenu.Item className={menuItem} onSelect={() => setStatus(done ? "pending" : "completed")}>
                        {done ? <RotateCcw aria-hidden className="size-5 text-label-secondary" /> : <Check aria-hidden className="size-5 text-success" />}
                        {done ? "Marcar pendiente" : "Completar"}
                    </ContextMenu.Item>
                    <ContextMenu.Item className={menuItem} disabled={task.status === "skipped"} onSelect={() => setStatus("skipped")}>
                        <Ban aria-hidden className="size-5 text-label-secondary" /> Omitir
                    </ContextMenu.Item>
                    <ContextMenu.Item className={menuItem} disabled={task.status === "failed"} onSelect={() => setStatus("failed")}>
                        <CircleX aria-hidden className="size-5 text-danger" /> Marcar fallida
                    </ContextMenu.Item>
                    <ContextMenu.Separator className="my-1 h-px bg-separator" />
                    <ContextMenu.Item className={menuItem} onSelect={() => onOpen(task.id)}>
                        <NotebookPen aria-hidden className="size-5 text-label-secondary" /> Añadir nota
                    </ContextMenu.Item>
                    <ContextMenu.Item className={menuItem} onSelect={() => onOpen(task.id)}>
                        <SquarePen aria-hidden className="size-5 text-label-secondary" /> Ver y editar
                    </ContextMenu.Item>
                </ContextMenu.Content>
            </ContextMenu.Portal>
        </ContextMenu.Root>
    );
}
