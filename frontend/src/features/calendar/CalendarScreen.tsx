import { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CalendarDays, ChevronDown } from "lucide-react";
import { CreateButton } from "@/components/shell/CreateButton";
import { Screen } from "@/components/shell/Screen";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { PullToRefresh } from "@/components/ui/PullToRefresh";
import { Skeleton } from "@/components/ui/Skeleton";
import { WeekStrip } from "@/components/ui/WeekStrip";
import { TaskSheet } from "@/features/task/TaskSheet";
import { TodayList, waterConfigs } from "@/features/today/TodayScreen";
import { cn } from "@/lib/cn";
import { formatDay, formatMonth, isToday, monthGrid, todayISO, weekDays } from "@/lib/date";
import { fade, spring } from "@/lib/motion";
import { useTaskMarks } from "@/queries/history";
import { useOwnerAccess } from "@/queries/owner";
import { useSchedules } from "@/queries/schedules";
import { useDayTasks } from "@/queries/tasks";
import { MonthGrid } from "./MonthGrid";

type CalendarScreenProps = {
    date: string;
    taskId?: string;
    onSelectDate: (date: string) => void;
    onOpenTask: (id: string) => void;
    onCloseTask: () => void;
};

export function CalendarScreen({ date, taskId, onSelectDate, onOpenTask, onCloseTask }: CalendarScreenProps) {
    const reduceMotion = useReducedMotion();
    const access = useOwnerAccess();
    const [monthOpen, setMonthOpen] = useState(false);
    const day = useDayTasks(access.ownerId, date);
    const schedules = useSchedules(access.ownerId);
    const water = useMemo(() => waterConfigs(schedules.data), [schedules.data]);
    const grid = monthGrid(date);
    const week = weekDays(date);
    const range = monthOpen
        ? { from: grid[0]?.[0] ?? date, to: grid[grid.length - 1]?.[6] ?? date }
        : { from: week[0] ?? date, to: week[6] ?? date };
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
                    {access.isSelf ? <CreateButton date={date} /> : null}
                </>
            }
            titleAccessory={
                <button
                    type="button"
                    aria-expanded={monthOpen}
                    onClick={() => setMonthOpen((value) => !value)}
                    className="flex min-h-11 items-center gap-1 text-callout font-medium text-accent"
                >
                    {formatMonth(date)}
                    <ChevronDown aria-hidden className={cn("size-4 transition-transform motion-reduce:transition-none", monthOpen && "rotate-180")} />
                </button>
            }
        >
            <div className="sticky top-[calc(env(safe-area-inset-top)+2.75rem)] z-20 material-bar pb-1">
                <AnimatePresence initial={false} mode="popLayout">
                    {monthOpen ? (
                        <motion.div
                            key="month"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={reduceMotion ? fade : spring.default}
                            className="overflow-hidden"
                        >
                            <MonthGrid selected={date} onSelect={onSelectDate} marks={marks} />
                        </motion.div>
                    ) : (
                        <motion.div key="week" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={fade}>
                            <WeekStrip selected={date} onSelect={onSelectDate} marks={marks} />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <h2 className="px-8 pt-4 pb-1 text-headline">{formatDay(date)}</h2>
            <PullToRefresh onRefresh={() => day.refetch()}>
                {day.isPending ? (
                    <div className="flex flex-col gap-3 px-4 pt-2">
                        <Skeleton className="h-24 rounded-card" />
                        <Skeleton className="h-40 rounded-card" />
                    </div>
                ) : null}
                {day.isError ? <ErrorState error={day.error} onRetry={() => void day.refetch()} /> : null}
                {tasks && tasks.length === 0 ? <EmptyState icon={CalendarDays} title="Día libre" message="No hay tareas para este día." /> : null}
                {tasks && tasks.length > 0 ? <TodayList tasks={tasks} water={water} canEdit={access.canEdit} onOpenTask={onOpenTask} /> : null}
            </PullToRefresh>
            <TaskSheet taskId={taskId} onClose={onCloseTask} />
        </Screen>
    );
}
