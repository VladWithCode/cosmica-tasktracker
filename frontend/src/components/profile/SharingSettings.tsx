import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { cn } from "@/lib/utils";
import {
    createSharingGrantOpts,
    getSharingGrantsOpts,
    revokeSharingGrantOpts,
    searchSharingUsersOpts,
} from "@/queries/sharing";
import type { SharingAccessLevel, SharingGrant } from "@/types/sharing";

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
    const usersQuery = useQuery(searchSharingUsersOpts(trimmedRecipient));
    const createMutation = useMutation(createSharingGrantOpts);
    const revokeMutation = useMutation(revokeSharingGrantOpts);
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

            <div className="mt-6 space-y-3">
                <p className="font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                    Accesos activos
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
