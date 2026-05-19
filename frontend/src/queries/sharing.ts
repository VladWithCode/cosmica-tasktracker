import { mutationOptions, queryOptions } from "@tanstack/react-query";
import type { ApiResponse } from "@/types/api";
import { getApiError } from "@/types/api";
import type {
    CreateSharingGrantInput,
    PingTaskResult,
    SharingGrant,
    SharingInvitation,
    SharingUser,
} from "@/types/sharing";
import { queryClient } from "./queryClient";

interface GrantsData {
    grants: SharingGrant[];
}

interface InvitationsData {
    invitations: SharingInvitation[];
}

interface GrantData {
    grant: SharingGrant;
}

interface UsersData {
    users: SharingUser[];
}

type PingData = PingTaskResult;

export const SharingQueryKeys = {
    all: () => ["sharing"] as const,
    grants: () => [...SharingQueryKeys.all(), "grants"] as const,
    sharedWithMe: () => [...SharingQueryKeys.all(), "shared-with-me"] as const,
    invitations: () => [...SharingQueryKeys.all(), "invitations"] as const,
    users: (query: string) => [...SharingQueryKeys.all(), "users", query] as const,
} as const;

export const getSharingGrantsOpts = queryOptions({
    queryKey: SharingQueryKeys.grants(),
    queryFn: getSharingGrants,
});

export const getSharedWithMeOpts = queryOptions({
    queryKey: SharingQueryKeys.sharedWithMe(),
    queryFn: getSharedWithMe,
    staleTime: 30 * 1000,
});

export function searchSharingUsersOpts(query: string) {
    return queryOptions({
        enabled: query.trim().length >= 2,
        queryKey: SharingQueryKeys.users(query.trim()),
        queryFn: () => searchSharingUsers(query),
        staleTime: 30 * 1000,
    });
}

export const createSharingGrantOpts = mutationOptions({
    mutationFn: createSharingGrant,
    onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: SharingQueryKeys.grants() });
    },
});

export const revokeSharingGrantOpts = mutationOptions({
    mutationFn: revokeSharingGrant,
    onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: SharingQueryKeys.grants() });
    },
});

export const getSharingInvitationsOpts = queryOptions({
    queryKey: SharingQueryKeys.invitations(),
    queryFn: getSharingInvitations,
    staleTime: 30 * 1000,
});

export const markInvitationReadOpts = mutationOptions({
    mutationFn: markInvitationRead,
    onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: SharingQueryKeys.invitations() });
    },
});

export const pingTaskOpts = mutationOptions({
    mutationFn: pingTask,
});

export async function getSharingGrants(): Promise<SharingGrant[]> {
    const response = await fetch("/api/v1/sharing/grants", {
        credentials: "include",
        method: "GET",
    });
    const data = (await response.json()) as ApiResponse<GrantsData>;
    if (!response.ok) {
        throw new Error(getApiError(data, "No se pudieron cargar los permisos"));
    }
    return data.data?.grants ?? [];
}

export async function getSharedWithMe(): Promise<SharingGrant[]> {
    const response = await fetch("/api/v1/sharing/shared-with-me", {
        credentials: "include",
        method: "GET",
    });
    const data = (await response.json()) as ApiResponse<GrantsData>;
    if (!response.ok) {
        throw new Error(getApiError(data, "No se pudieron cargar los accesos compartidos"));
    }
    return data.data?.grants ?? [];
}

export async function searchSharingUsers(query: string): Promise<SharingUser[]> {
    const params = new URLSearchParams({ q: query.trim() });
    const response = await fetch(`/api/v1/sharing/users/search?${params.toString()}`, {
        credentials: "include",
        method: "GET",
    });
    const data = (await response.json()) as ApiResponse<UsersData>;
    if (!response.ok) {
        throw new Error(getApiError(data, "No se pudieron buscar usuarios"));
    }
    return data.data?.users ?? [];
}

export async function createSharingGrant(
    input: CreateSharingGrantInput,
): Promise<SharingGrant> {
    const response = await fetch("/api/v1/sharing/grants", {
        body: JSON.stringify(input),
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
        },
        method: "POST",
    });
    const data = (await response.json()) as ApiResponse<GrantData>;
    if (!response.ok) {
        throw new Error(getApiError(data, "No se pudo crear el permiso"));
    }
    if (!data.data?.grant) {
        throw new Error("La respuesta no incluyó el permiso");
    }
    return data.data.grant;
}

export async function revokeSharingGrant(grantId: string): Promise<void> {
    const response = await fetch(`/api/v1/sharing/grants/${grantId}`, {
        credentials: "include",
        method: "DELETE",
    });
    const data = (await response.json()) as ApiResponse<Record<string, never>>;
    if (!response.ok) {
        throw new Error(getApiError(data, "No se pudo revocar el permiso"));
    }
}

export async function getSharingInvitations(): Promise<SharingInvitation[]> {
    const response = await fetch("/api/v1/sharing/invitations", {
        credentials: "include",
        method: "GET",
    });
    const data = (await response.json()) as ApiResponse<InvitationsData>;
    if (!response.ok) {
        throw new Error(getApiError(data, "No se pudieron cargar las invitaciones"));
    }
    return data.data?.invitations ?? [];
}

export async function markInvitationRead(invitationId: string): Promise<void> {
    const response = await fetch(`/api/v1/sharing/invitations/${invitationId}/read`, {
        credentials: "include",
        method: "POST",
    });
    const data = (await response.json()) as ApiResponse<Record<string, never>>;
    if (!response.ok) {
        throw new Error(getApiError(data, "No se pudo marcar como leída"));
    }
}

export async function pingTask({
    message,
    taskId,
}: {
    message?: string;
    taskId: string;
}): Promise<PingTaskResult> {
    const response = await fetch(`/api/v1/tasks/${taskId}/ping`, {
        body: JSON.stringify({ message: message?.trim() ?? "" }),
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
        },
        method: "POST",
    });
    const data = (await response.json()) as ApiResponse<PingData>;
    if (!response.ok) {
        throw new Error(getApiError(data, "No se pudo enviar el ping"));
    }
    if (!data.data) {
        throw new Error("La respuesta no incluyó el ping");
    }
    return data.data;
}
