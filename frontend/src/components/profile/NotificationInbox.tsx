import { Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { cn } from "@/lib/utils";
import { getNotificationInboxOpts, markNotificationReadOpts } from "@/queries/notifications";
import type { NotificationInboxItem } from "@/types/sharing";

export function NotificationInbox() {
    const inboxQuery = useQuery(getNotificationInboxOpts);
    const markReadMutation = useMutation(markNotificationReadOpts);
    const items = inboxQuery.data ?? [];

    return (
        <section className="rounded-xl border border-outline-variant/10 bg-surface-container-low p-6 shadow-[0_15px_40px_rgba(0,0,0,0.24)]">
            <div className="mb-6 flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-tertiary/10 text-tertiary">
                    <MaterialIcon name="inbox" />
                </div>
                <div>
                    <h3 className="font-headline text-lg font-bold text-on-surface">
                        Bandeja de pings
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-on-surface-variant">
                        Revisa recordatorios recibidos y márcalos como leídos.
                    </p>
                </div>
            </div>

            {inboxQuery.isLoading ? <InboxSkeleton /> : null}
            {inboxQuery.isError ? (
                <div className="rounded-lg border border-error/20 bg-error/10 p-4 text-sm text-error">
                    No se pudo cargar la bandeja.
                </div>
            ) : null}
            {!inboxQuery.isLoading && !inboxQuery.isError && items.length === 0 ? (
                <div className="rounded-lg border border-outline-variant/10 bg-surface-container-lowest p-4 text-sm text-on-surface-variant">
                    No tienes pings pendientes.
                </div>
            ) : null}
            {items.length > 0 ? (
                <div className="space-y-3">
                    {items.map((item) => (
                        <InboxItem
                            isMarking={markReadMutation.isPending}
                            item={item}
                            key={item.id}
                            onMarkRead={(id) =>
                                markReadMutation.mutate(id, {
                                    onError: (error) =>
                                        toast.error(error.message || "No se pudo marcar como leído"),
                                    onSuccess: () => toast.success("Ping marcado como leído"),
                                })
                            }
                        />
                    ))}
                </div>
            ) : null}
        </section>
    );
}

function InboxItem({
    isMarking,
    item,
    onMarkRead,
}: {
    isMarking: boolean;
    item: NotificationInboxItem;
    onMarkRead: (id: string) => void;
}) {
    const unread = !item.read_at;

    return (
        <article
            className={cn(
                "rounded-lg border p-4 transition-all duration-300",
                unread
                    ? "border-primary/30 bg-primary/10"
                    : "border-outline-variant/10 bg-surface-container-lowest",
            )}
        >
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <p className="text-sm font-bold text-on-surface">
                        {item.sender_fullname || item.sender_username}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-on-surface-variant">
                        Te recordó <span className="font-semibold text-on-surface">{item.task_title}</span>
                        {item.message ? `: ${item.message}` : ""}
                    </p>
                    <p className="mt-2 font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                        {formatInboxDate(item.created_at)}
                    </p>
                </div>
                {unread ? (
                    <span className="rounded-full bg-primary/15 px-2 py-1 font-label text-[10px] font-extrabold uppercase tracking-widest text-primary">
                        Nuevo
                    </span>
                ) : null}
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Link
                    className="inline-flex items-center justify-center rounded-full border border-outline-variant/15 bg-surface-container-highest px-3 py-2 text-xs font-bold text-primary transition-all duration-300 hover:-translate-y-1 active:scale-95"
                    to="/tasks/$id"
                    params={{ id: item.task_id }}
                >
                    <MaterialIcon name="open_in_new" className="mr-1 text-sm" />
                    Ver tarea
                </Link>
                {unread ? (
                    <button
                        className="inline-flex items-center justify-center rounded-full border border-outline-variant/15 bg-surface-container-highest px-3 py-2 text-xs font-bold text-on-surface-variant transition-all duration-300 hover:-translate-y-1 hover:text-primary active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={isMarking}
                        onClick={() => onMarkRead(item.id)}
                        type="button"
                    >
                        <MaterialIcon name="done" className="mr-1 text-sm" />
                        Marcar leído
                    </button>
                ) : null}
            </div>
        </article>
    );
}

function InboxSkeleton() {
    return (
        <div className="space-y-3">
            {Array.from({ length: 3 }, (_, index) => (
                <div className="h-24 animate-pulse rounded-lg bg-surface-container-high" key={index} />
            ))}
        </div>
    );
}

function formatInboxDate(value: string) {
    return new Date(value).toLocaleString("es-MX", {
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        month: "short",
    });
}
