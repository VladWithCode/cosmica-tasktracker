import { useNavigate } from "@tanstack/react-router";
import { Sheet } from "@/components/ui/Sheet";
import { fromISODate, todayISO } from "@/lib/date";
import { useCreateOneOff, useCreateSchedule } from "@/queries/create";
import { useSharedWithMe } from "@/queries/sharing";
import { useCreateStore } from "@/stores/create";
import { toast } from "@/stores/toast";
import { defaultCreateValues, toOneOffInput, toScheduleInput } from "./createForm";
import { TaskForm } from "./TaskForm";

export function CreateSheet() {
    const { open, date, closeCreate } = useCreateStore();
    return (
        <Sheet open={open} onOpenChange={(next) => (next ? undefined : closeCreate())} title="Nueva" description="Crear una tarea o rutina">
            {open ? <CreateContent initialDate={date ?? todayISO()} onDone={closeCreate} /> : null}
        </Sheet>
    );
}

function CreateContent({ initialDate, onDone }: { initialDate: string; onDone: () => void }) {
    const navigate = useNavigate();
    const createOneOff = useCreateOneOff();
    const createRoutine = useCreateSchedule();
    const owners = (useSharedWithMe().data ?? []).filter((grant) => grant.canCreate);

    return (
        <TaskForm
            mode="create"
            defaultValues={defaultCreateValues(initialDate, fromISODate(initialDate).getDay())}
            owners={owners}
            pending={createOneOff.isPending || createRoutine.isPending}
            error={createOneOff.error ?? createRoutine.error}
            onSubmit={(values) => {
                if (values.kind === "once") {
                    createOneOff.mutate(toOneOffInput(values), {
                        onSuccess: (task) => {
                            onDone();
                            toast.show("Tarea creada", {
                                action: { label: "Ver", onAction: () => void navigate({ to: "/", search: { task: task.id } }) },
                            });
                        },
                    });
                    return;
                }
                createRoutine.mutate(toScheduleInput(values), {
                    onSuccess: () => {
                        onDone();
                        toast.show(values.ownerId ? "Rutina creada para otra persona" : "Rutina creada");
                    },
                });
            }}
        />
    );
}
