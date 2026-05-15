import { mutationOptions, queryOptions } from "@tanstack/react-query";
import type { ApiResponse } from "@/types/api";
import { getApiError } from "@/types/api";
import type { NotificationInboxItem } from "@/types/sharing";
import { queryClient } from "./queryClient";

interface InboxData {
    items: NotificationInboxItem[];
}

export const NotificationsQueryKeys = {
    all: () => ["notifications"] as const,
    inbox: () => [...NotificationsQueryKeys.all(), "inbox"] as const,
} as const;

export const getNotificationInboxOpts = queryOptions({
    queryKey: NotificationsQueryKeys.inbox(),
    queryFn: getNotificationInbox,
    staleTime: 30 * 1000,
});

export const markNotificationReadOpts = mutationOptions({
    mutationFn: markNotificationRead,
    onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: NotificationsQueryKeys.inbox() });
    },
});

export async function getNotificationInbox(): Promise<NotificationInboxItem[]> {
    const response = await fetch("/api/v1/notifications/inbox", {
        credentials: "include",
        method: "GET",
    });
    const data = (await response.json()) as ApiResponse<InboxData>;
    if (!response.ok) {
        throw new Error(getApiError(data, "No se pudo cargar la bandeja"));
    }
    return data.data?.items ?? [];
}

export async function markNotificationRead(id: string): Promise<void> {
    const response = await fetch(`/api/v1/notifications/inbox/${id}/read`, {
        credentials: "include",
        method: "POST",
    });
    const data = (await response.json()) as ApiResponse<Record<string, never>>;
    if (!response.ok) {
        throw new Error(getApiError(data, "No se pudo marcar como leído"));
    }
}
