import { useMutation } from "@tanstack/react-query";
import { create } from "zustand";

type NotificationState = {
    enabled: boolean;
    isSupported: boolean;
    isSubscribed: boolean;
    permission: NotificationPermission | "unsupported";
    subscription: PushSubscription | null;
    vapidKey: string;
    checkSubscription: () => Promise<void>;
    subscribe: (publicKey: string) => Promise<PushSubscription>;
    unsubscribe: () => Promise<void>;
    requestPermission: () => Promise<NotificationPermission>;
};

export const useNotifications = create<NotificationState>((set, get) => {
    const isSupported = "Notification" in window &&
        'serviceWorker' in navigator &&
        'PushManager' in window;

    let permission: NotificationPermission | "unsupported" = isSupported ? Notification.permission : "unsupported";

    if (isSupported && permission === "default") {
        Notification.requestPermission().then(newPerm => {
            permission = newPerm;
            set({ enabled: newPerm === "granted", permission: newPerm });
        });
    }

    return {
        enabled: permission === "granted",
        isSupported,
        isSubscribed: false,
        permission,
        subscription: null,
        vapidKey: import.meta.env.VITE_VAPID_PUBLIC_KEY,
        checkSubscription: async () => {
            try {
                const registration = await navigator.serviceWorker.ready;
                const subscription = await registration.pushManager.getSubscription();
                set({
                    isSubscribed: !!subscription,
                    subscription: subscription,
                });
            } catch (error) {
                console.error('Error checking subscription:', error);
            }
        },
        subscribe: async (publicKey) => {
            const state = get();
            if (state.isSubscribed) {
                if (state.subscription) {
                    return state.subscription;
                }
                throw new Error('No active subscription found');
            }

            if (!state.isSupported) {
                throw new Error('Notifications not supported');
            }
            if (!state.enabled) {
                const permission = await state.requestPermission();
                if (permission !== 'granted') {
                    throw new Error('Notification permission denied');
                }
            }

            const registration = await navigator.serviceWorker.ready;

            try {
                const subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(publicKey),
                });

                set({
                    isSubscribed: true,
                    subscription,
                });

                fetch('/api/v1/notifications/subscribe', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(subscription),
                })
                    .then(res => res.json())
                    .then(data => console.log(data))
                    .catch(console.error);

                return subscription;
            } catch (error) {
                console.error('Error subscribing:', error);
                throw error;
            }
        },

        unsubscribe: async (): Promise<void> => {
            const state = get();
            if (!state.subscription) {
                throw new Error('No active subscription');
            }

            await state.subscription.unsubscribe();

            set({
                isSubscribed: false,
                subscription: null,
            });
        },
        requestPermission: async () => {
            const state = get();
            if (!state.isSupported) {
                throw new Error('Notifications not supported');
            }

            const permission = await Notification.requestPermission();
            set({ enabled: permission === "granted", permission });
            return permission;
        },
    };
});

// Hook for managing subscription on the server
export function useNotificationSubscription() {
    const saveSubscription = useMutation({
        mutationFn: async (subscription: PushSubscription) => {
            const response = await fetch('/api/v1/notifications/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(subscription),
            });

            if (!response.ok) {
                throw new Error('Failed to save subscription');
            }

            return response.json();
        },
    });

    const removeSubscription = useMutation({
        mutationFn: async (endpoint: string) => {
            const response = await fetch('/api/v1/notifications/unsubscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ endpoint }),
            });

            if (!response.ok) {
                throw new Error('Failed to remove subscription');
            }

            return response.json();
        },
    });

    return {
        saveSubscription,
        removeSubscription,
    };
}

// Convert VAPID public key to Uint8Array
export function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const buffer = new ArrayBuffer(rawData.length);
    const outputArray = new Uint8Array(buffer);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return buffer;
}
