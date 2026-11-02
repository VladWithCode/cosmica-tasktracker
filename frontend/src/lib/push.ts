import { deleteSubscription, getVapidPublicKey, saveSubscription } from "@/api/push";

export type PushState = "unsupported" | "needs-install" | "denied" | "off" | "on";

export function isStandalone(): boolean {
    return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function isIOS(): boolean {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function supportsPush(): boolean {
    return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export async function currentPushState(): Promise<PushState> {
    if (isIOS() && !isStandalone()) return "needs-install";
    if (!supportsPush()) return "unsupported";
    if (Notification.permission === "denied") return "denied";
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return "unsupported";
    const subscription = await registration.pushManager.getSubscription();
    return subscription ? "on" : "off";
}

function urlBase64ToUint8Array(value: string): Uint8Array<ArrayBuffer> {
    const padding = "=".repeat((4 - (value.length % 4)) % 4);
    const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(base64);
    const output = new Uint8Array(new ArrayBuffer(raw.length));
    for (let index = 0; index < raw.length; index++) output[index] = raw.charCodeAt(index);
    return output;
}

export async function enablePush(): Promise<PushState> {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return permission === "denied" ? "denied" : "off";
    const registration = await navigator.serviceWorker.ready;
    const key = await getVapidPublicKey();
    const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) }));
    await saveSubscription(subscription.toJSON());
    return "on";
}

export async function disablePush(): Promise<PushState> {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
        await deleteSubscription(subscription.endpoint).catch(() => undefined);
        await subscription.unsubscribe();
    }
    return "off";
}
