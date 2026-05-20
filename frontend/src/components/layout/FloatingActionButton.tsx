import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { QuickTaskDialog } from "@/components/tasks/QuickTaskDialog";
import { cn } from "@/lib/utils";

interface MenuItem {
    icon: string;
    label: string;
    action: "quick-task" | { to: string };
}

const menuItems: MenuItem[] = [
    { icon: "bolt", label: "Tarea rápida", action: "quick-task" },
    { icon: "edit_note", label: "Nueva rutina", action: { to: "/tasks/new" } },
    { icon: "auto_awesome", label: "Rituales", action: { to: "/tasks" } },
    { icon: "insights", label: "Estadísticas", action: { to: "/stats" } },
    { icon: "calendar_month", label: "Mis rutinas", action: { to: "/schedules" } },
];

export function FloatingActionButton() {
    const [isOpen, setIsOpen] = useState(false);
    const [quickTaskOpen, setQuickTaskOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();

    const toggle = useCallback(() => setIsOpen((prev) => !prev), []);
    const close = useCallback(() => setIsOpen(false), []);

    // Close on click outside
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                close();
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [isOpen, close]);

    // Close on Escape
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") close();
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [isOpen, close]);

    const handleItemClick = useCallback(
        (item: MenuItem) => {
            close();
            if (item.action === "quick-task") {
                setQuickTaskOpen(true);
            } else {
                void navigate({ to: item.action.to });
            }
        },
        [close, navigate],
    );

    return (
        <>
            {/* Backdrop */}
            {isOpen ? (
                <div
                    aria-hidden
                    className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] md:hidden"
                    onClick={close}
                />
            ) : null}

            <div ref={containerRef} className="fixed bottom-24 right-6 z-40 md:bottom-10 md:right-10">
                {/* Menu items */}
                <nav
                    aria-label="Menú de acciones"
                    className={cn(
                        "absolute bottom-16 right-0 flex flex-col-reverse gap-2 transition-all duration-200",
                        isOpen
                            ? "pointer-events-auto translate-y-0 opacity-100"
                            : "pointer-events-none translate-y-4 opacity-0",
                    )}
                >
                    {menuItems.map((item, i) => (
                        <button
                            key={item.label}
                            aria-label={item.label}
                            className="flex items-center gap-3 whitespace-nowrap rounded-full border border-outline-variant/30 bg-surface-container px-4 py-2.5 shadow-lg transition-all duration-200 hover:bg-surface-container-highest"
                            onClick={() => handleItemClick(item)}
                            style={{
                                transitionDelay: isOpen ? `${i * 40}ms` : "0ms",
                            }}
                            type="button"
                        >
                            <MaterialIcon
                                className="text-xl text-primary"
                                name={item.icon}
                            />
                            <span className="font-label text-sm font-bold text-on-surface">
                                {item.label}
                            </span>
                        </button>
                    ))}
                </nav>

                {/* FAB toggle */}
                <button
                    aria-expanded={isOpen}
                    aria-label={isOpen ? "Cerrar menú" : "Abrir menú"}
                    className="flex h-14 w-14 items-center justify-center rounded-full border border-primary-container/50 bg-gradient-to-br from-primary to-primary-dim text-on-primary shadow-[0_15px_40px_rgba(175,162,255,0.35)] transition-all duration-300 hover:scale-105 active:scale-95"
                    onClick={toggle}
                    type="button"
                >
                    <MaterialIcon
                        className={cn(
                            "text-3xl transition-transform duration-300",
                            isOpen && "rotate-45",
                        )}
                        name="add"
                    />
                </button>
            </div>

            <QuickTaskDialog
                onClose={() => setQuickTaskOpen(false)}
                open={quickTaskOpen}
            />
        </>
    );
}
