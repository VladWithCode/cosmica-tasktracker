import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { cn } from "@/lib/utils";
import { getSharedWithMeOpts } from "@/queries/sharing";
import { getSharedTodayTasksOpts } from "@/queries/tasks";
import { pingTaskOpts } from "@/queries/sharing";
import type { TaskFeedItem } from "@/types/task";
import type { SharingGrant } from "@/types/sharing";

export const Route = createFileRoute("/shared/$userId")({
    component: RouteComponent,
});

function RouteComponent() {
    const { userId } = Route.useParams();

    // Find the grant for this owner to determine what permissions we have
    const grantsQuery = useQuery(getSharedWithMeOpts);
    const grant = grantsQuery.data?.find((g) => g.owner_user_id === userId) ?? null;

    // Load their tasks (backend validates we have at least view permission)
    const tasksQuery = useQuery(getSharedTodayTasksOpts(userId));

    const ownerName = grant?.owner_fullname || grant?.owner_username || "Usuario";
    const tasks = tasksQuery.data?.feedItems ?? [];

    const isLoading = grantsQuery.isLoading || tasksQuery.isLoading;

    // 403 path: tasks loaded but no matching grant
    const grantNotFound = !grantsQuery.isLoading && grant === null;

    return (
        <AppShell showBackButton title={`Tareas de ${ownerName}`} topBarAlign="left">
            <main className="relative mx-auto min-h-full max-w-4xl px-6 pb-36 pt-8">
                <div className="pointer-events-none absolute left-1/2 top-16 h-64 w-64 -translate-x-1/2 rounded-full bg-primary/5 blur-[120px]" />

                {/* Back link */}
                <Link
                    className="mb-6 inline-flex items-center gap-2 font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant transition-colors hover:text-primary"
                    to="/profile"
                >
                    <MaterialIcon name="arrow_back" className="text-base" />
                    Perfil
                </Link>

                {/* Header */}
                <section className="relative mb-8">
                    <p className="font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                        {new Date().toLocaleDateString("es-MX", {
                            day: "2-digit",
                            month: "long",
                            weekday: "long",
                        })}
                    </p>
                    <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-on-surface">
                        Tareas de{" "}
                        <span className="text-primary">{ownerName}</span>
                    </h2>
                    {grant ? <PermissionBadge grant={grant} /> : null}
                </section>

                {/* States */}
                {isLoading ? <SharedLoadingState /> : null}

                {grantNotFound && !isLoading ? (
                    <div className="rounded-xl border border-error/20 bg-error/10 p-6 text-error">
                        <div className="flex items-center gap-3">
                            <MaterialIcon name="lock" filled />
                            <div>
                                <p className="font-label text-sm font-bold uppercase tracking-widest">
                                    Sin acceso
                                </p>
                                <p className="mt-1 text-sm opacity-80">
                                    No tienes permisos para ver las tareas de este usuario.
                                </p>
                            </div>
                        </div>
                    </div>
                ) : null}

                {tasksQuery.isError ? (
                    <div className="rounded-xl border border-error/20 bg-error/10 p-6 text-error">
                        <div className="flex items-center gap-3">
                            <MaterialIcon name="error_outline" />
                            <p>{tasksQuery.error?.message || "No se pudieron cargar las tareas"}</p>
                        </div>
                    </div>
                ) : null}

                {!isLoading && !tasksQuery.isError && !grantNotFound && tasks.length === 0 ? (
                    <div className="rounded-xl border border-outline-variant/15 bg-surface-container-low p-8 text-center">
                        <MaterialIcon name="event_available" className="mx-auto mb-3 text-4xl text-tertiary" />
                        <p className="font-headline text-lg font-bold text-on-surface">
                            Sin tareas para hoy
                        </p>
                        <p className="mt-1 text-sm text-on-surface-variant">
                            {ownerName} no tiene tareas programadas para hoy.
                        </p>
                    </div>
                ) : null}

                {!isLoading && !tasksQuery.isError && tasks.length > 0 && grant ? (
                    <section className="space-y-4">
                        {tasks.map((task) => (
                            <SharedTaskCard
                                canPing={grant.can_ping}
                                key={task.id}
                                ownerName={ownerName}
                                task={task}
                            />
                        ))}
                    </section>
                ) : null}
            </main>
        </AppShell>
    );
}

