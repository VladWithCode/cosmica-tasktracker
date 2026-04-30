import { Link } from "@tanstack/react-router";
import { MaterialIcon } from "@/components/ui/MaterialIcon";

interface FloatingActionButtonProps {
    to?: "/tasks/new";
    label?: string;
}

export function FloatingActionButton({
    to = "/tasks/new",
    label = "Crear tarea",
}: FloatingActionButtonProps) {
    return (
        <Link
            aria-label={label}
            className="fixed bottom-24 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full border border-primary-container/50 bg-gradient-to-br from-primary to-primary-dim text-on-primary shadow-[0_15px_40px_rgba(175,162,255,0.35)] transition-all duration-300 hover:scale-105 active:scale-95 md:bottom-10 md:right-10"
            to={to}
        >
            <MaterialIcon name="add" className="text-3xl" />
        </Link>
    );
}
