import type { ReactNode } from "react";
import { BottomNavBar } from "@/components/layout/BottomNavBar";
import { TopAppBar } from "@/components/layout/TopAppBar";
import { cn } from "@/lib/utils";

interface AppShellProps {
    children: ReactNode;
    className?: string;
    contentClassName?: string;
    showBottomNav?: boolean;
    topBarAlign?: "left" | "center";
    title?: string;
}

export function AppShell({
    children,
    className,
    contentClassName,
    showBottomNav = true,
    topBarAlign,
    title,
}: AppShellProps) {
    return (
        <div
            className={cn(
                "grid h-full w-full grid-rows-[auto_1fr] bg-surface font-body text-on-surface selection:bg-primary-dim selection:text-on-primary",
                className,
            )}
        >
            <TopAppBar align={topBarAlign} title={title} />
            <div className={cn("relative min-h-0 overflow-y-auto", contentClassName)}>
                {children}
            </div>
            {showBottomNav ? <BottomNavBar /> : null}
        </div>
    );
}
