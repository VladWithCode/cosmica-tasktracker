import { NewTask } from "@/components/tasks/createTask";
import { HourRow } from "@/components/tasks/scheduleList";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useLayoutEffect, useRef } from "react";
import type { TTask } from "@/lib/schemas/task";
import { getTodayTasksOpts } from "@/queries/tasks";
import { queryClient } from "@/queries/queryClient";

export const Route = createFileRoute("/tasks/")({
    component: RouteComponent,
    loader: () => queryClient.ensureQueryData(getTodayTasksOpts),
});

function RouteComponent() {
    const taskListRef = useRef<HTMLDivElement>(null);
    const { data: { tasks } } = useSuspenseQuery(getTodayTasksOpts);
    let hours = createHours(tasks);

    useLayoutEffect(() => {
        if (!taskListRef.current) {
            return;
        }

        let tid = setTimeout(() => {
            scrollToCurrentHour(taskListRef.current!);
        }, 1000 * 60 * 5);

        return () => {
            clearTimeout(tid);
        };
    }, []);

    return (
        <main className="relative h-full">
            <ScrollArea className="h-full w-full" ref={taskListRef}>
                <div className="h-full grid grid-cols-[auto_1fr] auto-rows-auto gap-y-2">
                    {hours}
                </div>
                <div className="absolute inset-0 z-30 pointer-events-none">
                    <ScrollBar />
                </div>
            </ScrollArea>
            <NewTask />
        </main>
    );
}

function createHours(tasks: TTask[]) {
    let currentHour = new Date().getHours();
    let hours = Array(24).fill(0);
    for (let i = 0; i < 24; i++) {
        let hourTasks = [];
        for (let task of tasks) {
            if (task.startTime?.getHours() === i) {
                hourTasks.push(task);
            }
        }
        hours[i] = <HourRow key={i} hour={i} tasks={hourTasks} isCurrentHour={i === currentHour} />;
    }
    return hours;
}

function scrollToCurrentHour(taskListElt: HTMLElement) {
    const currentHour = new Date().getHours();
    const hourContainer = document.querySelector(`[data-testid="hour-${currentHour}"]`)
    const scrollViewport = taskListElt.querySelector('[data-slot="scroll-area-viewport"]')

    if (hourContainer && scrollViewport) {
        const rect = hourContainer.getBoundingClientRect();
        scrollViewport.scrollBy({ top: rect.top - rect.height, behavior: 'smooth' });
    }
}