// ─── Permission badge ─────────────────────────────────────────────────────────

function PermissionBadge({ grant }: { grant: SharingGrant }) {
    const label =
        grant.access_level === "manage"
            ? "Gestionar"
            : grant.access_level === "ping_only"
              ? "Sólo ping"
              : "Ver";
    const icon =
        grant.access_level === "manage"
            ? "edit"
            : grant.access_level === "ping_only"
              ? "notifications_active"
              : "visibility";

    return (
        <span className="mt-3 inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 font-label text-[10px] font-bold uppercase tracking-widest text-primary">
            <MaterialIcon name={icon} className="text-xs" />
            Acceso: {label}
        </span>
    );
}

// ─── Shared task card ─────────────────────────────────────────────────────────

function SharedTaskCard({
    canPing,
    ownerName,
    task,
}: {
    canPing: boolean;
    ownerName: string;
    task: TaskFeedItem;
}) {
    const [showPingModal, setShowPingModal] = useState(false);
    const isCompleted = task.status_level === "completed";

    return (
        <>
            <article
                className={cn(
                    "group relative overflow-hidden rounded-xl border border-outline-variant/10 bg-surface-container-low p-4 pl-5 transition-all duration-300 hover:-translate-y-0.5",
                    isCompleted && "opacity-60",
                )}
            >
                {/* Priority bar */}
                <div
                    className={cn(
                        "absolute left-0 top-0 h-full w-1",
                        priorityBar(task.priority_level),
                    )}
                />

                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                            {task.schedule_start_time ? (
                                <span className="rounded-md border border-outline-variant/15 bg-surface px-2 py-0.5 font-label text-[10px] font-bold tabular-nums text-on-surface-variant">
                                    {task.schedule_start_time}
                                </span>
                            ) : null}
                            {task.is_required ? (
                                <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 font-label text-[10px] font-bold uppercase tracking-widest text-primary">
                                    <MaterialIcon name="priority_high" className="text-xs" />
                                    Vital
                                </span>
                            ) : null}
                            {isCompleted ? (
                                <span className="inline-flex items-center gap-1 rounded-full border border-tertiary/20 bg-tertiary/10 px-2 py-0.5 font-label text-[10px] font-bold uppercase tracking-widest text-tertiary">
                                    <MaterialIcon name="check_circle" filled className="text-xs" />
                                    Completada
                                </span>
                            ) : null}
                        </div>
                        <h3
                            className={cn(
                                "mt-2 font-headline text-base font-medium text-on-surface",
                                isCompleted && "line-through text-on-surface-variant",
                            )}
                        >
                            {task.title}
                        </h3>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                        {/* Link to task detail — visible to everyone with view permission */}
                        <Link
                            aria-label="Ver detalle de tarea"
                            className="flex h-10 w-10 items-center justify-center rounded-full border border-outline-variant/15 bg-surface-container-highest text-on-surface-variant transition-all duration-300 hover:text-primary active:scale-95"
                            params={{ id: task.id }}
                            to="/tasks/$id"
                        >
                            <MaterialIcon name="open_in_new" className="text-base" />
                        </Link>

                        {/* Ping button — only for ping_only and manage */}
                        {canPing ? (
                            <button
                                aria-label={`Enviar ping a ${ownerName} por ${task.title}`}
                                className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-dim text-on-primary shadow-[0_0_16px_rgba(175,162,255,0.32)] transition-all duration-300 hover:scale-105 active:scale-95"
                                onClick={() => setShowPingModal(true)}
                                type="button"
                            >
                                <MaterialIcon name="notifications_active" filled className="text-base" />
                            </button>
                        ) : (
                            <div
                                aria-label="Sin permiso para enviar ping"
                                className="flex h-10 w-10 items-center justify-center rounded-full border border-outline-variant/15 bg-surface-container-highest text-on-surface-variant/30"
                                title="No tienes permiso para enviar ping"
                            >
                                <MaterialIcon name="notifications_off" className="text-base" />
                            </div>
                        )}
                    </div>
                </div>
            </article>

            {showPingModal ? (
                <PingModal
                    ownerName={ownerName}
                    taskId={task.id}
                    taskTitle={task.title}
                    onClose={() => setShowPingModal(false)}
                />
            ) : null}
        </>
    );
}

