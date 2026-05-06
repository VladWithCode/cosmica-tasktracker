import { useEffect, useId, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { useProfileStats } from "@/hooks/useProfileStats";
import { queryClient } from "@/queries/queryClient";
import { getProfile, logoutProfile, updateProfile } from "@/services/profile";
import type { UserProfile } from "@/types/profile";
import { cn } from "@/lib/utils";
import { NotificationSettings } from "@/notifications/notificationSettings";
import { NotificationInbox } from "@/components/profile/NotificationInbox";
import { SharingSettings } from "@/components/profile/SharingSettings";

interface ProfileFormState {
    email: string;
    fullname: string;
}

interface ProfileStatCardProps {
    icon: string;
    label: string;
    tone: string;
    value: string;
    highlighted?: boolean;
}

interface ProfileActionButtonProps {
    icon: string;
    label: string;
    onClick?: () => void;
}

export function ProfilePage() {
    const router = useRouter();
    const profileQuery = useQuery({
        queryKey: ["profile"],
        queryFn: getProfile,
    });
    const statsQuery = useProfileStats();
    const [form, setForm] = useState<ProfileFormState>({ email: "", fullname: "" });

    useEffect(() => {
        if (profileQuery.data) {
            setForm({
                email: profileQuery.data.email,
                fullname: profileQuery.data.fullname,
            });
        }
    }, [profileQuery.data]);

    const updateProfileMutation = useMutation({
        mutationFn: updateProfile,
        onSuccess: (data) => {
            toast.success(data.message || "Perfil actualizado");
            void queryClient.invalidateQueries({ queryKey: ["profile"] });
            void queryClient.invalidateQueries({ queryKey: ["session"] });
        },
        onError: (error) => {
            toast.error(error.message || "No se pudo actualizar el perfil");
        },
    });

    const logoutMutation = useMutation({
        mutationFn: logoutProfile,
        onSuccess: () => {
            queryClient.clear();
            void router.navigate({ to: "/login" });
        },
        onError: (error) => {
            toast.error(error.message || "No se pudo cerrar sesión");
        },
    });

    const profile = profileQuery.data;
    const stats = statsQuery.data;
    const initials = useMemo(() => getInitials(profile), [profile]);
    const isDirty =
        profile !== undefined &&
        (form.fullname !== profile.fullname || form.email !== profile.email);

    const saveChanges = () => {
        if (!form.fullname.trim() || !form.email.trim()) {
            toast.error("Nombre y correo son requeridos");
            return;
        }

        updateProfileMutation.mutate({
            fullname: form.fullname.trim(),
            email: form.email.trim(),
        });
    };

    return (
        <main className="relative mx-auto min-h-full max-w-3xl px-6 pb-36 pt-8">
            <div className="pointer-events-none absolute left-1/2 top-16 h-80 w-80 -translate-x-1/2 rounded-full bg-primary/5 blur-[120px]" />

            {profileQuery.isLoading ? <ProfileLoadingState /> : null}
            {profileQuery.isError ? <ProfileErrorState error={profileQuery.error} /> : null}
            {!profileQuery.isLoading && !profileQuery.isError && profile ? (
                <div className="relative space-y-10">
                    <ProfileHero initials={initials} profile={profile} />

                    <section className="grid grid-cols-3 gap-4">
                        <ProfileStatCard
                            icon="timer"
                            label="Focus"
                            tone="text-tertiary"
                            value={`${stats.focusHours}h`}
                        />
                        <ProfileStatCard
                            highlighted
                            icon="local_fire_department"
                            label="Streak"
                            tone="text-primary"
                            value={`${stats.streakDays}d`}
                        />
                        <ProfileStatCard
                            icon="flag"
                            label="Goal"
                            tone="text-tertiary"
                            value={`${stats.goalPercent}%`}
                        />
                    </section>

                    <section className="rounded-xl border border-outline-variant/10 bg-surface-container-low p-6 shadow-[0_15px_40px_rgba(0,0,0,0.24)]">
                        <h3 className="mb-6 flex items-center font-headline text-lg font-bold text-on-surface">
                            <MaterialIcon name="person_outline" className="mr-2 text-primary" />
                            Personal Information
                        </h3>
                        <div className="space-y-5">
                            <ProfileInput
                                label="Full Name"
                                value={form.fullname}
                                onChange={(value) => setForm((current) => ({ ...current, fullname: value }))}
                            />
                            <ProfileInput
                                label="Email Address"
                                type="email"
                                value={form.email}
                                onChange={(value) => setForm((current) => ({ ...current, email: value }))}
                            />
                            <ProfileInput
                                icon="alternate_email"
                                label="Usuario"
                                readOnly
                                value={profile.username}
                            />
                            <button
                                className="flex w-full items-center justify-center rounded-full border border-outline-variant/15 bg-surface-container-high px-4 py-3 font-label text-sm font-bold text-primary transition-all duration-300 hover:bg-surface-container-highest active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                                disabled={!isDirty || updateProfileMutation.isPending}
                                onClick={saveChanges}
                                type="button"
                            >
                                <MaterialIcon name="save" className="mr-2 text-sm" />
                                {updateProfileMutation.isPending ? "Guardando" : "Save Changes"}
                            </button>
                        </div>
                    </section>

                    <section className="rounded-xl border border-outline-variant/10 bg-surface-container-low p-6 shadow-[0_15px_40px_rgba(0,0,0,0.24)]">
                        <h3 className="mb-6 flex items-center font-headline text-lg font-bold text-on-surface">
                            <MaterialIcon name="security" className="mr-2 text-primary" />
                            Security
                        </h3>
                        <div className="space-y-4">
                            <ProfileActionButton
                                icon="lock"
                                label="Change Password"
                                onClick={() => toast.info("Cambio de contraseña pendiente de endpoint")}
                            />
                            <ProfileActionButton
                                icon="notifications"
                                label="Notification Preferences"
                                onClick={() => toast.info("Configura las notificaciones en la tarjeta de abajo")}
                            />
                        </div>
                    </section>

                    <NotificationSettings />

                    <NotificationInbox />

                    <SharingSettings />

                    <section className="pt-2">
                        <button
                            className="flex w-full items-center justify-center rounded-full border border-error/20 bg-error/10 px-4 py-4 font-label text-sm font-bold text-error shadow-[0_0_20px_rgba(255,110,132,0.1)] transition-all duration-300 hover:bg-error/20 active:scale-[0.98]"
                            disabled={logoutMutation.isPending}
                            onClick={() => logoutMutation.mutate()}
                            type="button"
                        >
                            <MaterialIcon name="logout" className="mr-2 text-sm" />
                            {logoutMutation.isPending ? "Cerrando sesión" : "Logout"}
                        </button>
                    </section>
                </div>
            ) : null}
        </main>
    );
}

function ProfileHero({ initials, profile }: { initials: string; profile: UserProfile }) {
    return (
        <section className="flex flex-col items-center justify-center text-center">
            <div className="relative mb-4">
                <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full bg-surface-container-lowest shadow-[0_0_40px_rgba(175,162,255,0.28)] ring-4 ring-primary ring-offset-4 ring-offset-surface">
                    <span className="font-display text-4xl font-black tracking-tighter text-primary">
                        {initials}
                    </span>
                </div>
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-gradient-to-r from-primary to-primary-dim px-3 py-1 font-label text-[10px] font-bold uppercase tracking-widest text-on-primary shadow-[0_0_15px_rgba(175,162,255,0.3)]">
                    {formatRole(profile.role)}
                </div>
            </div>
            <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-on-surface">
                {profile.fullname}
            </h2>
            <p className="mt-1 text-sm text-on-surface-variant">{profile.email}</p>
        </section>
    );
}

function ProfileStatCard({ highlighted, icon, label, tone, value }: ProfileStatCardProps) {
    return (
        <article className="relative flex min-h-32 flex-col items-center justify-center overflow-hidden rounded-xl bg-surface-container-high p-4 shadow-[0_10px_30px_rgba(0,0,0,0.2)]">
            {highlighted ? (
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent" />
            ) : null}
            <MaterialIcon name={icon} filled className={cn("relative z-10 mb-2", tone)} />
            <span className="relative z-10 font-display text-xl font-black tracking-tighter text-on-surface tabular-nums">
                {value}
            </span>
            <span className="relative z-10 mt-1 font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                {label}
            </span>
        </article>
    );
}

interface ProfileInputProps {
    label: string;
    value: string;
    icon?: string;
    onChange?: (value: string) => void;
    readOnly?: boolean;
    type?: "email" | "text";
}

function ProfileInput({
    icon,
    label,
    onChange,
    readOnly = false,
    type = "text",
    value,
}: ProfileInputProps) {
    const inputId = useId();

    return (
        <div className="flex flex-col">
            <label
                className="mb-2 font-label text-xs font-semibold uppercase tracking-widest text-on-surface-variant"
                htmlFor={inputId}
            >
                {label}
            </label>
            <div className="relative">
                {icon ? (
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                        <MaterialIcon name={icon} className="text-sm text-on-surface-variant" />
                    </div>
                ) : null}
                <input
                    className={cn(
                        "block w-full rounded-lg border border-outline-variant/15 bg-surface-container-lowest p-3 text-sm text-on-surface transition-colors placeholder:text-on-surface-variant/50 focus:border-primary focus:ring-1 focus:ring-primary",
                        icon && "pl-9",
                        readOnly && "text-on-surface-variant",
                    )}
                    id={inputId}
                    onChange={(event) => onChange?.(event.target.value)}
                    readOnly={readOnly}
                    type={type}
                    value={value}
                />
            </div>
        </div>
    );
}

function ProfileActionButton({ icon, label, onClick }: ProfileActionButtonProps) {
    return (
        <button
            className="group flex w-full items-center justify-between rounded-lg border border-outline-variant/15 bg-surface-container-lowest px-4 py-4 text-sm font-semibold text-on-surface transition-all duration-300 hover:bg-surface-container-high active:scale-[0.98]"
            onClick={onClick}
            type="button"
        >
            <span className="flex items-center">
                <MaterialIcon
                    name={icon}
                    className="mr-3 text-on-surface-variant transition-colors group-hover:text-primary"
                />
                {label}
            </span>
            <MaterialIcon name="chevron_right" className="text-on-surface-variant" />
        </button>
    );
}

function ProfileLoadingState() {
    return (
        <div className="space-y-10">
            <section className="flex flex-col items-center">
                <div className="h-28 w-28 rounded-full bg-surface-container-high" />
                <div className="mt-6 h-8 w-48 rounded-lg bg-surface-container-low" />
                <div className="mt-3 h-4 w-56 rounded-lg bg-surface-container-low" />
            </section>
            <section className="grid grid-cols-3 gap-4">
                {Array.from({ length: 3 }, (_, index) => (
                    <div className="h-32 rounded-xl bg-surface-container-high" key={index} />
                ))}
            </section>
            <section className="h-80 rounded-xl bg-surface-container-low" />
        </div>
    );
}

function ProfileErrorState({ error }: { error: Error | null }) {
    return (
        <section className="rounded-xl border border-error-dim/30 bg-error-container/10 p-5 text-error">
            <div className="flex items-center gap-2">
                <MaterialIcon name="error" filled />
                <p>{error?.message || "No se pudo cargar el perfil"}</p>
            </div>
        </section>
    );
}

function getInitials(profile: UserProfile | undefined) {
    const source = profile?.fullname || profile?.username || "RR";
    const initials = source
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("");

    return initials || "RR";
}

function formatRole(role: string) {
    if (role === "superadmin") {
        return "Super Admin";
    }

    return role.charAt(0).toUpperCase() + role.slice(1);
}
