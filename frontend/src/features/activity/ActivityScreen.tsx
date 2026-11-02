import { useNavigate } from "@tanstack/react-router";
import { BellRing, Inbox, Users } from "lucide-react";
import { BackButton } from "@/components/shell/BackButton";
import { Screen } from "@/components/shell/Screen";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Pressable } from "@/components/ui/Pressable";
import { PullToRefresh } from "@/components/ui/PullToRefresh";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import { useInbox, useInvitations, useMarkActivityRead } from "@/queries/activity";
import { useOwnerStore } from "@/stores/owner";
import { accessLevelInfo } from "@/features/profile/accessLevels";

type ActivityItem =
    | { kind: "inbox"; id: string; createdAt: string; readAt: string | null; title: string; body: string; taskId: string }
    | { kind: "invitation"; id: string; createdAt: string; readAt: string | null; title: string; body: string; ownerUserId: string };

function relativeTime(value: string): string {
    const diff = Date.now() - Date.parse(value);
    const minutes = Math.round(diff / 60_000);
    const format = new Intl.RelativeTimeFormat("es", { numeric: "auto" });
    if (Math.abs(minutes) < 60) return format.format(-minutes, "minute");
    const hours = Math.round(minutes / 60);
    if (Math.abs(hours) < 24) return format.format(-hours, "hour");
    return format.format(-Math.round(hours / 24), "day");
}

export function ActivityScreen() {
    const navigate = useNavigate();
    const inbox = useInbox();
    const invitations = useInvitations();
    const markRead = useMarkActivityRead();
    const setOwner = useOwnerStore((state) => state.setOwner);

    const items: ActivityItem[] = [
        ...(inbox.data ?? []).map(
            (item): ActivityItem => ({
                kind: "inbox",
                id: item.id,
                createdAt: item.createdAt,
                readAt: item.readAt,
                title: `${item.sender.fullname || item.sender.username} te recordó «${item.taskTitle}»`,
                body: item.message,
                taskId: item.taskId,
            }),
        ),
        ...(invitations.data ?? []).map(
            (item): ActivityItem => ({
                kind: "invitation",
                id: item.id,
                createdAt: item.createdAt,
                readAt: item.readAt,
                title: `${item.owner.fullname || item.owner.username} compartió sus tareas contigo`,
                body: `Acceso: ${accessLevelInfo[item.accessLevel].label}`,
                ownerUserId: item.ownerUserId,
            }),
        ),
    ].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

    const open = (item: ActivityItem) => {
        if (!item.readAt) markRead.mutate({ kind: item.kind, id: item.id });
        if (item.kind === "inbox") {
            setOwner(null);
            void navigate({ to: "/", search: { task: item.taskId } });
        } else {
            setOwner(item.ownerUserId);
            void navigate({ to: "/" });
        }
    };

    const loading = inbox.isPending || invitations.isPending;
    const error = inbox.error ?? invitations.error;

    return (
        <Screen title="Actividad" showAvatar={false} leading={<BackButton className="lg:hidden" />}>
            <PullToRefresh onRefresh={() => Promise.all([inbox.refetch(), invitations.refetch()])}>
                {loading ? (
                    <div className="flex flex-col gap-3 px-4 pt-2">
                        <Skeleton className="h-16 rounded-card" />
                        <Skeleton className="h-16 rounded-card" />
                    </div>
                ) : null}
                {error ? <ErrorState error={error} onRetry={() => void Promise.all([inbox.refetch(), invitations.refetch()])} /> : null}
                {!loading && !error && items.length === 0 ? (
                    <EmptyState icon={Inbox} title="Sin actividad" message="Aquí verás los recordatorios que te envíen y quién comparte sus tareas contigo." />
                ) : null}
                {items.length > 0 ? (
                    <ul className="mx-4 overflow-hidden rounded-card bg-bg-elevated">
                        {items.map((item) => {
                            const Icon = item.kind === "inbox" ? BellRing : Users;
                            return (
                                <li key={`${item.kind}-${item.id}`} className="[&+&]:border-t [&+&]:border-separator">
                                    <Pressable pressScale={1} onClick={() => open(item)} className="flex w-full items-start gap-3 px-4 py-3 text-left active:bg-fill-secondary">
                                        <span className="relative mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                                            <Icon aria-hidden className="size-4" />
                                        </span>
                                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                            <span className={cn("text-body", !item.readAt && "font-semibold")}>{item.title}</span>
                                            {item.body ? <span className="text-callout text-label-secondary">{item.body}</span> : null}
                                            <span className="text-footnote text-label-secondary">{relativeTime(item.createdAt)}</span>
                                        </span>
                                        {item.readAt ? null : <span aria-label="Sin leer" role="img" className="mt-2 size-2.5 shrink-0 rounded-full bg-accent" />}
                                    </Pressable>
                                </li>
                            );
                        })}
                    </ul>
                ) : null}
            </PullToRefresh>
        </Screen>
    );
}
