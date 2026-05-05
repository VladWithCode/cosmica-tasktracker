import { useMemo } from "react";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { cn } from "@/lib/utils";
import type { TaskStatus } from "@/types/task";

interface CounterTaskProgressProps {
    category?: string | null;
    currentCount: number;
    /** Compact variant uses a thinner footprint for cards on /tasks. */
    compact?: boolean;
    description?: string | null;
    status?: TaskStatus;
    targetCount: number | null | undefined;
    title?: string | null;
}

const MAX_VISUAL_UNITS = 16;
const WATER_KEYWORDS = [
    "agua",
    "water",
    "hidrat",
    "hydration",
    "hydrate",
    "bebida",
    "drink",
    "bebe",
];

export function isCounterTask(task: { target_count?: number | null; targetCount?: number | null }) {
    const target = task.target_count ?? task.targetCount;
    return typeof target === "number" && target > 0;
}

export function isWaterCounter(input: {
    category?: string | null;
    description?: string | null;
    title?: string | null;
}) {
    const haystack = [input.title, input.category, input.description]
        .filter((value): value is string => typeof value === "string" && value.length > 0)
        .map((value) => value.toLowerCase())
        .join(" ");
    if (!haystack) {
        return false;
    }
    return WATER_KEYWORDS.some((keyword) => haystack.includes(keyword));
}

export function CounterTaskProgress({
    category,
    currentCount,
    compact = false,
    description,
    status,
    targetCount,
    title,
}: CounterTaskProgressProps) {
    const water = useMemo(
        () => isWaterCounter({ category, description, title }),
        [category, description, title],
    );

    const normalizedTarget = targetCount && targetCount > 0 ? targetCount : 0;
    const safeCurrent =
        normalizedTarget > 0 ? Math.max(0, Math.min(currentCount, normalizedTarget)) : 0;
    const visualUnits = useMemo(() => {
        const units: Array<{ filled: boolean }> = [];
        if (normalizedTarget <= 0) {
            return units;
        }
        if (normalizedTarget <= MAX_VISUAL_UNITS) {
            for (let index = 0; index < normalizedTarget; index += 1) {
                units.push({ filled: index < safeCurrent });
            }
            return units;
        }
        // Compact representation when target is huge: show MAX_VISUAL_UNITS slots,
        // each slot represents ceil(targetCount / MAX_VISUAL_UNITS) raw units and
        // gets filled proportionally to currentCount.
        const filledSlots = Math.round((safeCurrent / normalizedTarget) * MAX_VISUAL_UNITS);
        for (let index = 0; index < MAX_VISUAL_UNITS; index += 1) {
            units.push({ filled: index < filledSlots });
        }
        return units;
    }, [safeCurrent, normalizedTarget]);

    if (normalizedTarget <= 0) {
        return null;
    }

    const percentage = (safeCurrent * 100) / normalizedTarget;
    const taskCompleted = status === "completed" || safeCurrent >= normalizedTarget;
    const visualLimit = Math.min(normalizedTarget, MAX_VISUAL_UNITS);

    const iconName = water ? "local_drink" : "circle";
    const unitLabel = water ? "Botella" : "Unidad";
    const summaryLabel = water ? "litros" : "unidades";

    return (
        <section
            aria-label={`Progreso del contador: ${safeCurrent} de ${normalizedTarget} ${summaryLabel}`}
            className={cn(
                "rounded-xl border border-outline-variant/10 bg-surface-container-lowest",
                compact ? "p-3" : "p-4",
            )}
            role="group"
        >
            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <p className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                        {water ? "Hidratación" : "Contador"}
                    </p>
                    <p
                        aria-live="polite"
                        className={cn(
                            "font-display font-extrabold tracking-tight tabular-nums text-on-surface",
                            compact ? "mt-1 text-base" : "mt-1 text-xl",
                        )}
                    >
                        {safeCurrent}
                        <span className="text-on-surface-variant">/{normalizedTarget}</span>
                        <span
                            className={cn(
                                "ml-2 font-bold text-on-surface-variant",
                                compact ? "text-xs" : "text-sm",
                            )}
                        >
                            {summaryLabel}
                        </span>
                    </p>
                </div>
                <span
                    className={cn(
                        "rounded-full px-2 py-0.5 font-label text-[10px] font-extrabold uppercase tracking-widest tabular-nums",
                        taskCompleted
                            ? "bg-tertiary/15 text-tertiary"
                            : "bg-primary/10 text-primary",
                    )}
                >
                    {Math.round(percentage)}%
                </span>
            </div>

            <ul
                aria-hidden={false}
                className={cn(
                    "mt-3 grid gap-1.5",
                    compact ? "grid-cols-8" : "grid-cols-8 sm:grid-cols-12",
                )}
            >
                {visualUnits.map((unit, index) => (
                    <li
                        aria-label={`${unitLabel} ${index + 1}: ${unit.filled ? "completada" : "pendiente"}`}
                        className={cn(
                            "flex aspect-square items-center justify-center rounded-md transition-all duration-300",
                            unit.filled
                                ? water
                                    ? "bg-tertiary/15 text-tertiary"
                                    : "bg-primary/15 text-primary"
                                : "bg-surface-container-highest/50 text-on-surface-variant/40",
                        )}
                        key={index}
                    >
                        <MaterialIcon
                            filled={unit.filled}
                            name={iconName}
                            className={cn(compact ? "text-base" : "text-lg")}
                        />
                    </li>
                ))}
            </ul>

            {normalizedTarget > visualLimit ? (
                <p
                    className={cn(
                        "mt-2 text-on-surface-variant",
                        compact ? "text-[10px]" : "text-xs",
                    )}
                >
                    Mostrando resumen visual de {normalizedTarget} {summaryLabel}.
                </p>
            ) : null}
        </section>
    );
}
