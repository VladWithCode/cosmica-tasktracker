import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { queryClient } from "@/queries/queryClient";
import { getTodayTasksOpts, TasksQueryKeys } from "@/queries/tasks";
import { createTask } from "@/services/tasks";
import type { CreateTaskPayload, TaskCategory, TaskPriorityValue } from "@/types/task-config";
import type { TTask } from "@/lib/schemas/task";
import { cn } from "@/lib/utils";

const categoryOptions: Record<TaskCategory, { label: string; icon: string }> = {
    focus: { label: "Focus", icon: "work" },
    wellness: { label: "Wellness", icon: "spa" },
    movement: { label: "Movement", icon: "fitness_center" },
    admin: { label: "Admin", icon: "inventory_2" },
};

const priorityOptions: Record<TaskPriorityValue, { label: string; dotClassName: string }> = {
    low: { label: "Low", dotClassName: "bg-tertiary" },
    medium: { label: "Medium", dotClassName: "bg-primary" },
    high: { label: "High", dotClassName: "bg-error" },
    urgent: { label: "Urgent", dotClassName: "bg-error-dim" },
};

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

const taskConfigSchema = z
    .object({
        title: z.string().trim().min(1, "Escribe el nombre de la tarea").max(255),
        category: z.enum(["focus", "wellness", "movement", "admin"]),
        priority: z.enum(["urgent", "high", "medium", "low"]),
        startTime: z.string().regex(timePattern, "Selecciona una hora de inicio"),
        endTime: z.string().regex(timePattern, "Selecciona una hora de fin"),
    })
    .refine((data) => timeToMinutes(data.endTime) > timeToMinutes(data.startTime), {
        message: "La hora de fin debe ser posterior a la hora de inicio",
        path: ["endTime"],
    });

type TaskConfigForm = z.infer<typeof taskConfigSchema>;

interface FlowItem {
    id: string;
    title: string;
    startTime: Date;
    endTime: Date | null;
    status: "completed" | "active" | "upcoming";
}

