import { Link } from "@tanstack/react-router";
import { useUnreadActivityCount } from "@/queries/activity";
import { useSession } from "@/queries/session";

export function initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    const letters = parts.length > 1 ? `${parts[0]?.[0] ?? ""}${parts[parts.length - 1]?.[0] ?? ""}` : (parts[0]?.slice(0, 2) ?? "");
    return letters.toUpperCase() || "?";
}

export function AvatarButton() {
    const user = useSession();
    const unread = useUnreadActivityCount();
    const label = unread > 0 ? `Perfil, ${unread} sin leer` : "Perfil";

    return (
        <Link to="/profile" aria-label={label} className="relative flex size-11 items-center justify-center lg:hidden">
            <span className="flex size-8 items-center justify-center rounded-full bg-accent-soft text-footnote font-semibold text-accent active:opacity-60">
                {initials(user.fullname || user.username)}
            </span>
            {unread > 0 ? (
                <span aria-hidden className="tabular absolute top-1 right-0.5 min-w-4 rounded-full bg-danger px-1 text-center text-[0.625rem] leading-4 font-semibold text-on-status">
                    {unread > 9 ? "9+" : unread}
                </span>
            ) : null}
        </Link>
    );
}
