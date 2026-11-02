import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ListPlus, Plus, StickyNote, type LucideIcon } from "lucide-react";
import { useOpenCreate } from "@/hooks/useCreateContext";
import { cn } from "@/lib/cn";
import { haptic } from "@/lib/haptics";
import { fade, spring } from "@/lib/motion";
import { useOwnerAccess } from "@/queries/owner";
import { useNoteSheetStore } from "@/stores/note";
import { isActive, primaryNav, scrollToTop } from "./nav";

type MenuEntry = {
    id: string;
    label: string;
    icon: LucideIcon;
    kind: "action" | "destination";
    current?: boolean;
    onSelect: () => void;
};

const STAGGER = 0.022;

function MenuItem({ entry, index, total, reduceMotion }: { entry: MenuEntry; index: number; total: number; reduceMotion: boolean }) {
    const fromButton = total - 1 - index;
    return (
        <motion.li
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.4, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0, transition: reduceMotion ? fade : { ...spring.default, delay: fromButton * STAGGER } }}
            exit={reduceMotion ? { opacity: 0, transition: fade } : { opacity: 0, scale: 0.4, y: 24, transition: { ...spring.snappy, delay: index * (STAGGER / 2) } }}
            style={{ transformOrigin: "calc(100% - 1.5rem) 100%" }}
        >
            <button
                type="button"
                aria-current={entry.current ? "page" : undefined}
                onClick={entry.onSelect}
                className="group flex min-h-12 items-center justify-end gap-3 outline-none"
            >
                <span
                    className={cn(
                        "rounded-full bg-bg-elevated px-3.5 py-2 text-callout shadow-float group-focus-visible:ring-2 group-focus-visible:ring-accent",
                        entry.current ? "font-semibold text-accent" : "text-label",
                    )}
                >
                    {entry.label}
                </span>
                <span
                    className={cn(
                        "flex size-12 items-center justify-center rounded-full shadow-float transition-transform group-active:scale-95 motion-reduce:transition-none",
                        entry.kind === "action" ? "bg-accent text-on-accent" : entry.current ? "bg-accent-soft text-accent ring-2 ring-accent" : "bg-bg-elevated text-label",
                    )}
                >
                    <entry.icon aria-hidden className="size-5" strokeWidth={2} />
                </span>
            </button>
        </motion.li>
    );
}

function Divider({ reduceMotion }: { reduceMotion: boolean }): ReactNode {
    return (
        <motion.li
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: fade }}
            transition={reduceMotion ? fade : spring.default}
            className="my-1 mr-3 h-px w-28 self-end bg-white/40"
        />
    );
}

export function FloatingMenu() {
    const [open, setOpen] = useState(false);
    const reduceMotion = useReducedMotion() ?? false;
    const navigate = useNavigate();
    const pathname = useRouterState({ select: (state) => state.location.pathname });
    const openCreate = useOpenCreate();
    const openNote = useNoteSheetStore((state) => state.openNew);
    const access = useOwnerAccess();
    const buttonRef = useRef<HTMLButtonElement>(null);
    const listRef = useRef<HTMLUListElement>(null);
    const menuId = useId();

    const close = (restoreFocus = true) => {
        setOpen(false);
        if (restoreFocus) buttonRef.current?.focus();
    };

    useEffect(() => {
        if (!open) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") close();
        };
        window.addEventListener("keydown", onKeyDown);
        listRef.current?.focus();
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [open]);

    useEffect(() => {
        setOpen(false);
    }, [pathname]);

    const runAction = (action: () => void) => () => {
        close(false);
        action();
    };

    const actions: MenuEntry[] = [
        ...(access.canCreate
            ? [
                  {
                      id: "task",
                      label: access.isSelf ? "Nueva tarea" : `Rutina para ${access.name ?? "otra persona"}`,
                      icon: ListPlus,
                      kind: "action" as const,
                      onSelect: runAction(openCreate),
                  },
              ]
            : []),
        { id: "note", label: "Nueva nota", icon: StickyNote, kind: "action", onSelect: runAction(openNote) },
    ];

    const destinations: MenuEntry[] = primaryNav.map(({ to, label, icon }) => {
        const current = isActive(pathname, to);
        return {
            id: to,
            label,
            icon,
            kind: "destination",
            current,
            onSelect: () => {
                close(false);
                if (current) scrollToTop();
                else void navigate({ to });
            },
        };
    });

    const entries = [...destinations, ...actions];

    return (
        <div className="lg:hidden">
            <AnimatePresence>
                {open ? (
                    <motion.div
                        key="scrim"
                        aria-hidden
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={reduceMotion ? fade : spring.default}
                        onClick={() => close()}
                        className="fixed inset-0 z-40 bg-scrim backdrop-blur-[3px]"
                    />
                ) : null}
            </AnimatePresence>

            <div className="fixed right-[max(env(safe-area-inset-right),1rem)] bottom-[max(env(safe-area-inset-bottom),1rem)] z-40 flex flex-col items-end gap-3">
                <AnimatePresence>
                    {open ? (
                        <motion.ul key="menu" id={menuId} ref={listRef} tabIndex={-1} aria-label="Menú" className="flex flex-col items-end gap-2 outline-none" exit={{ transition: { duration: 0.2 } }}>
                            {destinations.map((entry, index) => (
                                <MenuItem key={entry.id} entry={entry} index={index} total={entries.length} reduceMotion={reduceMotion} />
                            ))}
                            <Divider reduceMotion={reduceMotion} />
                            {actions.map((entry, index) => (
                                <MenuItem key={entry.id} entry={entry} index={destinations.length + index} total={entries.length} reduceMotion={reduceMotion} />
                            ))}
                        </motion.ul>
                    ) : null}
                </AnimatePresence>

                <motion.button
                    ref={buttonRef}
                    type="button"
                    aria-expanded={open}
                    aria-controls={open ? menuId : undefined}
                    aria-label={open ? "Cerrar menú" : "Abrir menú"}
                    onClick={() => {
                        if (!open) haptic(6);
                        setOpen((value) => !value);
                    }}
                    whileTap={{ scale: 0.9 }}
                    transition={spring.snappy}
                    className="flex size-14 items-center justify-center rounded-full bg-accent text-on-accent shadow-[0_10px_30px_color-mix(in_oklab,var(--color-accent)_40%,transparent),0_2px_6px_rgb(0_0_0/0.15)]"
                >
                    <motion.span animate={{ rotate: open ? 45 : 0 }} transition={reduceMotion ? { duration: 0 } : spring.sheet} className="flex">
                        <Plus aria-hidden className="size-7" strokeWidth={2.4} />
                    </motion.span>
                </motion.button>
            </div>
        </div>
    );
}
