import { Plus } from "lucide-react";
import { Pressable } from "@/components/ui/Pressable";
import { useCreateStore } from "@/stores/create";

export function CreateButton({ date }: { date?: string }) {
    const openCreate = useCreateStore((state) => state.openCreate);
    return (
        <Pressable aria-label="Nueva tarea o rutina" onClick={() => openCreate(date)} className="flex size-11 items-center justify-center text-accent lg:hidden">
            <Plus aria-hidden className="size-6" strokeWidth={2.2} />
        </Pressable>
    );
}
