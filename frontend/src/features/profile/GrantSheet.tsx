import { useState } from "react";
import type { Grant, SharingAccessLevel } from "@/api/schemas";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { useUpdateGrant } from "@/queries/sharing";
import { toast } from "@/stores/toast";
import { AccessLevelPicker } from "./AccessLevelPicker";

export function GrantSheet({ grant, onClose }: { grant: Grant | null; onClose: () => void }) {
    const name = grant ? grant.grantee.fullname || grant.grantee.username : "";
    return (
        <Sheet open={grant !== null} onOpenChange={(next) => (next ? undefined : onClose())} title={name || "Acceso"} description="Cambiar el nivel de acceso">
            {grant ? <GrantForm key={grant.id} grant={grant} name={name} onDone={onClose} /> : null}
        </Sheet>
    );
}

function GrantForm({ grant, name, onDone }: { grant: Grant; name: string; onDone: () => void }) {
    const [level, setLevel] = useState<SharingAccessLevel>(grant.accessLevel);
    const update = useUpdateGrant();
    return (
        <div className="flex flex-col">
            <AccessLevelPicker value={level} onChange={setLevel} />
            <div className="px-4 pt-8">
                <Button
                    size="lg"
                    className="w-full"
                    loading={update.isPending}
                    onClick={() => {
                        if (level === grant.accessLevel) {
                            onDone();
                            return;
                        }
                        update.mutate(
                            { id: grant.id, level },
                            {
                                onSuccess: () => {
                                    toast.show(`Acceso de ${name} actualizado`);
                                    onDone();
                                },
                            },
                        );
                    }}
                >
                    Guardar
                </Button>
            </div>
        </div>
    );
}
