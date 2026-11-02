import { useState } from "react";
import type { TaskItem } from "@/api/schemas";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { usePingTask } from "@/queries/tasks";

export function PingSheet({ task, ownerName, onClose }: { task: Pick<TaskItem, "id" | "title"> | null; ownerName: string | null; onClose: () => void }) {
    return (
        <Sheet open={task !== null} onOpenChange={(open) => (open ? undefined : onClose())} title="Enviar recordatorio" description="Recordar una tarea pendiente">
            {task ? <PingForm key={task.id} task={task} ownerName={ownerName} onDone={onClose} /> : null}
        </Sheet>
    );
}

function PingForm({ task, ownerName, onDone }: { task: Pick<TaskItem, "id" | "title">; ownerName: string | null; onDone: () => void }) {
    const [message, setMessage] = useState("");
    const ping = usePingTask();
    return (
        <form
            noValidate
            className="flex flex-col gap-4 px-4"
            onSubmit={(event) => {
                event.preventDefault();
                ping.mutate({ id: task.id, message: message.trim() }, { onSuccess: onDone });
            }}
        >
            <p className="text-callout text-label-secondary">
                {ownerName ? `${ownerName} recibirá` : "Se enviará"} una notificación sobre «{task.title}».
            </p>
            <label htmlFor="ping-message" className="sr-only">
                Mensaje
            </label>
            <textarea
                id="ping-message"
                rows={3}
                maxLength={280}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Mensaje opcional"
                className="w-full resize-none rounded-card bg-bg-elevated p-4 text-body outline-none placeholder:text-label-tertiary focus:ring-2 focus:ring-accent"
            />
            <Button type="submit" size="lg" loading={ping.isPending}>
                Enviar
            </Button>
        </form>
    );
}
