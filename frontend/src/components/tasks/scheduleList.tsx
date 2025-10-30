import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@radix-ui/react-collapsible";
import { TaskCard } from "./taskCard";
import { cn, numberToHour } from "@/lib/utils";
import { Button } from "../ui/button";
import { useState } from "react";
import type { TTask } from "@/lib/schemas/task";

/*
 * This component is used to display a list of tasks for a specific hour.
 */
export function HourRow({ hour, tasks, isCurrentHour }: { hour: number, tasks: TTask[], isCurrentHour: boolean }) {
    const [isFullListOpen, setIsFullListOpen] = useState(false);
    const hasNoTasks = tasks === undefined || tasks.length === 0;
    const hasOneTask = tasks && tasks.length === 1;

    return (
        <Collapsible
            open={isFullListOpen}
            onOpenChange={(isOpen) => setIsFullListOpen(isOpen)}
            className="col-span-full grid grid-cols-subgrid min-h-16"
            data-testid={`hour-${hour}`}
        >
            <div className="col-start-1 row-start-1 flex justify-end">
                <CollapsibleTrigger asChild>
                    <Button
                        className={
                            cn(
                                "hour-toggle relative flex items-start h-full w-full rounded-none text-current/80 font-medium font-mono hover:shadow-none active:shadow-none focus:shadow-none p-0 px-4",
                                hasNoTasks && "disabled:opacity-50",
                                hasOneTask && "disabled:opacity-90",
                                isCurrentHour && "current",
                            )

                        }
                        variant="ghost"
                        disabled={tasks === undefined || tasks.length <= 0}
                    >
                        {numberToHour(hour)}
                    </Button>
                </CollapsibleTrigger>
            </div>
            <div className="col-start-2 row-start-1 pr-0.5">
                {tasks !== undefined && tasks.length > 0
                    ? <TaskListing tasks={tasks} />
                    : <EmptyTaskList />
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
                className={cn("space-y-2 mt-2 data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up")}
            >
                {
                    tasks?.filter((_, idx) => idx > 0).map((task) => (
                        <TaskCard key={task.id} task={task} />
                    ))
                }
            </CollapsibleContent>
        </>
    )
}

function EmptyTaskList() {
    return (
        <div className="bg-gray-200 h-full">
            <div className="bg-dots h-full flex items-center justify-center">
                <span className="bg-gray-200 text-muted-foreground/60 px-2">Libre</span>
            </div>
        </div>
    )
}
