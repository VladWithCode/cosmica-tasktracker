import { create } from "zustand";
import type { ApiResponse } from "@/types/api";
import { getApiError } from "@/types/api";

type NotificationPermissionState = NotificationPermission | "unsupported";

interface VapidKeyData {
    publicKey?: string;
    public_key?: string;
}

interface NotificationState {
    error: string | null;
    isBusy: boolean;
    isSupported: boolean;
    isSubscribed: boolean;
    permission: NotificationPermissionState;
    subscription: PushSubscription | null;
    checkSubscription: () => Promise<void>;
    requestPermission: () => Promise<NotificationPermission>;
    sendTestNotification: () => Promise<number>;
    subscribe: () => Promise<PushSubscription>;
    unsubscribe: () => Promise<void>;
}

export const useNotifications = create<NotificationState>((set, get) => {
    const isSupported = canUsePushNotifications();
    const permission: NotificationPermissionState = isSupported ? Notification.permission : "unsupported";

    return {
        error: null,
        isBusy: false,
        isSupported,
        isSubscribed: false,
        permission,
        subscription: null,
        checkSubscription: async () => {
            if (!canUsePushNotifications()) {
                set({
                    isSupported: false,
                    isSubscribed: false,
                    permission: "unsupported",
                    subscription: null,
                });
                return;
            }

            const registration = await getServiceWorkerRegistration();
            const subscription = await registration.pushManager.getSubscription();
            set({
                error: null,
                isSupported: true,
                isSubscribed: Boolean(subscription),
                permission: Notification.permission,
                subscription,
            });
        },
        requestPermission: async () => {
            if (!canUsePushNotifications()) {
                set({ error: "Tu navegador no soporta notificaciones web", permission: "unsupported" });
                throw new Error("Tu navegador no soporta notificaciones web");
            }

            const permissionResult = await Notification.requestPermission();
            set({ permission: permissionResult });
            return permissionResult;
        },
        sendTestNotification: async () => {
            set({ error: null, isBusy: true });
            try {
                const response = await fetch("/api/v1/notifications/test", {
                    credentials: "include",
                    method: "POST",
                });
                const data = (await response.json()) as ApiResponse<{ sent_count: number }>;
                if (!response.ok) {
                    throw new Error(getApiError(data, "No se pudo enviar la notificación de prueba"));
                }
                return data.data?.sent_count ?? 0;
            } catch (error) {
                const message = toErrorMessage(error);
                set({ error: message });
                throw new Error(message);
            } finally {
                set({ isBusy: false });
            }
        },
        subscribe: async () => {
            set({ error: null, isBusy: true });
            try {
                const state = get();
                if (!state.isSupported || !canUsePushNotifications()) {
                    throw new Error("Tu navegador no soporta notificaciones web");
                }

                let permissionResult = Notification.permission;
                if (permissionResult === "default") {
                    permissionResult = await state.requestPermission();
                }
                if (permissionResult !== "granted") {
                    throw new Error("El permiso de notificaciones fue denegado");
                }

                const publicKey = await fetchVapidPublicKey();
                const registration = await getServiceWorkerRegistration();
                const existingSubscription = await registration.pushManager.getSubscription();
                const subscription =
                    existingSubscription ??
                    (await registration.pushManager.subscribe({
                        applicationServerKey: urlBase64ToUint8Array(publicKey),
                        userVisibleOnly: true,
                    }));

                await saveSubscription(subscription);
                set({
                    error: null,
                    isSubscribed: true,
                    permission: Notification.permission,
                    subscription,
                });

                return subscription;
            } catch (error) {
                const message = toErrorMessage(error);
                set({ error: message });
                throw new Error(message);
            } finally {
                set({ isBusy: false });
            }
        },
        unsubscribe: async () => {
            set({ error: null, isBusy: true });
            try {
                const registration = canUsePushNotifications() ? await getServiceWorkerRegistration() : null;
                const activeSubscription = get().subscription ?? (await registration?.pushManager.getSubscription()) ?? null;
                if (!activeSubscription) {
                    set({ isSubscribed: false, subscription: null });
                    return;
                }

                await deleteSubscription(activeSubscription.endpoint);
                await activeSubscription.unsubscribe();
                set({
                    error: null,
                    isSubscribed: false,
                    permission: canUsePushNotifications() ? Notification.permission : "unsupported",
                    subscription: null,
                });
            } catch (error) {
                const message = toErrorMessage(error);
                set({ error: message });
                throw new Error(message);
            } finally {
                set({ isBusy: false });
            }
        },
    };
});

async function fetchVapidPublicKey(): Promise<string> {
    const response = await fetch("/api/v1/notifications/vapid-public-key", {
        credentials: "include",
        method: "GET",
    });
    const data = (await response.json()) as ApiResponse<VapidKeyData>;
    if (!response.ok) {
        throw new Error(getApiError(data, "Web Push no está configurado"));
    }

    const publicKey = data.data?.publicKey ?? data.data?.public_key;
    if (!publicKey) {
        throw new Error("El servidor no devolvió la llave pública VAPID");
    }
    return publicKey;
}

async function saveSubscription(subscription: PushSubscription): Promise<void> {
    const response = await fetch("/api/v1/notifications/subscriptions", {
        body: JSON.stringify(subscription),
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        method: "POST",
    });
    const data = (await response.json()) as ApiResponse<unknown>;
    if (!response.ok) {
        throw new Error(getApiError(data, "No se pudo guardar la suscripción"));
    }
}

async function deleteSubscription(endpoint: string): Promise<void> {
    const response = await fetch("/api/v1/notifications/subscriptions", {
        body: JSON.stringify({ endpoint }),
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        method: "DELETE",
    });
    const data = (await response.json()) as ApiResponse<unknown>;
    if (!response.ok) {
        throw new Error(getApiError(data, "No se pudo eliminar la suscripción"));
    }
}

async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration> {
    const existingRegistration = await navigator.serviceWorker.getRegistration();
    if (existingRegistration) {
        return existingRegistration;
    }

    return navigator.serviceWorker.register("/notif_sw.js");
}

function canUsePushNotifications() {
    return (
        typeof window !== "undefined" &&
        "Notification" in window &&
        "serviceWorker" in navigator &&
        "PushManager" in window
    );
}

function toErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : "Error inesperado de notificaciones";
}

export function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = window.atob(base64);
    const buffer = new ArrayBuffer(rawData.length);
    const outputArray = new Uint8Array(buffer);

    for (let index = 0; index < rawData.length; index++) {
        outputArray[index] = rawData.charCodeAt(index);
    }
    return buffer;
}