export function RoutineConfigurationPage() {
    const router = useRouter();
    const defaultTimes = useMemo(() => getDefaultTimes(), []);
    const { data, isError, isLoading } = useQuery(getTodayTasksOpts);
    const form = useForm<TaskConfigForm>({
        resolver: zodResolver(taskConfigSchema),
        defaultValues: {
            title: "",
            category: "focus",
            priority: "high",
            startTime: defaultTimes.startTime,
            endTime: defaultTimes.endTime,
        },
    });
    const title = form.watch("title");
    const category = form.watch("category");
    const priority = form.watch("priority");
    const startTime = form.watch("startTime");
    const endTime = form.watch("endTime");
    const selectedCategory = categoryOptions[category];
    const selectedPriority = priorityOptions[priority];
    const flowItems = useMemo(
        () => buildFlowItems(data?.tasks ?? [], title, startTime, endTime),
        [data?.tasks, endTime, startTime, title],
    );
    const timelineWindow = getTimelineWindow(startTime, endTime);
    const createTaskMutation = useMutation({
        mutationFn: createTask,
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: TasksQueryKeys.all() });
            await queryClient.invalidateQueries({ queryKey: TasksQueryKeys.today() });
        },
    });

    const saveTask = (repeating: boolean) => {
        form.handleSubmit((values) => {
            const payload = buildCreateTaskPayload(values, repeating);
            createTaskMutation.mutate(payload, {
                onSuccess: () => {
                    toast.success(
                        repeating
                            ? "La plantilla diaria se guardó correctamente"
                            : "La tarea se guardó correctamente",
                    );
                    router.history.push("/dashboard");
                },
                onError: (error) => {
                    toast.error(error.message || "No se pudo guardar la tarea");
                },
            });
        })();
    };

    return (
        <div className="min-h-full overflow-y-auto bg-surface pb-32 font-body text-on-surface selection:bg-primary-dim selection:text-on-primary">
            <header className="fixed top-0 z-50 flex w-full items-center justify-between bg-surface/90 bg-gradient-to-b from-surface-container/80 to-transparent px-6 py-4 shadow-[0_20px_50px_rgba(112,0,255,0.15)] backdrop-blur-xl">
                <div className="flex min-w-0 items-center gap-4">
                    <Link
                        aria-label="Volver al timeline"
                        className="text-on-surface-variant transition-all duration-300 hover:text-primary active:scale-95"
                        to="/dashboard"
                    >
                        <MaterialIcon name="arrow_back" className="text-2xl" />
                    </Link>
                    <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-surface-container-highest bg-surface-container-high text-primary shadow-[0_0_20px_rgba(175,162,255,0.15)]">
                            <MaterialIcon name="person" filled className="text-2xl" />
                        </div>
                        <h1 className="truncate font-display text-lg font-extrabold uppercase tracking-widest text-on-surface">
                            Routine Ritual
                        </h1>
                    </div>
                </div>
                <button
                    aria-label="Ver notificaciones"
                    className="text-on-surface-variant transition-all duration-300 hover:text-primary active:scale-95"
                    type="button"
                >
                    <MaterialIcon name="notifications" className="text-2xl" />
                </button>
            </header>

            <main className="relative mx-auto max-w-md space-y-6 px-4 pt-24">
                <div className="pointer-events-none absolute left-1/2 top-20 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/5 blur-[120px]" />
                <section className="relative space-y-1">
                    <h2 className="font-display text-3xl font-extrabold tracking-tight">
                        Morning Routine
                    </h2>
                    <p className="text-sm font-medium text-on-surface-variant">
                        Configure your daily start.
                    </p>
                </section>

                <form className="relative space-y-6" onSubmit={(event) => event.preventDefault()}>
                    <section className="space-y-4 rounded-xl bg-surface-container-high p-5">
                        <div className="space-y-2">
                            <label
                                className="font-label text-xs font-bold uppercase tracking-wider text-on-surface-variant"
                                htmlFor="task-title"
                            >
                                Task Name
                            </label>
                            <input
                                className="w-full rounded-lg border border-outline-variant/15 bg-surface-container-lowest px-4 py-3 font-medium text-on-surface placeholder:text-on-surface-variant/50 transition-colors focus:border-primary focus:ring-0"
                                id="task-title"
                                placeholder="Deep Work Session"
                                type="text"
                                {...form.register("title")}
                            />
                            {form.formState.errors.title ? (
                                <p className="text-xs text-error">
                                    {form.formState.errors.title.message}
                                </p>
                            ) : null}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label
                                    className="font-label text-xs font-bold uppercase tracking-wider text-on-surface-variant"
                                    htmlFor="task-category"
                                >
                                    Category
                                </label>
                                <div className="relative">
                                    <select
                                        className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                                        id="task-category"
                                        {...form.register("category")}
                                    >
                                        {Object.entries(categoryOptions).map(([value, option]) => (
                                            <option key={value} value={value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                    <div className="flex w-full items-center justify-between rounded-lg border border-outline-variant/15 bg-surface-container-lowest px-4 py-3 text-on-surface transition-colors hover:bg-surface-container-highest">
                                        <div className="flex min-w-0 items-center gap-2">
                                            <MaterialIcon
                                                name={selectedCategory.icon}
                                                className="text-sm text-primary"
                                            />
                                            <span className="truncate text-sm font-medium">
                                                {selectedCategory.label}
                                            </span>
                                        </div>
                                        <MaterialIcon
                                            name="expand_more"
                                            className="text-sm text-on-surface-variant"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label
                                    className="font-label text-xs font-bold uppercase tracking-wider text-on-surface-variant"
                                    htmlFor="task-priority"
                                >
                                    Priority
                                </label>
                                <div className="relative">
                                    <select
                                        className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                                        id="task-priority"
                                        {...form.register("priority")}
                                    >
                                        {Object.entries(priorityOptions).map(([value, option]) => (
                                            <option key={value} value={value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                    <div className="flex w-full items-center justify-between rounded-lg border border-outline-variant/15 bg-surface-container-lowest px-4 py-3 text-on-surface transition-colors hover:bg-surface-container-highest">
                                        <div className="flex min-w-0 items-center gap-2">
                                            <div
                                                className={cn(
                                                    "h-2 w-2 rounded-full",
                                                    selectedPriority.dotClassName,
                                                )}
                                            />
                                            <span className="truncate text-sm font-medium">
                                                {selectedPriority.label}
                                            </span>
                                        </div>
                                        <MaterialIcon
                                            name="expand_more"
                                            className="text-sm text-on-surface-variant"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="space-y-6 rounded-xl bg-surface-container-high p-5">
                        <h3 className="font-label text-sm font-bold uppercase tracking-wider text-on-surface">
                            Time Window
                        </h3>
                        <div className="relative flex items-center justify-between overflow-hidden rounded-lg border border-outline-variant/15 bg-surface-container-lowest p-4">
                            <div className="absolute inset-0 bg-primary/5" />
                            <TimePickerPanel
                                label="Start"
                                name="startTime"
                                register={form.register}
                                value={startTime}
                            />
                            <div className="relative z-10 px-4 text-on-surface-variant">
                                <MaterialIcon name="arrow_forward" />
                            </div>
                            <TimePickerPanel
                                label="End"
                                name="endTime"
                                register={form.register}
                                value={endTime}
                            />
                        </div>
                        {form.formState.errors.endTime ? (
                            <p className="text-xs text-error">
                                {form.formState.errors.endTime.message}
                            </p>
                        ) : null}

                        <div className="space-y-2">
                            <div className="flex justify-between text-xs font-medium text-on-surface-variant">
                                <span>{formatHourLabel(timelineWindow.startMinutes)}</span>
                                <span>{formatHourLabel(timelineWindow.endMinutes)}</span>
                            </div>
                            <TimeRangePreview
                                endTime={endTime}
                                startTime={startTime}
                                windowEnd={timelineWindow.endMinutes}
                                windowStart={timelineWindow.startMinutes}
                            />
                        </div>
                    </section>

                    <div className="space-y-3 pt-2">
                        <button
                            className="w-full rounded-full bg-gradient-to-r from-primary to-primary-dim py-4 font-label text-sm font-extrabold uppercase tracking-widest text-on-primary shadow-[0_20px_50px_rgba(175,162,255,0.15)] transition-all duration-300 hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={createTaskMutation.isPending}
                            onClick={() => saveTask(false)}
                            type="button"
                        >
                            Save Task
                        </button>
                        <button
                            className="w-full rounded-full border border-outline-variant/15 bg-surface-container-highest py-4 text-sm font-bold text-on-surface transition-all duration-300 hover:bg-surface-variant active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={createTaskMutation.isPending}
                            onClick={() => saveTask(true)}
                            type="button"
                        >
                            Save as Master Template
                        </button>
                    </div>
                </form>

                <section className="relative space-y-4 pt-6">
                    <h3 className="font-label text-sm font-bold uppercase tracking-wider text-on-surface-variant">
                        Today's Flow
                    </h3>
                    {isLoading ? <FlowLoadingState /> : null}
                    {isError ? <FlowErrorState /> : null}
                    {!isLoading && !isError ? <FlowPreview items={flowItems} /> : null}
                </section>
            </main>
        </div>
    );
}

function TimePickerPanel({
    label,
    name,
    register,
    value,
}: {
    label: string;
    name: "startTime" | "endTime";
    register: ReturnType<typeof useForm<TaskConfigForm>>["register"];
    value: string;
}) {
    const [hour, meridiem] = formatTimeForPanel(value);

    return (
        <label className="relative z-10 flex flex-1 cursor-pointer flex-col text-center">
            <span className="mb-1 font-label text-xs font-bold uppercase tracking-widest text-primary">
                {label}
            </span>
            <span className="font-display text-3xl font-extrabold tracking-tighter text-on-surface tabular-nums">
                {hour}
            </span>
            <span className="mt-1 text-xs font-medium text-on-surface-variant">{meridiem}</span>
            <input
                aria-label={`${label} time`}
                className="absolute inset-0 cursor-pointer opacity-0"
                type="time"
                {...register(name)}
            />
        </label>
    );
}

function TimeRangePreview({
    endTime,
    startTime,
    windowEnd,
    windowStart,
}: {
    endTime: string;
    startTime: string;
    windowEnd: number;
    windowStart: number;
}) {
    const total = windowEnd - windowStart;
    const startX = Math.max(0, Math.min(100, ((timeToMinutes(startTime) - windowStart) / total) * 100));
    const endX = Math.max(0, Math.min(100, ((timeToMinutes(endTime) - windowStart) / total) * 100));
    const selectedWidth = Math.max(2, endX - startX);

    return (
        <div className="h-10 overflow-hidden rounded-lg border border-outline-variant/15 bg-surface-container-lowest">
            <svg className="h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 40">
                {[0, 25, 50, 75, 100].map((x) => (
                    <line
                        className="text-outline-variant opacity-20"
                        key={x}
                        stroke="currentColor"
                        strokeWidth="0.5"
                        x1={x}
                        x2={x}
                        y1="0"
                        y2="40"
                    />
                ))}
                <rect fill="rgba(175,162,255,0.2)" height="40" width={selectedWidth} x={startX} />
                <line className="text-primary" stroke="currentColor" strokeWidth="0.5" x1={startX} x2={startX} y1="0" y2="40" />
                <line className="text-primary" stroke="currentColor" strokeWidth="0.5" x1={endX} x2={endX} y1="0" y2="40" />
                <rect fill="#afa2ff" height="16" rx="1" width="1.2" x={startX + 1} y="12" />
                <rect fill="#afa2ff" height="16" rx="1" width="1.2" x={Math.max(startX + 1.5, endX - 2)} y="12" />
            </svg>
        </div>
    );
}

function FlowPreview({ items }: { items: FlowItem[] }) {
    if (items.length === 0) {
        return (
            <div className="rounded-xl border border-outline-variant/15 bg-surface-container-low p-5 text-center text-sm text-on-surface-variant">
                Add a task name to preview the flow.
            </div>
        );
    }

    return (
        <div className="relative space-y-6 pl-6 before:absolute before:bottom-2 before:left-2 before:top-2 before:w-0.5 before:bg-surface-container-highest">
            {items.map((item) => (
                <div className="relative" key={item.id}>
                    <FlowMarker status={item.status} />
                    <div
                        className={cn(
                            "rounded-lg border p-3",
                            item.status === "completed" &&
                                "border-outline-variant/15 bg-surface-container-low",
                            item.status === "active" &&
                                "border-primary/30 bg-primary/10 text-primary",
                            item.status === "upcoming" &&
                                "border-outline-variant/15 bg-surface-container-low opacity-60",
                        )}
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <h4
                                    className={cn(
                                        "truncate text-sm font-bold",
                                        item.status === "completed" &&
                                            "text-on-surface opacity-50 line-through",
                                        item.status === "active" && "text-primary",
                                        item.status === "upcoming" && "text-on-surface",
                                    )}
                                >
                                    {item.title}
                                </h4>
                                <p
                                    className={cn(
                                        "text-xs",
                                        item.status === "active"
                                            ? "font-medium text-primary/70"
                                            : "text-on-surface-variant",
                                        item.status === "completed" && "opacity-50",
                                    )}
                                >
                                    {formatFlowTime(item.startTime)} -{" "}
                                    {item.endTime ? formatFlowTime(item.endTime) : "Open"}
                                </p>
                            </div>
                            {item.status === "completed" ? (
                                <MaterialIcon
                                    name="check_circle"
                                    className="text-sm text-tertiary"
                                />
                            ) : null}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

function FlowMarker({ status }: { status: FlowItem["status"] }) {
    return (
        <div
            className={cn(
                "absolute -left-[27px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full",
                status === "completed" &&
                    "bg-tertiary shadow-[0_0_10px_rgba(129,236,255,0.4)]",
                status === "active" &&
                    "bg-primary shadow-[0_0_10px_rgba(175,162,255,0.4)]",
                status === "upcoming" &&
                    "border-2 border-outline-variant bg-surface-container-highest",
            )}
        >
            {status !== "upcoming" ? <div className="h-1.5 w-1.5 rounded-full bg-surface" /> : null}
        </div>
    );
}

function FlowLoadingState() {
    return (
        <div className="space-y-4">
            {[0, 1, 2].map((item) => (
                <div className="h-16 rounded-lg bg-surface-container-low" key={item} />
            ))}
        </div>
    );
}

function FlowErrorState() {
    return (
        <div className="rounded-xl border border-error-dim/30 bg-error-container/10 p-4 text-sm text-error">
            No se pudo cargar el flujo de hoy.
        </div>
    );
}

function buildCreateTaskPayload(values: TaskConfigForm, repeating: boolean): CreateTaskPayload {
    return {
        title: values.title,
        description: "",
        startTime: timeToDate(values.startTime).toISOString(),
        endTime: timeToDate(values.endTime).toISOString(),
        durationMinutes: timeToMinutes(values.endTime) - timeToMinutes(values.startTime),
        priority: values.priority,
        required: values.priority === "urgent" || values.priority === "high",
        isRequired: values.priority === "urgent" || values.priority === "high",
        repeating,
        repeatFrequency: repeating ? "daily" : "",
        repeatWeekdays: [],
        repeatInterval: repeating ? 1 : 0,
        frequency: repeating ? "daily" : "custom",
        frequencyConfig: repeating
            ? { legacyRepeatFrequency: "daily", repeatInterval: 1, repeatWeekdays: [] }
            : { singleInstance: true },
        category: values.category,
    };
}

function buildFlowItems(tasks: TTask[], title: string, startTime: string, endTime: string): FlowItem[] {
    const now = new Date();
    const draft = title.trim()
        ? [
              {
                  id: "draft-task",
                  title: title.trim(),
                  startTime: timeToDate(startTime),
                  endTime: timeToDate(endTime),
                  status: "active" as const,
              },
          ]
        : [];
    const taskItems: FlowItem[] = tasks.map((task) => ({
        id: task.id,
        title: task.title,
        startTime: task.startTime ?? task.date,
        endTime: task.endTime,
        status: getFlowStatus(task, now),
    }));

    return [...taskItems, ...draft].sort(
        (first, second) => first.startTime.getTime() - second.startTime.getTime(),
    );
}

function getFlowStatus(task: TTask, now: Date): FlowItem["status"] {
    if (task.status === "completed" || task.completedAt !== null) {
        return "completed";
    }

    if (task.startTime && task.endTime) {
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const startMinutes = timeToMinutes(dateToTimeInputValue(task.startTime));
        const endMinutes = timeToMinutes(dateToTimeInputValue(task.endTime));
        if (currentMinutes >= startMinutes && currentMinutes <= endMinutes) {
            return "active";
        }
    }

    return "upcoming";
}

function getDefaultTimes() {
    const start = new Date();
    start.setMinutes(start.getMinutes() < 30 ? 30 : 60, 0, 0);
    const end = new Date(start);
    end.setHours(start.getHours() + 1);

    return {
        startTime: dateToTimeInputValue(start),
        endTime: dateToTimeInputValue(end),
    };
}

function getTimelineWindow(startTime: string, endTime: string) {
    const start = timeToMinutes(startTime);
    const end = timeToMinutes(endTime);
    const min = Math.min(start, end);
    const max = Math.max(start, end);
    const startMinutes = Math.max(0, Math.floor((min - 60) / 60) * 60);
    const endMinutes = Math.min(24 * 60, Math.ceil((max + 120) / 60) * 60);

    return {
        startMinutes,
        endMinutes: Math.max(endMinutes, startMinutes + 60),
    };
}

function timeToDate(value: string) {
    const date = new Date();
    const [hour, minute] = value.split(":").map(Number);
    date.setHours(hour ?? 0, minute ?? 0, 0, 0);
    return date;
}

function timeToMinutes(value: string) {
    if (!timePattern.test(value)) {
        return 0;
    }

    const [hour, minute] = value.split(":").map(Number);
    return (hour ?? 0) * 60 + (minute ?? 0);
}

function dateToTimeInputValue(date: Date) {
    const hour = String(date.getHours()).padStart(2, "0");
    const minute = String(date.getMinutes()).padStart(2, "0");
    return `${hour}:${minute}`;
}

function formatTimeForPanel(value: string): [string, string] {
    const date = timeToDate(value);
    const parts = new Intl.DateTimeFormat("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
    })
        .format(date)
        .split(" ");

    return [parts[0] ?? value, parts[1] ?? ""];
}

function formatFlowTime(date: Date) {
    return date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
    });
}

function formatHourLabel(minutes: number) {
    const date = new Date();
    date.setHours(Math.floor(minutes / 60), 0, 0, 0);
    return date.toLocaleTimeString("en-US", {
        hour: "numeric",
        hour12: true,
    });
}
