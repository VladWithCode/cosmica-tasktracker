import { useEffect, useState } from "react";
import { BellRing, Send, Share } from "lucide-react";
import { errorMessage } from "@/api/client";
import { sendTestNotification } from "@/api/push";
import { GroupedRow, GroupedSection } from "@/components/ui/GroupedList";
import { Spinner } from "@/components/ui/Spinner";
import { Switch } from "@/components/ui/Switch";
import { currentPushState, disablePush, enablePush, type PushState } from "@/lib/push";
import { toast } from "@/stores/toast";

const footers: Record<PushState, string> = {
    unsupported: "Este navegador no admite notificaciones push.",
    "needs-install": "",
    denied: "Bloqueaste las notificaciones. Actívalas en la configuración del navegador para este sitio.",
    off: "Recibe avisos de tareas próximas, recordatorios de agua y recordatorios que te envíen.",
    on: "Las notificaciones están activas en este dispositivo.",
};

export function NotificationSection() {
    const [state, setState] = useState<PushState | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        let cancelled = false;
        void currentPushState()
            .then((next) => {
                if (!cancelled) setState(next);
            })
            .catch(() => {
                if (!cancelled) setState("unsupported");
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const run = async (action: () => Promise<PushState | void>, success?: string) => {
        setBusy(true);
        try {
            const next = await action();
            if (next) setState(next);
            if (success) toast.show(success);
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setBusy(false);
        }
    };

    if (state === "needs-install") {
        return (
            <GroupedSection title="Notificaciones" footer="En iPhone y iPad, las notificaciones solo funcionan con Cosmica en la pantalla de inicio.">
                <GroupedRow
                    icon={<Share aria-hidden className="size-5 text-accent" />}
                    label={<span className="whitespace-normal">Toca Compartir y luego «Añadir a pantalla de inicio». Abre Cosmica desde ahí.</span>}
                />
            </GroupedSection>
        );
    }

    return (
        <GroupedSection title="Notificaciones" footer={state ? footers[state] : undefined}>
            <GroupedRow
                icon={<BellRing aria-hidden className="size-5 text-label-secondary" />}
                label="Notificaciones push"
                trailing={
                    state === null ? (
                        <Spinner className="size-4 text-label-tertiary" />
                    ) : (
                        <Switch
                            label="Notificaciones push"
                            checked={state === "on"}
                            disabled={busy || state === "unsupported" || state === "denied"}
                            onChange={(checked) => void run(checked ? enablePush : disablePush, checked ? "Notificaciones activadas" : "Notificaciones desactivadas")}
                        />
                    )
                }
            />
            {state === "on" ? (
                <GroupedRow
                    icon={<Send aria-hidden className="size-5 text-accent" />}
                    label="Enviar notificación de prueba"
                    tone="accent"
                    disabled={busy}
                    onPress={() => void run(sendTestNotification, "Notificación de prueba enviada")}
                />
            ) : null}
        </GroupedSection>
    );
}
