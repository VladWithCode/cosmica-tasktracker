/// <reference lib="webworker" />
import { precacheAndRoute } from "workbox-precaching";

declare const self: ServiceWorkerGlobalScope;

interface PushPayload {
    actions?: Array<{
        action: string;
        icon?: string;
        title: string;
    }>;
    badge?: string;
    body?: string;
    data?: Record<string, string>;
    icon?: string;
    requireInteraction?: boolean;
    tag?: string;
    taskId?: string;
    title?: string;
    url?: string;
}

type NotificationOptionsWithActions = NotificationOptions & {
    actions?: Array<{
        action: string;
        icon?: string;
        title: string;
    }>;
};

precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener("install", () => {
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
    const payload = readPushPayload(event);
    const url = payload.url || payload.data?.url || "/tasks";

    const options: NotificationOptionsWithActions = {
            actions: payload.actions || [{ action: "view", title: "Ver tareas" }],
            badge: payload.badge || "/badge-72x72.png",
            body: payload.body || "Tienes tareas próximas o pendientes.",
            data: {
                taskId: payload.taskId || payload.data?.taskId || "",
                url,
                ...payload.data,
            },
            icon: payload.icon || "/icon-192x192.png",
            requireInteraction: payload.requireInteraction ?? false,
            tag: payload.tag || "routine-ritual-task-reminder",
    };

    event.waitUntil(self.registration.showNotification(payload.title || "Routine Ritual", options));
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();

    const notificationData = event.notification.data as { url?: string } | undefined;
    const targetURL = notificationData?.url || "/tasks";

    event.waitUntil(openOrFocusClient(targetURL));
});

function readPushPayload(event: PushEvent): PushPayload {
    if (!event.data) {
        return {};
    }

    try {
        return event.data.json() as PushPayload;
    } catch (error) {
        return {
            body: event.data.text(),
        };
    }
}

async function openOrFocusClient(targetURL: string) {
    const url = new URL(targetURL, self.location.origin).href;
    const clients = await self.clients.matchAll({
        includeUncontrolled: true,
        type: "window",
    });

    for (const client of clients) {
        if ("focus" in client && client.url === url) {
            return client.focus();
        }
    }

    if (self.clients.openWindow) {
        return self.clients.openWindow(url);
    }
}
