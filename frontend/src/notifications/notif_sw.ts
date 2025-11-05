/// <reference lib="webworker" />
import { markTaskAsCompleted } from '@/queries/tasks';
import { precacheAndRoute } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope;

// Workbox will inject precache manifest here
precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener('install', () => {
    console.log('Service Worker installing...');
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('Service Worker activating...');
    event.waitUntil(self.clients.claim());
});

// Handle push notifications
self.addEventListener('push', (event) => {
    console.log('Push notification received:', event);

    let notificationData: NotificationOptions = {
        body: 'Tienes tareas activas o pendientes por completar',
        icon: '/icon-192x192.png',
        badge: '/badge-72x72.png',
        tag: 'task-reminder',
        requireInteraction: true,
        data: {
            url: '/tasks',
            taskId: null,
        }
    };

    let notifTitle = 'Recordatorio de Tareas';
    if (event.data) {
        try {
            const data = event.data.json();
            notifTitle = data.title || 'Recordatorio de Tareas';
            notificationData = {
                body: data.body || 'You have a pending task',
                icon: data.icon || '/icon-192x192.png',
                badge: data.badge || '/badge-72x72.png',
                tag: data.tag || 'task-reminder',
                requireInteraction: data.requireInteraction || true,
                data: {
                    url: data.url || '/tasks',
                    taskId: data.taskId || null,
                    ...data.data,
                },
                actions: data.actions || [
                    { action: 'view', title: 'Ver', icon: '/icons/view.png' },
                    { action: 'complete', title: 'Completar', icon: '/icons/check.png' },
                ],
            };
        } catch (error) {
            console.error('Error parsing push data:', error);
        }
    }

    event.waitUntil(
        self.registration.showNotification(notifTitle, notificationData)
    );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
    console.log('Notification clicked:', event);

    event.notification.close();

    const urlToOpen = event.notification.data?.url || '/tasks';
    const taskId = event.notification.data?.taskId;

    // Handle action buttons
    if (event.action === 'complete' && taskId) {
        // Send request to complete task
        event.waitUntil(
            markTaskAsCompleted({ taskId })
                .then(() => {
                    // Optionally show success notification
                    return self.registration.showNotification('Tarea Completada', {
                        body: 'Has completado la tarea.',
                        icon: '/icon-192x192.png',
                        tag: 'task-complete',
                    });
                })
                .catch((error) => {
                    console.error('Error completing task:', error);
                })
        );
    }

    // Open or focus the app
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // Check if app is already open
                for (const client of clientList) {
                    if (client.url.includes(urlToOpen) && 'focus' in client) {
                        return client.focus();
                    }
                }
                // Open new window if not open
                if (self.clients.openWindow) {
                    return self.clients.openWindow(urlToOpen);
                }
            })
    );
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
    console.log('Notification closed:', event);

    // TODO: Implement dismissal tracking
    // Track that user dismissed the notification
    // event.waitUntil(
    //     fetch('/api/v1/notifications/dismissed', {
    //         method: 'POST',
    //         headers: { 'Content-Type': 'application/json' },
    //         credentials: 'include',
    //         body: JSON.stringify({
    //             notificationTag: event.notification.tag,
    //             taskId: event.notification.data?.taskId,
    //         }),
    //     }).catch((error) => {
    //         console.error('Error tracking dismissal:', error);
    //     })
    // );
});
