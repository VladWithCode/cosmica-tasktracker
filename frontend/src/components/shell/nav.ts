import { CalendarDays, ChartNoAxesColumn, NotebookPen, Repeat, Sun, type LucideIcon } from "lucide-react";

export type NavItem = {
    to: "/" | "/calendar" | "/routines" | "/progress" | "/notes";
    label: string;
    icon: LucideIcon;
};

export const primaryNav: NavItem[] = [
    { to: "/", label: "Hoy", icon: Sun },
    { to: "/calendar", label: "Calendario", icon: CalendarDays },
    { to: "/routines", label: "Rutinas", icon: Repeat },
    { to: "/progress", label: "Progreso", icon: ChartNoAxesColumn },
    { to: "/notes", label: "Notas", icon: NotebookPen },
];

export function isActive(pathname: string, to: string) {
    return to === "/" ? pathname === "/" || pathname.startsWith("/tasks") : pathname.startsWith(to);
}

export function scrollToTop() {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
}
