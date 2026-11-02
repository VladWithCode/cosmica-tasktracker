import { useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { initials } from "@/components/shell/AvatarButton";
import { Screen } from "@/components/shell/Screen";
import { GroupedRow, GroupedSection } from "@/components/ui/GroupedList";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useLogout, useSession } from "@/queries/session";
import { useThemeStore, type ThemePreference } from "@/stores/theme";

const themeOptions: { value: ThemePreference; label: string }[] = [
    { value: "system", label: "Sistema" },
    { value: "light", label: "Claro" },
    { value: "dark", label: "Oscuro" },
];

export function ProfileScreen() {
    const user = useSession();
    const logout = useLogout();
    const navigate = useNavigate();
    const { preference, setPreference } = useThemeStore();

    return (
        <Screen title="Perfil" showAvatar={false}>
            <div className="flex flex-col items-center gap-2 px-4 pt-2 pb-4">
                <span className="flex size-20 items-center justify-center rounded-full bg-accent-soft text-title-1 text-accent">
                    {initials(user.fullname || user.username)}
                </span>
                <div className="text-center">
                    <p className="text-title-2">{user.fullname}</p>
                    <p className="text-callout text-label-secondary">@{user.username}</p>
                </div>
            </div>
            <GroupedSection title="Apariencia">
                <div className="px-4 py-3">
                    <SegmentedControl label="Tema" value={preference} options={themeOptions} onChange={setPreference} />
                </div>
            </GroupedSection>
            <GroupedSection>
                <GroupedRow
                    icon={<LogOut className="size-5 text-danger" />}
                    label="Cerrar sesión"
                    tone="danger"
                    disabled={logout.isPending}
                    onPress={() => logout.mutate(undefined, { onSettled: () => navigate({ to: "/login" }) })}
                />
            </GroupedSection>
        </Screen>
    );
}
