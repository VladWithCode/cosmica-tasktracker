import { useOwnerStore } from "@/stores/owner";
import { useSharedWithMe } from "./sharing";

export type OwnerAccess = {
    ownerId: string | null;
    isSelf: boolean;
    name: string | null;
    canEdit: boolean;
    canCreate: boolean;
    canPing: boolean;
};

export function useOwnerAccess(): OwnerAccess {
    const ownerId = useOwnerStore((state) => state.ownerId);
    const grants = useSharedWithMe().data ?? [];
    if (!ownerId) return { ownerId: null, isSelf: true, name: null, canEdit: true, canCreate: true, canPing: false };
    const grant = grants.find((item) => item.ownerUserId === ownerId);
    return {
        ownerId,
        isSelf: false,
        name: grant ? grant.owner.fullname || grant.owner.username : null,
        canEdit: grant?.canEditTasks ?? false,
        canCreate: grant?.canCreate ?? false,
        canPing: grant?.canPing ?? false,
    };
}
