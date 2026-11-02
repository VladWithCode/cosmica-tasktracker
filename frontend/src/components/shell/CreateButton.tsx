import { Plus } from "lucide-react";
import { Pressable } from "@/components/ui/Pressable";
import { useOwnerAccess } from "@/queries/owner";
import { useCreateStore } from "@/stores/create";

export function CreateButton({ date }: { date?: string }) {
    const openCreate = useCreateStore((state) => state.openCreate);
    const access = useOwnerAccess();
    if (!access.canCreate) return null;
    return (
        <Pressable
            aria-label={access.isSelf ? "Nueva tarea o rutina" : `Nueva rutina para ${access.name ?? "otra persona"}`}
            onClick={() => openCreate({ date, ownerId: access.ownerId })}
            className="flex size-11 items-center justify-center text-accent lg:hidden"
        >
            <Plus aria-hidden className="size-6" strokeWidth={2.2} />
        </Pressable>
    );
}
