import type { Grant } from "@/api/schemas";
import { useOwnerStore } from "@/stores/owner";
import { useSession } from "./session";
import { useSharedWithMe } from "./sharing";

export type OwnerAccess = {
    ownerId: string | null;
    isSelf: boolean;
    name: string | null;
    canEdit: boolean;
    canCreate: boolean;
    canPing: boolean;
};

const SELF: OwnerAccess = { ownerId: null, isSelf: true, name: null, canEdit: true, canCreate: true, canPing: false };

export function ownerName(grant: Grant): string {
    return grant.owner.fullname || grant.owner.username;
}

export function accessFrom(ownerId: string | null, grants: Grant[]): OwnerAccess {
    if (!ownerId) return SELF;
    const grant = grants.find((item) => item.ownerUserId === ownerId);
    return {
        ownerId,
        isSelf: false,
        name: grant ? ownerName(grant) : null,
        canEdit: grant?.canEditTasks ?? false,
        canCreate: grant?.canCreate ?? false,
        canPing: grant?.canPing ?? false,
    };
}

export function useOwnerAccess(): OwnerAccess {
    const ownerId = useOwnerStore((state) => state.ownerId);
    const grants = useSharedWithMe().data ?? [];
    return accessFrom(ownerId, grants);
}

export function useAccessForUser(userId: string | undefined): OwnerAccess {
    const user = useSession();
    const grants = useSharedWithMe().data ?? [];
    if (!userId || userId === user.id) return SELF;
    return accessFrom(userId, grants);
}
