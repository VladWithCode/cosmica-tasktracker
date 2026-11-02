import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown, Users } from "lucide-react";
import { ownerName, useOwnerAccess } from "@/queries/owner";
import { useSharedWithMe } from "@/queries/sharing";
import { useOwnerStore } from "@/stores/owner";
import { cn } from "@/lib/cn";

const item =
    "flex min-h-11 cursor-default items-center gap-3 rounded-[0.5rem] px-3 text-body text-label outline-none select-none data-[highlighted]:bg-fill-secondary";

export function OwnerSwitcher() {
    const grants = (useSharedWithMe().data ?? []).filter((grant) => grant.canView);
    const access = useOwnerAccess();
    const setOwner = useOwnerStore((state) => state.setOwner);
    if (grants.length === 0 && access.isSelf) return null;
    const label = access.isSelf ? "Mis tareas" : `Tareas de ${access.name ?? "otra persona"}`;

    return (
        <DropdownMenu.Root>
            <DropdownMenu.Trigger
                className={cn(
                    "mt-1 inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-footnote font-semibold outline-offset-2",
                    access.isSelf ? "bg-fill-secondary text-label" : "bg-accent text-on-accent",
                )}
            >
                <Users aria-hidden className="size-4" />
                {label}
                <ChevronDown aria-hidden className="size-4" />
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
                <DropdownMenu.Content
                    align="start"
                    sideOffset={6}
                    collisionPadding={12}
                    className="z-50 min-w-60 origin-[var(--radix-dropdown-menu-content-transform-origin)] rounded-card bg-bg-elevated p-1.5 shadow-float ring-1 ring-separator data-[state=open]:animate-[menu-in_180ms_cubic-bezier(0.2,0.9,0.3,1)] motion-reduce:animate-none"
                >
                    <DropdownMenu.Label className="px-3 pt-1 pb-1.5 text-footnote text-label-secondary">Ver tareas de</DropdownMenu.Label>
                    <DropdownMenu.RadioGroup value={access.ownerId ?? ""} onValueChange={(value) => setOwner(value || null)}>
                        <DropdownMenu.RadioItem value="" className={item}>
                            <span className="flex-1">Mis tareas</span>
                            <DropdownMenu.ItemIndicator>
                                <Check aria-hidden className="size-5 text-accent" />
                            </DropdownMenu.ItemIndicator>
                        </DropdownMenu.RadioItem>
                        {grants.map((grant) => (
                            <DropdownMenu.RadioItem key={grant.id} value={grant.ownerUserId} className={item}>
                                <span className="flex-1 truncate">{ownerName(grant)}</span>
                                <DropdownMenu.ItemIndicator>
                                    <Check aria-hidden className="size-5 text-accent" />
                                </DropdownMenu.ItemIndicator>
                            </DropdownMenu.RadioItem>
                        ))}
                    </DropdownMenu.RadioGroup>
                </DropdownMenu.Content>
            </DropdownMenu.Portal>
        </DropdownMenu.Root>
    );
}
