import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { cn } from "@/lib/utils";
import { useNotifications } from "./notifications";

interface NotificationStatusCopy {
    icon: string;
    label: string;
    tone: string;
}

export function NotificationSettings() {
    const notifications = useNotifications();
    const [isChecking, setIsChecking] = useState(true);

    useEffect(() => {
        let isMounted = true;
        notifications
            .checkSubscription()
            .catch((error: unknown) => {
                if (error instanceof Error) {
                    toast.error(error.message);
                }
            })
            .finally(() => {
                if (isMounted) {
                    setIsChecking(false);
                }
            });

        return () => {
            isMounted = false;
        };
        // Run once on mount. `notifications` is the full Zustand store object and
        // changes reference on every state update — listing it as a dep would cause
        // an infinite loop of checkSubscription() calls.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const status = useMemo(() => getStatusCopy(notifications), [notifications]);
    const canSendTest = notifications.isSubscribed && notifications.permission === "granted";

    const handleEnable = async () => {
        try {
            await notifications.subscribe();
            toast.success("Notificaciones activadas");
        } catch (error) {
            toast.error(toErrorMessage(error));
        }
    };

    const handleDisable = async () => {
        try {
            await notifications.unsubscribe();
            toast.success("Notificaciones desactivadas");
        } catch (error) {
            toast.error(toErrorMessage(error));
        }
    };

    const handleTest = async () => {
        try {
            const sentCount = await notifications.sendTestNotification();
            toast.success(
                sentCount > 0
                    ? "Notificación de prueba enviada"
                    : "No hay suscripciones activas guardadas para probar",
            );
        } catch (error) {
            toast.error(toErrorMessage(error));
        }
    };

    const isDenied = notifications.permission === "denied";

    return (
        <section className="rounded-xl border border-outline-variant/10 bg-surface-container-low p-6 shadow-[0_15px_40px_rgba(0,0,0,0.24)]">
            <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                    <h3 className="flex items-center font-headline text-lg font-bold text-on-surface">
                        <MaterialIcon name="notifications_active" className="mr-2 text-primary" />
                        Notificaciones push
                    </h3>
                    <p className="mt-1 text-sm leading-5 text-on-surface-variant">
                        Avisos en este dispositivo para tareas próximas, pings, recordatorios de agua e invitaciones de sharing.
                    </p>
                </div>
                <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-container-lowest", status.tone)}>
                    <MaterialIcon name={status.icon} filled />
                </div>
            </div>

            <div className="mb-5 rounded-lg border border-outline-variant/10 bg-surface-container-lowest p-4">
                <p className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                    Estado
                </p>
                <p className="mt-1 font-headline text-base font-bold text-on-surface">
                    {isChecking ? "Revisando..." : status.label}
                </p>
                {isDenied ? (
                    <p className="mt-2 text-xs leading-5 text-error">
                        El navegador bloqueó el permiso. Para activarlas, ve a Configuración del sitio en tu navegador y permite notificaciones para esta página, luego vuelve aquí y actívalas.
                    </p>
                ) : notifications.error ? (
                    <p className="mt-2 text-sm text-error">{notifications.error}</p>
                ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
                {notifications.isSubscribed ? (
                    <button
                        className="flex items-center justify-center rounded-full border border-outline-variant/15 bg-surface-container-highest px-4 py-3 font-label text-xs font-bold uppercase tracking-widest text-on-surface transition-all duration-300 hover:bg-surface-variant active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={notifications.isBusy}
                        onClick={handleDisable}
                        type="button"
                    >
                        <MaterialIcon name="notifications_off" className="mr-2 text-sm" />
                        Desactivar
                    </button>
                ) : (
                    <button
                        className="flex items-center justify-center rounded-full bg-gradient-to-r from-primary to-primary-dim px-4 py-3 font-label text-xs font-black uppercase tracking-widest text-on-primary shadow-[0_0_24px_rgba(175,162,255,0.28)] transition-all duration-300 hover:-translate-y-1 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={!notifications.isSupported || isDenied || notifications.isBusy}
                        onClick={handleEnable}
                        title={isDenied ? "Permiso bloqueado por el navegador" : undefined}
                        type="button"
                    >
                        <MaterialIcon name="notifications" className="mr-2 text-sm" />
                        {isDenied ? "Bloqueado" : "Activar"}
                    </button>
                )}
                <button
                    className="flex items-center justify-center rounded-full border border-outline-variant/15 bg-surface-container-highest px-4 py-3 font-label text-xs font-bold uppercase tracking-widest text-primary transition-all duration-300 hover:bg-surface-variant active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!canSendTest || notifications.isBusy}
                    onClick={handleTest}
                    title={!canSendTest ? "Activa las notificaciones primero" : undefined}
                    type="button"
                >
                    <MaterialIcon name="send" className="mr-2 text-sm" />
                    Probar
                </button>
            </div>
        </section>
    );
}

function getStatusCopy(notifications: ReturnType<typeof useNotifications.getState>): NotificationStatusCopy {
    if (!notifications.isSupported) {
        return {
            icon: "block",
            label: "Este navegador no soporta notificaciones push",
            tone: "text-error",
        };
    }
    if (notifications.permission === "denied") {
        return {
            icon: "notifications_off",
            label: "Bloqueadas por el navegador",
            tone: "text-error",
        };
    }
    if (notifications.isSubscribed) {
        return {
            icon: "check_circle",
            label: "Activas en este dispositivo",
            tone: "text-tertiary",
        };
    }
    if (notifications.permission === "granted") {
        return {
            icon: "notifications_paused",
            label: "Permiso concedido · pulsa Activar para suscribirte",
            tone: "text-primary",
        };
    }

    return {
        icon: "notifications",
        label: "Sin activar · el navegador pedirá permiso al activar",
        tone: "text-on-surface-variant",
    };
}

function toErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : "Error inesperado de notificaciones";
}
