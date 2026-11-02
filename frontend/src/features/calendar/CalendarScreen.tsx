import { lazy, useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";
import { OwnerSwitcher } from "@/components/shell/OwnerSwitcher";
import { Screen } from "@/components/shell/Screen";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { PullToRefresh } from "@/components/ui/PullToRefresh";
import { Skeleton } from "@/components/ui/Skeleton";
import { Deferred } from "@/components/ui/Deferred";
import { TodayList, waterConfigs } from "@/features/today/TodayScreen";
import { formatDay, isToday, todayISO } from "@/lib/date";
import { useTaskMarks } from "@/queries/history";
import { useOwnerAccess } from "@/queries/owner";
import { useSchedules } from "@/queries/schedules";
import { useDayTasks } from "@/queries/tasks";
import { DayPicker, MonthToggle, visibleRange } from "./DayPicker";

const TaskSheet = lazy(() => import("@/features/task/TaskSheet").then((module) => ({ default: module.TaskSheet })));

type CalendarScreenProps = {
    date: string;
    taskId?: string;
    onSelectDate: (date: string) => void;
    onOpenTask: (id: string) => void;
    onCloseTask: () => void;
};

export function CalendarScreen({ date, taskId, onSelectDate, onOpenTask, onCloseTask }: CalendarScreenProps) {
    const access = useOwnerAccess();
    const [monthOpen, setMonthOpen] = useState(false);
    const day = useDayTasks(access.ownerId, date);
    const schedules = useSchedules(access.ownerId);
    const water = useMemo(() => waterConfigs(schedules.data), [schedules.data]);
    const range = visibleRange(date, monthOpen);
    const marks = useTaskMarks(range.from, range.to, access.isSelf);
    const tasks = day.data?.tasks;

    return (
        <Screen
            title="Calendario"
            actions={
                <>
                    {isToday(date) ? null : (
                        <Button variant="plain" size="sm" onClick={() => onSelectDate(todayISO())}>
                            Hoy
                        </Button>
                    )}
                </>
            }
            titleAccessory={
                <div className="flex flex-col items-start">
                    <MonthToggle date={date} open={monthOpen} onToggle={() => setMonthOpen((value) => !value)} />
                    <OwnerSwitcher />
                </div>
            }
        >
            <DayPicker date={date} monthOpen={monthOpen} onSelect={onSelectDate} marks={marks} />

            <h2 className="px-8 pt-6 pb-3 text-headline">{formatDay(date)}</h2>
            <PullToRefresh onRefresh={() => day.refetch()}>
                {day.isPending ? (
                    <div className="flex flex-col gap-3 px-4 pt-2">
                        <Skeleton className="h-24 rounded-card" />
                        <Skeleton className="h-40 rounded-card" />
                    </div>
                ) : null}
                {day.isError ? <ErrorState error={day.error} onRetry={() => void day.refetch()} /> : null}
                {tasks && tasks.length === 0 ? <EmptyState icon={CalendarDays} title="Día libre" message="No hay tareas para este día." /> : null}
                {tasks && tasks.length > 0 ? <TodayList tasks={tasks} water={water} canEdit={access.canEdit} canPing={access.canPing} ownerName={access.name} onOpenTask={onOpenTask} /> : null}
            </PullToRefresh>
            <Deferred when={Boolean(taskId)}>
                <TaskSheet taskId={taskId} onClose={onCloseTask} />
            </Deferred>
        </Screen>
    );
}
