import { NewTask } from "@/components/tasks/createTask";
import { HourRow } from "@/components/tasks/scheduleList";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useLayoutEffect } from "react";
import { queryClient } from "../__root";
import type { TTask } from "@/lib/schemas/task";

const tasksQueryOptions = queryOptions({
    queryKey: ["tasks"],
    queryFn: async () => {
        return await fetch("http://localhost:8080/api/v1/tasks/today", {
            method: "GET",
            credentials: "include",
        }).then(async (res) => {
            const data = await res.json();
            const tasks: TTask[] = data.tasks !== undefined ? data.tasks.map((task: any) => {
                return {
                    ...task,
                    date: new Date(task.date),
                    startTime: task.startTime ? new Date(task.startTime) : null,
                    endTime: task.endTime ? new Date(task.endTime) : null,
                    endDate: task.endDate ? new Date(task.endDate) : null,
                    completedAt: task.completedAt ? new Date(task.completedAt) : null,
                    createdAt: new Date(task.createdAt),
                    updatedAt: new Date(task.updatedAt),
                };
            }) : [];
            return { tasks };
        });
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
})

export const Route = createFileRoute("/tasks/")({
    component: RouteComponent,
    loader: () => queryClient.ensureQueryData(tasksQueryOptions),
});

function RouteComponent() {
    const { data: { tasks } } = useSuspenseQuery(tasksQueryOptions);
    let hours = createHours(tasks);

    useLayoutEffect(() => {
        const currentHour = new Date().getHours();
        document.querySelector(`[data-testid="hour-${currentHour}"]`)?.scrollIntoView({
            behavior: "smooth",
        });
    }, []);

    return (
        <main className="relative z-0 h-full">
            <ScrollArea className="h-full w-full">
                <div className="min-h-full grid grid-cols-[auto_1fr] auto-rows-auto gap-y-2">
                    {hours}
                </div>
                <ScrollBar />
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