// ─── Ping modal ───────────────────────────────────────────────────────────────

function PingModal({
    onClose,
    ownerName,
    taskId,
    taskTitle,
}: {
    onClose: () => void;
    ownerName: string;
    taskId: string;
    taskTitle: string;
}) {
    const [message, setMessage] = useState("");
    const pingMutation = useMutation(pingTaskOpts);

    const sendPing = () => {
        pingMutation.mutate(
            { taskId, message: message.trim() || undefined },
            {
                onSuccess: () => {
                    toast.success(`Ping enviado a ${ownerName}`);
                    onClose();
                },
                onError: (error) => {
                    const msg = error.message || "No se pudo enviar el ping";
                    if (msg.includes("ping_rate_limited") || msg.toLowerCase().includes("recientemente")) {
                        toast.error("Ya enviaste un ping en los últimos 5 minutos");
                    } else {
                        toast.error(msg);
                    }
                },
            },
        );
    };

    return (
        <div
            className="fixed inset-0 z-[70] flex items-end justify-center bg-surface-container-lowest/70 px-4 pb-6 backdrop-blur-sm md:items-center"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <section className="w-full max-w-md rounded-xl border border-outline-variant/15 bg-surface-container-low p-6 shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
                <div className="mb-5 flex items-start justify-between gap-4">
                    <div>
                        <h3 className="font-headline text-lg font-bold text-on-surface">
                            Enviar ping
                        </h3>
                        <p className="mt-1 text-sm text-on-surface-variant">
                            Recordarás a{" "}
                            <span className="font-semibold text-on-surface">{ownerName}</span>{" "}
                            sobre{" "}
                            <span className="font-semibold text-on-surface">{taskTitle}</span>.
                        </p>
                    </div>
                    <button
                        aria-label="Cerrar"
                        className="rounded-full p-1 text-on-surface-variant transition-all hover:bg-surface-container-highest hover:text-primary active:scale-95"
                        onClick={onClose}
                        type="button"
                    >
                        <MaterialIcon name="close" />
                    </button>
                </div>

                <label className="block space-y-2">
                    <span className="font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                        Mensaje (opcional)
                    </span>
                    <textarea
                        className="w-full resize-none rounded-lg border border-outline-variant/15 bg-surface-container-lowest px-4 py-3 text-sm text-on-surface outline-none transition-all placeholder:text-on-surface-variant/50 focus:border-primary focus:ring-2 focus:ring-primary/20"
                        maxLength={200}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Ej: ¡No olvides tu tarea de agua! 💧"
                        rows={2}
                        value={message}
                    />
                </label>

                <div className="mt-5 flex gap-3">
                    <button
                        className="flex-1 rounded-full border border-outline-variant/15 bg-surface-container-highest px-4 py-3 font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant transition-all hover:text-primary active:scale-95"
                        disabled={pingMutation.isPending}
                        onClick={onClose}
                        type="button"
                    >
                        Cancelar
                    </button>
                    <button
                        className="flex flex-1 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-primary to-primary-dim px-4 py-3 font-label text-xs font-extrabold uppercase tracking-widest text-on-primary shadow-[0_0_24px_rgba(175,162,255,0.28)] transition-all hover:-translate-y-0.5 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={pingMutation.isPending}
                        onClick={sendPing}
                        type="button"
                    >
                        <MaterialIcon
                            filled
                            name={pingMutation.isPending ? "progress_activity" : "notifications_active"}
                            className={cn("text-sm", pingMutation.isPending && "animate-spin")}
                        />
                        {pingMutation.isPending ? "Enviando..." : "Enviar ping"}
                    </button>
                </div>
            </section>
        </div>
    );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function SharedLoadingState() {
    return (
        <section className="space-y-4">
            {Array.from({ length: 3 }, (_, index) => (
                <div
                    className="h-20 animate-pulse rounded-xl bg-surface-container-low"
                    key={index}
                />
            ))}
        </section>
    );
}

function priorityBar(priority: TaskFeedItem["priority_level"]) {
    switch (priority) {
        case "urgent":
            return "bg-error";
        case "high":
            return "bg-primary";
        case "medium":
            return "bg-tertiary";
        default:
            return "bg-on-surface-variant";
    }
}
