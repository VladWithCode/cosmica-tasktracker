import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { primaryNav } from "@/components/shell/nav";
import { useOwnerAccess } from "@/queries/owner";
import { useCreateStore } from "@/stores/create";

function isEditable(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

export function useKeyboardShortcuts() {
    const navigate = useNavigate();
    const openCreate = useCreateStore((state) => state.openCreate);
    const access = useOwnerAccess();

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey || isEditable(event.target)) return;
            if (event.key.toLowerCase() === "k" && access.canCreate) {
                event.preventDefault();
                openCreate({ ownerId: access.ownerId });
                return;
            }
            const index = Number(event.key) - 1;
            const item = primaryNav[index];
            if (item) {
                event.preventDefault();
                void navigate({ to: item.to });
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [navigate, openCreate, access.canCreate, access.ownerId]);
}
