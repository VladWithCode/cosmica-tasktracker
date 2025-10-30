import { cn, formatStartTime } from "@/lib/utils";
import { Button } from "../ui/button";
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { CheckIcon, View } from "lucide-react";
import type { TTask } from "@/lib/schemas/task";

export function TaskCard({ taskData }: { taskData: TTask }) {
    const isDone = taskData.status === "completed";
    return (
        <Card
            className={cn(
                "shadow-none rounded-sm",
                isDone && "bg-primary/30 text-primary-foreground",
            )}
        >
            <CardHeader>
                <CardTitle>
                    {formatStartTime(taskData.startTime)} - {taskData.title}
                </CardTitle>
                <CardDescription className={cn(isDone && "text-primary-foreground")}>
                    {taskData.description}
                </CardDescription>
                <CardAction className="flex items-center gap-x-2">
                    <Button
                        variant="outline"
                        size="icon"
                        className={cn(isDone && "text-primary")}
                    >
                        <View className="h-4 w-4" />
                        <div className="sr-only">Ver detalles</div>
                    </Button>
                    <Button variant="default" size="icon" disabled={isDone}>
                        <CheckIcon className="h-4 w-4" />
                        <div className="sr-only">Completar tarea</div>
                    </Button>
                </CardAction>
            </CardHeader>
        </Card>
    );
}
