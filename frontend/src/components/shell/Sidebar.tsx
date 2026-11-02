import { Link, useRouterState } from "@tanstack/react-router";
import { Bell, CircleUserRound, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useUnreadActivityCount } from "@/queries/activity";
import { useSession } from "@/queries/session";
import { useCreateStore } from "@/stores/create";
import { isActive } from "./TabBar";
import { primaryNav, scrollToTop } from "./nav";

function SidebarLink({ to, active, children }: { to: string; active: boolean; children: ReactNode }) {
    return (
        <Link
            to={to}
            aria-current={active ? "page" : undefined}
            onClick={() => {
                if (active) scrollToTop();
            }}
            className={cn(
                "flex h-10 items-center gap-3 rounded-control px-3 text-callout",
                active ? "bg-accent-soft font-semibold text-accent" : "text-label hover:bg-fill-secondary",
            )}
        >
            {children}
        </Link>
    );
}

const shortcutLabel = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl K";

export function Sidebar() {
    const pathname = useRouterState({ select: (state) => state.location.pathname });
    const user = useSession();
    const unread = useUnreadActivityCount();
    const openCreate = useCreateStore((state) => state.openCreate);

    return (
        <aside className="material-sidebar fixed inset-y-0 left-0 z-40 hidden w-64 flex-col px-3 pt-6 pb-4 lg:flex">
            <div className="flex items-center gap-2 px-3 pb-6">
                <img src="/icon.svg" alt="" className="size-7 rounded-[0.45rem]" />
                <span className="text-headline">Cosmica</span>
            </div>
            <button
                type="button"
                onClick={() => openCreate()}
                className="mb-4 flex h-10 items-center gap-2 rounded-control bg-accent px-3 text-callout font-semibold text-on-accent active:opacity-80"
            >
                <Plus aria-hidden className="size-5" strokeWidth={2.2} />
                <span className="flex-1 text-left">Nueva</span>
                <kbd className="text-caption font-normal opacity-70">{shortcutLabel}</kbd>
            </button>
            <nav aria-label="Principal" className="flex flex-1 flex-col gap-1">
                {primaryNav.map(({ to, label, icon: Icon }) => (
                    <SidebarLink key={to} to={to} active={isActive(pathname, to)}>
                        <Icon aria-hidden className="size-5" strokeWidth={1.8} />
                        {label}
                    </SidebarLink>
                ))}
            </nav>
            <div className="flex flex-col gap-1 border-t border-separator pt-3">
                <SidebarLink to="/activity" active={pathname.startsWith("/activity")}>
                    <Bell aria-hidden className="size-5" strokeWidth={1.8} />
                    <span className="flex-1">Actividad</span>
                    {unread > 0 ? (
                        <span className="tabular min-w-5 rounded-full bg-danger px-1.5 text-center text-caption text-on-status">
                            {unread}
                        </span>
                    ) : null}
                </SidebarLink>
                <SidebarLink to="/profile" active={pathname.startsWith("/profile")}>
                    <CircleUserRound aria-hidden className="size-5" strokeWidth={1.8} />
                    <span className="truncate">{user.fullname || user.username}</span>
                </SidebarLink>
            </div>
        </aside>
    );
}
