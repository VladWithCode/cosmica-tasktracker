import type { SharingAccessLevel } from "@/api/schemas";

export const accessLevelInfo: Record<SharingAccessLevel, { label: string; description: string }> = {
    view: { label: "Ver", description: "Ve tus rutinas y tareas." },
    ping_only: { label: "Ver y recordar", description: "Ve tus tareas y puede enviarte recordatorios." },
    manage: { label: "Gestionar", description: "Además crea rutinas para ti y actualiza tus tareas." },
};

export const accessLevelOrder: SharingAccessLevel[] = ["view", "ping_only", "manage"];
