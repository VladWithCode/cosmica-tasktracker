import { useDeferredValue, useState } from "react";
import { Check, Search } from "lucide-react";
import { ApiError, errorMessage } from "@/api/client";
import type { SharingAccessLevel, SharingUser } from "@/api/schemas";
import { initials } from "@/components/shell/AvatarButton";
import { Button } from "@/components/ui/Button";
import { GroupedRow, GroupedSection } from "@/components/ui/GroupedList";
import { Sheet } from "@/components/ui/Sheet";
import { Spinner } from "@/components/ui/Spinner";
import { useCreateGrant, useSearchUsers } from "@/queries/sharing";
import { toast } from "@/stores/toast";
import { accessLevelInfo, accessLevelOrder } from "./accessLevels";

export function InviteSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
    return (
        <Sheet open={open} onOpenChange={(next) => (next ? undefined : onClose())} title="Compartir mis tareas" description="Invitar a otra persona a ver tus tareas">
            {open ? <InviteForm onDone={onClose} /> : null}
        </Sheet>
    );
}

function InviteForm({ onDone }: { onDone: () => void }) {
    const [query, setQuery] = useState("");
    const deferred = useDeferredValue(query);
    const [selected, setSelected] = useState<SharingUser | null>(null);
    const [level, setLevel] = useState<SharingAccessLevel>("view");
    const search = useSearchUsers(deferred);
    const create = useCreateGrant();
    const users = deferred.trim().length >= 2 ? (search.data ?? []) : [];

    return (
        <div className="flex flex-col">
            <div className="px-4 pb-2">
                <label htmlFor="invite-search" className="sr-only">
                    Buscar persona
                </label>
                <div className="relative">
                    <Search aria-hidden className="absolute top-1/2 left-3 size-5 -translate-y-1/2 text-label-tertiary" />
                    <input
                        id="invite-search"
                        type="search"
                        autoFocus
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        value={query}
                        onChange={(event) => {
                            setQuery(event.target.value);
                            setSelected(null);
                        }}
                        placeholder="Usuario, nombre o correo"
                        className="h-11 w-full rounded-control bg-fill-secondary pr-10 pl-10 text-body outline-none placeholder:text-label-tertiary focus:ring-2 focus:ring-accent"
                    />
                    {search.isFetching ? <Spinner className="absolute top-1/2 right-3 size-4 -translate-y-1/2 text-label-tertiary" /> : null}
                </div>
            </div>

            {deferred.trim().length >= 2 ? (
                <GroupedSection title="Personas" footer={users.length === 0 && !search.isFetching ? "Nadie coincide con esa búsqueda." : undefined}>
                    {users.map((user) => (
                        <GroupedRow
                            key={user.id}
                            onPress={() => setSelected(user)}
                            icon={
                                <span className="flex size-7 items-center justify-center rounded-full bg-accent-soft text-caption text-accent">
                                    {initials(user.fullname || user.username)}
                                </span>
                            }
                            label={user.fullname || user.username}
                            detail={`@${user.username}`}
                            trailing={selected?.id === user.id ? <Check aria-label="Seleccionada" className="size-5 text-accent" strokeWidth={2.5} /> : null}
                        />
                    ))}
                </GroupedSection>
            ) : (
                <p className="px-8 py-2 text-footnote text-label-secondary">Escribe al menos 2 letras para buscar.</p>
            )}

            {selected ? (
                <>
                    <GroupedSection title="Qué puede hacer">
                        <div role="radiogroup" aria-label="Nivel de acceso">
                            {accessLevelOrder.map((value) => (
                                <div key={value} className="[&+&]:border-t [&+&]:border-separator">
                                    <GroupedRow
                                        onPress={() => setLevel(value)}
                                        label={
                                            <span className="flex flex-col">
                                                <span>{accessLevelInfo[value].label}</span>
                                                <span className="text-footnote whitespace-normal text-label-secondary">{accessLevelInfo[value].description}</span>
                                            </span>
                                        }
                                        trailing={level === value ? <Check aria-label="Seleccionado" className="size-5 text-accent" strokeWidth={2.5} /> : null}
                                    />
                                </div>
                            ))}
                        </div>
                    </GroupedSection>
                    {create.isError ? (
                        <p role="alert" className="px-8 text-footnote text-danger">
                            {create.error instanceof ApiError && create.error.code === "active_grant_exists"
                                ? "Ya compartes tus tareas con esta persona. Retira su acceso para cambiar el nivel."
                                : errorMessage(create.error)}
                        </p>
                    ) : null}
                    <div className="px-4 pt-3">
                        <Button
                            size="lg"
                            loading={create.isPending}
                            onClick={() =>
                                create.mutate(
                                    { userId: selected.id, level },
                                    {
                                        onSuccess: () => {
                                            toast.show(`Compartido con ${selected.fullname || selected.username}`);
                                            onDone();
                                        },
                                    },
                                )
                            }
                        >
                            Compartir
                        </Button>
                    </div>
                </>
            ) : null}
        </div>
    );
}
