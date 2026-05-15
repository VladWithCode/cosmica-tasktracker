import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@radix-ui/react-collapsible";
import { TaskCard } from "./taskCard";
import { cn, numberToHour } from "@/lib/utils";
import { useState } from "react";
import type { TTask } from "@/lib/schemas/task";
import { MaterialIcon } from "@/components/ui/MaterialIcon";

interface HourRowProps {
    hour: number;
    isCurrentHour: boolean;
    tasks: TTask[];
}

export function HourRow({ hour, tasks, isCurrentHour }: HourRowProps) {
    const [isFullListOpen, setIsFullListOpen] = useState(false);
    const hasNoTasks = tasks === undefined || tasks.length === 0;
    const hasOneTask = tasks && tasks.length === 1;

    return (
        <Collapsible
            open={isFullListOpen}
            onOpenChange={(isOpen) => setIsFullListOpen(isOpen)}
            className="col-span-full grid min-h-20 grid-cols-subgrid"
            data-testid={`hour-${hour}`}
        >
            <div className="col-start-1 row-start-1">
                <CollapsibleTrigger asChild>
                    <button
                        className={cn(
                            "flex h-full w-full flex-col items-center justify-center rounded-xl border border-outline-variant/10 bg-surface-container-low px-2 text-center transition-all duration-300 active:scale-95",
                            !hasNoTasks && "hover:-translate-y-1 hover:border-primary/30",
                            hasNoTasks && "opacity-45",
                            hasOneTask && "opacity-90",
                            isCurrentHour &&
                                "border-primary/30 bg-primary/10 text-primary shadow-[0_0_20px_rgba(175,162,255,0.16)]",
                        )}
                        disabled={hasNoTasks}
                        type="button"
                    >
                        <span className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                            Hora
                        </span>
                        <span className="mt-1 text-xs font-black tracking-tighter tabular-nums text-on-surface sm:text-sm">
                            {numberToHour(hour)}
                        </span>
                        {tasks.length > 1 ? (
                            <span className="mt-1 flex items-center gap-1 text-[10px] text-tertiary">
                                <MaterialIcon name="expand_more" className="text-sm" />
                                {tasks.length}
                            </span>
                        ) : null}
                    </button>
                </CollapsibleTrigger>
            </div>
            <div className="col-start-2 row-start-1">
                {hasNoTasks
                    ? <EmptyTaskList />
                    : <TaskListing tasks={tasks} />
                }
            </div>
        </Collapsible>
    );
}

function TaskListing({ tasks }: { tasks: TTask[]; }) {
    return (
        <>
            <TaskCard task={tasks[0]} />
            <CollapsibleContent
                className={cn("mt-3 space-y-3 data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up")}
            >
                {
                    tasks.filter((_, idx) => idx > 0).map((task) => (
                        <TaskCard key={task.id} task={task} />
                    ))
                }
            </CollapsibleContent>
        </>
    )
}

function EmptyTaskList() {
    return (
        <div className="h-full rounded-xl border border-dashed border-outline-variant/10 bg-surface-container-low/55">
            <div className="bg-dots flex h-full items-center justify-center text-outline-variant/35">
                <span className="rounded-full bg-surface px-3 py-1 font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50">
                    Libre
                </span>
            </div>
        </div>
    )
}
