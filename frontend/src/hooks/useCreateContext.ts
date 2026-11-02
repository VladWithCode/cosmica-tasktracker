import { useRouterState } from "@tanstack/react-router";
import { useOwnerAccess } from "@/queries/owner";
import { useCreateStore } from "@/stores/create";

export function useOpenCreate() {
    const openCreate = useCreateStore((state) => state.openCreate);
    const access = useOwnerAccess();
    const date = useRouterState({
        select: (state) => {
            const search = state.location.search as { date?: unknown };
            return state.location.pathname.startsWith("/calendar") && typeof search.date === "string" ? search.date : undefined;
        },
    });
    const ownerId = access.canCreate && !access.isSelf ? access.ownerId : null;
    return () => openCreate({ date, ownerId });
}
