import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Bell, KeyRound, LogOut, Mail, UserPlus, UserRound, UserX } from "lucide-react";
import type { Grant } from "@/api/schemas";
import { initials } from "@/components/shell/AvatarButton";
import { BackButton } from "@/components/shell/BackButton";
import { Screen } from "@/components/shell/Screen";
import { GroupedRow, GroupedSection } from "@/components/ui/GroupedList";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SwipeRow } from "@/components/ui/SwipeRow";
import { useUnreadActivityCount } from "@/queries/activity";
import { ownerName } from "@/queries/owner";
import { useLogout, useSession } from "@/queries/session";
import { useGrants, useRevokeGrantWithUndo, useSharedWithMe } from "@/queries/sharing";
import { useOwnerStore } from "@/stores/owner";
import { useThemeStore, type ThemePreference } from "@/stores/theme";
import { ProfileSheet, PasswordSheet } from "./AccountSheets";
import { InviteSheet } from "./InviteSheet";
import { accessLevelInfo } from "./accessLevels";
import { NotificationSection } from "./NotificationSection";

const themeOptions: { value: ThemePreference; label: string }[] = [
    { value: "system", label: "Sistema" },
    { value: "light", label: "Claro" },
    { value: "dark", label: "Oscuro" },
];

type SheetId = "profile" | "password" | "invite" | null;

export function ProfileScreen() {
    const user = useSession();
    const navigate = useNavigate();
    const logout = useLogout();
    const unread = useUnreadActivityCount();
    const { preference, setPreference } = useThemeStore();
    const [sheet, setSheet] = useState<SheetId>(null);
    const close = () => setSheet(null);

    return (
        <Screen
            title="Perfil"
            showAvatar={false}
            leading={<BackButton className="lg:hidden" />}
        >
            <div className="flex flex-col items-center gap-2 px-4 pt-2 pb-4">
                <span className="flex size-20 items-center justify-center rounded-full bg-accent-soft text-title-1 text-accent">{initials(user.fullname || user.username)}</span>
                <div className="text-center">
                    <p className="text-title-2">{user.fullname}</p>
                    <p className="text-callout text-label-secondary">@{user.username}</p>
                </div>
            </div>

            <GroupedSection className="lg:hidden">
                <GroupedRow
                    icon={<Bell aria-hidden className="size-5 text-accent" />}
                    label="Actividad"
                    chevron
                    onPress={() => void navigate({ to: "/activity" })}
                    trailing={
                        unread > 0 ? <span className="tabular min-w-6 rounded-full bg-danger px-1.5 text-center text-caption text-on-status">{unread}</span> : null
                    }
                />
            </GroupedSection>

            <GroupedSection title="Cuenta">
                <GroupedRow icon={<UserRound aria-hidden className="size-5 text-label-secondary" />} label="Nombre" detail={user.fullname} chevron onPress={() => setSheet("profile")} />
                <GroupedRow icon={<Mail aria-hidden className="size-5 text-label-secondary" />} label="Correo" detail={user.email || "Sin correo"} chevron onPress={() => setSheet("profile")} />
                <GroupedRow icon={<KeyRound aria-hidden className="size-5 text-label-secondary" />} label="Cambiar contraseña" chevron onPress={() => setSheet("password")} />
            </GroupedSection>

            <NotificationSection />

            <SharingSection onInvite={() => setSheet("invite")} />
            <SharedWithMeSection />

            <GroupedSection title="Apariencia">
                <div className="px-4 py-3">
                    <SegmentedControl label="Tema" value={preference} options={themeOptions} onChange={setPreference} />
                </div>
            </GroupedSection>

            <GroupedSection>
                <GroupedRow
                    icon={<LogOut aria-hidden className="size-5 text-danger" />}
                    label="Cerrar sesión"
                    tone="danger"
                    disabled={logout.isPending}
                    onPress={() => logout.mutate(undefined, { onSettled: () => void navigate({ to: "/login" }) })}
                />
            </GroupedSection>

            <ProfileSheet user={user} open={sheet === "profile"} onClose={close} />
            <PasswordSheet open={sheet === "password"} onClose={close} />
            <InviteSheet open={sheet === "invite"} onClose={close} />
        </Screen>
    );
}

function SharingSection({ onInvite }: { onInvite: () => void }) {
    const grants = useGrants();
    const revoke = useRevokeGrantWithUndo();
    const list = grants.data ?? [];
    return (
        <GroupedSection title="Compartir mis tareas" footer={list.length ? "Desliza a la izquierda para retirar el acceso." : "Elige quién puede ver tus tareas o enviarte recordatorios."}>
            {list.map((grant) => (
                <SwipeRow key={grant.id} trailing={[{ id: "revoke", label: "Retirar", icon: UserX, tone: "danger", onTrigger: () => revoke(grant) }]}>
                    <GroupedRow
                        icon={<PersonBadge name={grant.grantee.fullname || grant.grantee.username} />}
                        label={grant.grantee.fullname || grant.grantee.username}
                        detail={accessLevelInfo[grant.accessLevel].label}
                    />
                </SwipeRow>
            ))}
            <GroupedRow icon={<UserPlus aria-hidden className="size-5 text-accent" />} label="Invitar a alguien" tone="accent" onPress={onInvite} />
        </GroupedSection>
    );
}

function SharedWithMeSection() {
    const navigate = useNavigate();
    const setOwner = useOwnerStore((state) => state.setOwner);
    const grants = useSharedWithMe().data ?? [];
    if (grants.length === 0) return null;
    const open = (grant: Grant) => {
        setOwner(grant.ownerUserId);
        void navigate({ to: "/" });
    };
    return (
        <GroupedSection title="Compartido conmigo">
            {grants.map((grant) => (
                <GroupedRow
                    key={grant.id}
                    icon={<PersonBadge name={ownerName(grant)} />}
                    label={ownerName(grant)}
                    detail={accessLevelInfo[grant.accessLevel].label}
                    chevron
                    onPress={() => open(grant)}
                />
            ))}
        </GroupedSection>
    );
}

function PersonBadge({ name }: { name: string }) {
    return <span className="flex size-7 items-center justify-center rounded-full bg-accent-soft text-caption text-accent">{initials(name)}</span>;
}
