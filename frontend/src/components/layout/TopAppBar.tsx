import { Link, useRouter } from "@tanstack/react-router";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { cn } from "@/lib/utils";

interface TopAppBarProps {
    align?: "left" | "center";
    showBackButton?: boolean;
    title?: string;
}

export function TopAppBar({ align = "left", showBackButton = false, title = "Routine Ritual" }: TopAppBarProps) {
    const router = useRouter();

    const handleBack = () => {
        // If there's browser history, go back; otherwise navigate to /tasks as fallback
        if (window.history.length > 1) {
            router.history.back();
        } else {
            void router.navigate({ to: "/tasks" });
        }
    };

    const backButton = (
        <button
            aria-label="Volver"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-surface-container-highest bg-surface-container-high text-primary shadow-[0_0_20px_rgba(175,162,255,0.15)] transition-all duration-300 hover:border-primary/40 active:scale-95"
            onClick={handleBack}
            type="button"
        >
            <MaterialIcon name="arrow_back" className="text-2xl" />
        </button>
    );

    const profileLink = (
        <Link
            aria-label="Abrir perfil"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-surface-container-highest bg-surface-container-high text-primary shadow-[0_0_20px_rgba(175,162,255,0.15)] transition-all duration-300 hover:border-primary/40 active:scale-95"
            to="/profile"
        >
            <MaterialIcon name="person" filled className="text-2xl" />
        </Link>
    );

    const leadingAction = showBackButton ? backButton : profileLink;

    if (align === "center") {
        return (
            <header className="sticky top-0 z-40 grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 bg-surface/90 bg-gradient-to-b from-surface-container/80 to-surface/80 px-6 py-4 shadow-[0_20px_50px_rgba(112,0,255,0.15)] backdrop-blur-xl">
                {leadingAction}
                <h1 className="min-w-0 truncate text-center font-display text-lg font-extrabold uppercase tracking-widest text-on-surface">
                    {title}
                </h1>
                <button
                    aria-label="Ver notificaciones"
                    className="flex h-8 w-8 items-center justify-center text-primary transition-all duration-300 hover:opacity-80 active:scale-95"
                    type="button"
                >
                    <MaterialIcon name="notifications" />
                </button>
            </header>
        );
    }

    return (
        <header className="sticky top-0 z-40 flex w-full items-center justify-between bg-surface/90 bg-gradient-to-b from-surface-container/80 to-surface/80 px-6 py-4 shadow-[0_20px_50px_rgba(112,0,255,0.15)] backdrop-blur-xl">
            <div className="flex min-w-0 items-center gap-4">
                {leadingAction}
                <h1 className="truncate font-display text-lg font-extrabold uppercase tracking-widest text-on-surface">
                    {title}
                </h1>
            </div>
            <button
                aria-label="Ver notificaciones"
                className={cn(
                    "rounded-full p-2 text-primary transition-all duration-300 hover:bg-surface-container-high active:scale-95",
                )}
                type="button"
            >
                <MaterialIcon name="notifications" className="text-2xl" />
            </button>
        </header>
    );
}
