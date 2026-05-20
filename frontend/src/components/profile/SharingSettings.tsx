import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { cn } from "@/lib/utils";
import {
    createSharingGrantOpts,
    getSharedWithMeOpts,
    getSharingGrantsOpts,
    getSharingInvitationsOpts,
    markInvitationReadOpts,
    revokeSharingGrantOpts,
    searchSharingUsersOpts,
} from "@/queries/sharing";
import type { SharingAccessLevel, SharingGrant, SharingInvitation } from "@/types/sharing";

const accessOptions: Array<{
    description: string;
    label: string;
    value: SharingAccessLevel;
}> = [
    {
        description: "Puede consultar tus tareas compartidas.",
        label: "Ver",
        value: "view",
    },
    {
        description: "Puede crear rutinas, editar tareas y enviar pings.",
        label: "Gestionar",
        value: "manage",
    },
    {
        description: "Sólo puede recordar tareas puntuales.",
        label: "Sólo ping",
        value: "ping_only",
    },
];

export function SharingSettings() {
    const [recipient, setRecipient] = useState("");
    const [accessLevel, setAccessLevel] = useState<SharingAccessLevel>("view");
    const trimmedRecipient = recipient.trim();
    const grantsQuery = useQuery(getSharingGrantsOpts);
    const sharedWithMeQuery = useQuery(getSharedWithMeOpts);
    const invitationsQuery = useQuery(getSharingInvitationsOpts);
    const usersQuery = useQuery(searchSharingUsersOpts(trimmedRecipient));
    const createMutation = useMutation(createSharingGrantOpts);
    const revokeMutation = useMutation(revokeSharingGrantOpts);
    const markReadMutation = useMutation(markInvitationReadOpts);
    const unreadCount = (invitationsQuery.data ?? []).filter((inv) => !inv.read_at).length;
    const users = usersQuery.data ?? [];

    const existingRecipients = useMemo(() => {
        return new Set((grantsQuery.data ?? []).map((grant) => grant.grantee_username));
    }, [grantsQuery.data]);

    function createGrant() {
        if (trimmedRecipient.length < 2) {
            toast.error("Escribe un username o email válido");
            return;
        }
        createMutation.mutate(
            {
                access_level: accessLevel,
                grantee: trimmedRecipient,
            },
            {
                onError: (error) => {
                    toast.error(error.message || "No se pudo compartir acceso");
                },
                onSuccess: () => {
                    toast.success("Permiso compartido");
                    setRecipient("");
                    setAccessLevel("view");
                },
            },
        );
    }

    return (
        <section className="rounded-xl border border-outline-variant/10 bg-surface-container-low p-6 shadow-[0_15px_40px_rgba(0,0,0,0.24)]">
            <div className="mb-6 flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <MaterialIcon name="group_add" />
                </div>
                <div>
                    <h3 className="font-headline text-lg font-bold text-on-surface">
                        Compartir responsabilidad
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-on-surface-variant">
                        Concede acceso controlado a otra persona por username o email.
                    </p>
                </div>
            </div>

            <div className="grid gap-4">
                <label className="space-y-2">
                    <span className="block font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                        Usuario o email
                    </span>
                    <input
                        className="w-full rounded-lg border border-outline-variant/15 bg-surface-container-lowest px-4 py-3 text-sm font-semibold text-on-surface outline-none transition-all duration-300 placeholder:text-on-surface-variant/50 focus:border-primary focus:ring-2 focus:ring-primary/20"
                        onChange={(event) => setRecipient(event.target.value)}
                        placeholder="angie o angie@example.com"
                        type="text"
                        value={recipient}
                    />
                </label>

                {users.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                        {users.map((user) => (
                            <button
                                className={cn(
                                    "rounded-full border px-3 py-2 text-xs font-bold transition-all duration-300 hover:-translate-y-1 active:scale-95",
                                    existingRecipients.has(user.username)
                                        ? "border-primary/20 bg-primary/10 text-primary"
                                        : "border-outline-variant/15 bg-surface-container-highest text-on-surface-variant",
                                )}
                                key={user.id}
                                onClick={() => setRecipient(user.username)}
                                type="button"
                            >
                                @{user.username}
                            </button>
                        ))}
                    </div>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-3">
                    {accessOptions.map((option) => (
                        <button
                            aria-pressed={accessLevel === option.value}
                            className={cn(
                                "rounded-xl border p-4 text-left transition-all duration-300 hover:-translate-y-1 active:scale-95",
                                accessLevel === option.value
                                    ? "border-primary/40 bg-primary/15 text-primary"
                                    : "border-outline-variant/15 bg-surface-container-highest text-on-surface-variant",
                            )}
                            key={option.value}
                            onClick={() => setAccessLevel(option.value)}
                            type="button"
                        >
                            <span className="block font-label text-xs font-bold uppercase tracking-widest">
                                {option.label}
                            </span>
                            <span className="mt-2 block text-xs leading-5">{option.description}</span>
                        </button>
                    ))}
                </div>

                <button
                    className="flex w-full items-center justify-center rounded-full bg-gradient-to-r from-primary to-primary-dim px-4 py-3 font-label text-sm font-extrabold uppercase tracking-widest text-on-primary shadow-[0_15px_40px_rgba(175,162,255,0.25)] transition-all duration-300 hover:-translate-y-1 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={createMutation.isPending || trimmedRecipient.length < 2}
                    onClick={createGrant}
                    type="button"
                >
                    <MaterialIcon name="share" className="mr-2 text-base" />
                    {createMutation.isPending ? "Compartiendo..." : "Compartir acceso"}
                </button>
            </div>

            {/* Permisos que yo otorgué */}
            <div className="mt-6 space-y-3">
                <p className="font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                    Accesos que yo otorgué
                </p>
                {grantsQuery.isLoading ? <SharingListSkeleton /> : null}
                {grantsQuery.isError ? (
                    <div className="rounded-lg border border-error/20 bg-error/10 p-4 text-sm text-error">
                        No se pudieron cargar los permisos.
                    </div>
                ) : null}
                {!grantsQuery.isLoading && !grantsQuery.isError && (grantsQuery.data ?? []).length === 0 ? (
                    <div className="rounded-lg border border-outline-variant/10 bg-surface-container-lowest p-4 text-sm text-on-surface-variant">
                        Aún no compartiste tus tareas con nadie.
                    </div>
                ) : null}
                {(grantsQuery.data ?? []).map((grant) => (
                    <SharingGrantRow
                        grant={grant}
                        isRevoking={revokeMutation.isPending}
                        key={grant.id}
                        onRevoke={(grantId) =>
                            revokeMutation.mutate(grantId, {
                                onError: (error) =>
                                    toast.error(error.message || "No se pudo revocar el permiso"),
                                onSuccess: () => toast.success("Permiso revocado"),
                            })
                        }
                    />
                ))}
            </div>

            {/* Invitaciones recibidas */}
            <div className="mt-6 space-y-3">
                <div className="flex items-center gap-2">
                    <p className="font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                        Invitaciones
                    </p>
                    {unreadCount > 0 ? (
                        <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 font-label text-[10px] font-extrabold text-on-primary">
                            {unreadCount}
                        </span>
                    ) : null}
                </div>
                {invitationsQuery.isLoading ? <SharingListSkeleton /> : null}
                {invitationsQuery.isError ? (
                    <div className="rounded-lg border border-error/20 bg-error/10 p-4 text-sm text-error">
                        No se pudieron cargar las invitaciones.
                    </div>
                ) : null}
                {!invitationsQuery.isLoading && !invitationsQuery.isError && (invitationsQuery.data ?? []).length === 0 ? (
                    <div className="rounded-lg border border-outline-variant/10 bg-surface-container-lowest p-4 text-sm text-on-surface-variant">
                        Sin invitaciones nuevas.
                    </div>
                ) : null}
                {(invitationsQuery.data ?? []).map((inv) => (
                    <InvitationRow
                        invitation={inv}
                        isMarking={markReadMutation.isPending}
                        key={inv.id}
                        onMarkRead={(id) =>
                            markReadMutation.mutate(id, {
                                onError: (error) =>
                                    toast.error(error.message || "No se pudo marcar como leída"),
                            })
                        }
                    />
                ))}
            </div>

            {/* Permisos que yo recibí */}
            <div className="mt-6 space-y-3">
                <p className="font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                    Accesos que recibí
                </p>
                {sharedWithMeQuery.isLoading ? <SharingListSkeleton /> : null}
                {sharedWithMeQuery.isError ? (
                    <div className="rounded-lg border border-error/20 bg-error/10 p-4 text-sm text-error">
                        No se pudieron cargar los accesos recibidos.
                    </div>
                ) : null}
                {!sharedWithMeQuery.isLoading && !sharedWithMeQuery.isError && (sharedWithMeQuery.data ?? []).length === 0 ? (
                    <div className="rounded-lg border border-outline-variant/10 bg-surface-container-lowest p-4 text-sm text-on-surface-variant">
                        Nadie te ha compartido acceso a sus tareas.
                    </div>
                ) : null}
                {(sharedWithMeQuery.data ?? []).map((grant) => (
                    <ReceivedGrantRow grant={grant} key={grant.id} />
                ))}
            </div>
        </section>
    );
}

function SharingGrantRow({
    grant,
    isRevoking,
    onRevoke,
}: {
    grant: SharingGrant;
    isRevoking: boolean;
    onRevoke: (grantId: string) => void;
}) {
    return (
        <article className="flex items-center justify-between gap-4 rounded-lg border border-outline-variant/10 bg-surface-container-lowest p-4">
            <div className="min-w-0">
                <p className="truncate text-sm font-bold text-on-surface">
                    {grant.grantee_fullname || grant.grantee_username}
                </p>
                <p className="mt-1 truncate text-xs text-on-surface-variant">
                    @{grant.grantee_username} · {formatAccessLevel(grant.access_level)}
                </p>
            </div>
            <button
                className="rounded-full border border-error/20 bg-error/10 px-3 py-2 text-xs font-bold text-error transition-all duration-300 hover:bg-error/20 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isRevoking}
                onClick={() => onRevoke(grant.id)}
                type="button"
            >
                Revocar
            </button>
        </article>
    );
}

function ReceivedGrantRow({ grant }: { grant: SharingGrant }) {
    return (
        <article className="flex items-center justify-between gap-4 rounded-lg border border-outline-variant/10 bg-surface-container-lowest p-4">
            <div className="min-w-0">
                <p className="truncate text-sm font-bold text-on-surface">
                    {grant.owner_fullname || grant.owner_username}
                </p>
                <p className="mt-1 truncate text-xs text-on-surface-variant">
                    @{grant.owner_username} · {formatAccessLevel(grant.access_level)}
                </p>
            </div>
            <Link
                className="shrink-0 inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 font-label text-[10px] font-bold uppercase tracking-widest text-primary transition-all duration-300 hover:bg-primary/20 active:scale-95"
                params={{ userId: grant.owner_user_id }}
                to="/shared/$userId"
            >
                <MaterialIcon name="open_in_new" className="text-xs" />
                Ver tareas
            </Link>
        </article>
    );
}

function InvitationRow({
    invitation,
    isMarking,
    onMarkRead,
}: {
    invitation: SharingInvitation;
    isMarking: boolean;
    onMarkRead: (id: string) => void;
}) {
    const isUnread = !invitation.read_at;
    const ownerName = invitation.owner_fullname || `@${invitation.owner_username}`;
    return (
        <article
            className={cn(
                "flex items-center justify-between gap-4 rounded-lg border p-4 transition-all duration-300",
                isUnread
                    ? "border-primary/20 bg-primary/5"
                    : "border-outline-variant/10 bg-surface-container-lowest opacity-70",
            )}
        >
            <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-on-surface">
                    {ownerName}
                </p>
                <p className="mt-0.5 truncate text-xs text-on-surface-variant">
                    @{invitation.owner_username} · {formatAccessLevel(invitation.access_level as SharingAccessLevel)} · compartió contigo
                </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
                <Link
                    className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 font-label text-[10px] font-bold uppercase tracking-widest text-primary transition-all duration-300 hover:bg-primary/20 active:scale-95"
                    params={{ userId: invitation.owner_user_id }}
                    to="/shared/$userId"
                >
                    <MaterialIcon name="open_in_new" className="text-xs" />
                    Ver tareas
                </Link>
                {isUnread ? (
                    <button
                        className="rounded-full border border-outline-variant/20 bg-surface-container-highest px-2 py-1 font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant transition-all duration-300 hover:bg-surface-container-high active:scale-95 disabled:opacity-50"
                        disabled={isMarking}
                        onClick={() => onMarkRead(invitation.id)}
                        type="button"
                    >
                        Leída
                    </button>
                ) : null}
            </div>
        </article>
    );
}

function SharingListSkeleton() {
    return (
        <div className="space-y-3">
            {Array.from({ length: 2 }, (_, index) => (
                <div className="h-16 animate-pulse rounded-lg bg-surface-container-high" key={index} />
            ))}
        </div>
    );
}

function formatAccessLevel(level: SharingAccessLevel) {
    switch (level) {
        case "manage":
            return "Gestionar";
        case "ping_only":
            return "Sólo ping";
        case "view":
        default:
            return "Ver";
    }
}
