import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/cn";
import { spring } from "@/lib/motion";
import { AvatarButton } from "./AvatarButton";

type ScreenProps = {
    title: string;
    titleAccessory?: ReactNode;
    leading?: ReactNode;
    actions?: ReactNode;
    showAvatar?: boolean;
    largeTitle?: boolean;
    children: ReactNode;
    className?: string;
};

export function Screen({ title, titleAccessory, leading, actions, showAvatar = true, largeTitle = true, children, className }: ScreenProps) {
    const titleRef = useRef<HTMLHeadingElement>(null);
    const headerRef = useRef<HTMLElement>(null);
    const [collapsed, setCollapsed] = useState(!largeTitle);

    useEffect(() => {
        const element = titleRef.current;
        if (!element || !largeTitle) return;
        const barHeight = headerRef.current?.offsetHeight ?? 56;
        const observer = new IntersectionObserver(
            ([entry]) => setCollapsed(!(entry?.isIntersecting ?? true)),
            { rootMargin: `-${barHeight}px 0px 0px 0px`, threshold: 0 },
        );
        observer.observe(element);
        return () => observer.disconnect();
    }, [largeTitle]);

    useEffect(() => {
        document.title = `${title} · Cosmica`;
    }, [title]);

    return (
        <div className={cn("mx-auto w-full max-w-3xl", className)}>
            <header ref={headerRef} className={cn("sticky top-0 z-30 pt-bar transition-[background-color]", collapsed && "material-bar")}>
                <div className="relative flex h-11 items-center justify-between px-2">
                    <div className="flex min-w-11 items-center">{leading}</div>
                    <motion.span
                        aria-hidden={!collapsed}
                        initial={false}
                        animate={{ opacity: collapsed ? 1 : 0, y: collapsed ? 0 : 6 }}
                        transition={spring.default}
                        className="pointer-events-none absolute inset-x-16 truncate text-center text-headline"
                    >
                        {title}
                    </motion.span>
                    <div className="flex min-w-11 items-center justify-end gap-1">
                        {actions}
                        {showAvatar ? <AvatarButton /> : null}
                    </div>
                </div>
                <div
                    aria-hidden
                    className={cn(
                        "pointer-events-none absolute inset-x-0 top-full h-3 bg-linear-to-b from-black/5 to-transparent opacity-0 transition-opacity",
                        collapsed && "opacity-100",
                    )}
                />
            </header>
            {largeTitle ? (
                <div className="flex flex-col gap-1 px-4 pt-2 pb-5">
                    <h1 ref={titleRef} className="text-large-title">
                        {title}
                    </h1>
                    {titleAccessory}
                </div>
            ) : null}
            <main className="pb-[calc(env(safe-area-inset-bottom)+6rem)] lg:pb-10">{children}</main>
        </div>
    );
}
