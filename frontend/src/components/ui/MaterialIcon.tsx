import { cn } from "@/lib/utils";

interface MaterialIconProps {
    name: string;
    filled?: boolean;
    className?: string;
    ariaHidden?: boolean;
}

export function MaterialIcon({
    name,
    filled = false,
    className,
    ariaHidden = true,
}: MaterialIconProps) {
    return (
        <span
            aria-hidden={ariaHidden}
            className={cn("material-symbols-outlined select-none", className)}
            data-filled={filled ? "true" : "false"}
        >
            {name}
        </span>
    );
}
