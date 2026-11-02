import { api } from "./client";
import { vapidKeySchema } from "./schemas";

export function getVapidPublicKey(): Promise<string> {
    return api("/api/v1/notifications/vapid-public-key", { schema: vapidKeySchema });
}

export async function saveSubscription(subscription: PushSubscriptionJSON): Promise<void> {
    await api("/api/v1/notifications/subscriptions", {
        method: "POST",
        body: { endpoint: subscription.endpoint, keys: subscription.keys },
    });
}

export async function deleteSubscription(endpoint: string): Promise<void> {
    await api("/api/v1/notifications/subscriptions", { method: "DELETE", body: { endpoint } });
}

export async function sendTestNotification(): Promise<void> {
    await api("/api/v1/notifications/test", { method: "POST" });
}
