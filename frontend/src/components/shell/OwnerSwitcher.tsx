import { lazy } from "react";
import { Deferred } from "@/components/ui/Deferred";
import { useOwnerAccess } from "@/queries/owner";
import { useSharedWithMe } from "@/queries/sharing";

const OwnerMenu = lazy(() => import("./OwnerMenu").then((module) => ({ default: module.OwnerMenu })));

export function OwnerSwitcher() {
    const grants = useSharedWithMe().data ?? [];
    const access = useOwnerAccess();
    return (
        <Deferred when={grants.some((grant) => grant.canView) || !access.isSelf}>
            <OwnerMenu />
        </Deferred>
    );
}
