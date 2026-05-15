import { Link, useRouterState } from "@tanstack/react-router";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { cn } from "@/lib/utils";

interface BottomNavItem {
    to: "/tasks" | "/focus" | "/stats" | "/wellness";
    activePaths: string[];
    icon: string;
    label: string;
}

const navItems: BottomNavItem[] = [
    { to: "/tasks", activePaths: ["/tasks"], icon: "auto_awesome", label: "Rituales" },
    { to: "/focus", activePaths: ["/focus"], icon: "timer", label: "Focus" },
    {
        to: "/stats",
        activePaths: ["/stats"],
        icon: "insights",
        label: "Estadísticas",
    },
    { to: "/wellness", activePaths: ["/wellness"], icon: "spa", label: "Bienestar" },
];

export function BottomNavBar() {
    const pathname = useRouterState({ select: (state) => state.location.pathname });

    return (
        <nav
            aria-label="Navegación principal"
            className="fixed bottom-6 left-1/2 z-50 mx-auto flex w-[90%] max-w-md -translate-x-1/2 items-center justify-around rounded-[2rem] bg-surface-container-high/90 px-4 py-2 shadow-[0_10px_40px_rgba(116,89,247,0.25)] backdrop-blur-2xl md:hidden"
        >
            {navItems.map((item) => {
                const isActive = item.activePaths.some((activePath) =>
                    pathname.startsWith(activePath),
                );

                return (
                    <Link
                        aria-label={item.label}
                        className={cn(
                            "group flex h-14 w-14 items-center justify-center rounded-full transition-all duration-300 ease-out active:scale-90",
                            isActive
                                ? "bg-gradient-to-br from-primary to-primary-dim text-on-primary shadow-[0_0_20px_rgba(175,162,255,0.45)]"
                                : "text-on-surface-variant hover:text-primary",
                        )}
                        key={item.to}
                        to={item.to}
                    >
                        <MaterialIcon
                            name={item.icon}
                            filled={isActive}
                            className={cn("text-[1.65rem]", isActive && "group-hover:text-on-primary")}
                        />
                    </Link>
                );
            })}
        </nav>
    );
}
