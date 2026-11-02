/// <reference lib="webworker" />
import { createHandlerBoundToURL, precacheAndRoute } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";

declare const self: ServiceWorkerGlobalScope;

type PushAction = { action: string; title: string; icon?: string };

type PushPayload = {
    title?: string;
    body?: string;
    icon?: string;
    badge?: string;
    tag?: string;
    requireInteraction?: boolean;
    url?: string;
    taskId?: string;
    data?: Record<string, string>;
    actions?: PushAction[];
};

type NotificationData = { url: string; taskId: string };

const manifest = self.__WB_MANIFEST;
precacheAndRoute(manifest);

const shellPrecached = manifest.some((entry) => (typeof entry === "string" ? entry : entry.url).replace(/^\//, "") === "index.html");
if (shellPrecached) {
    registerRoute(new NavigationRoute(createHandlerBoundToURL("/index.html"), { denylist: [/^\/api\//] }));
}

self.addEventListener("install", () => {
    void self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(self.clients.claim());
});

function readPayload(event: PushEvent): PushPayload {
    if (!event.data) return {};
    try {
        return event.data.json() as PushPayload;
    } catch {
        return { body: event.data.text() };
    }
}

async function notifyClients(message: { type: string }) {
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of clients) client.postMessage(message);
}

self.addEventListener("push", (event) => {
    const payload = readPayload(event);
    const data: NotificationData = {
        url: payload.url || payload.data?.url || "/",
        taskId: payload.taskId || payload.data?.taskId || "",
    };
    const options: NotificationOptions & { actions?: PushAction[] } = {
        body: payload.body || "Tienes tareas pendientes.",
        icon: payload.icon || "/icon-192x192.png",
        badge: payload.badge || "/badge-72x72.png",
        tag: payload.tag || "cosmica",
        requireInteraction: payload.requireInteraction ?? false,
        actions: payload.actions,
        data,
    };
    event.waitUntil(Promise.all([self.registration.showNotification(payload.title || "Cosmica", options), notifyClients({ type: "push-received" })]));
});

async function completeTask(taskId: string) {
    const response = await fetch(`/api/v1/tasks/${encodeURIComponent(taskId)}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status_level: "completed" }),
    });
    if (!response.ok) throw new Error(`complete failed: ${response.status}`);
    await notifyClients({ type: "task-completed" });
}

async function openOrFocus(path: string) {
    const url = new URL(path, self.location.origin).href;
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const client = clients.find((item) => new URL(item.url).origin === self.location.origin);
    if (client) {
        await client.focus();
        if ("navigate" in client) await client.navigate(url);
        return;
    }
    await self.clients.openWindow(url);
}

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const data = (event.notification.data ?? { url: "/", taskId: "" }) as NotificationData;
    if (event.action === "complete" && data.taskId) {
        event.waitUntil(completeTask(data.taskId).catch(() => openOrFocus(`/tasks/${data.taskId}`)));
        return;
    }
    const target = data.taskId && data.url === "/tasks" ? `/tasks/${data.taskId}` : data.url;
    event.waitUntil(openOrFocus(target));
});
