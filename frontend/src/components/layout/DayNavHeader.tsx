import type { ReactNode } from "react";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { formatDayLong, formatDayShort } from "@/lib/date";

/**
 * Styling for the slot actions, so callers stay visually consistent with the
 * built-in day arrows. Exported as class names rather than components because
 * a slot may need either a `<button>` (local action) or a `<Link>`.
 */
export const dayNavNeutralAction =
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-outline-variant/20 bg-surface-container-lowest text-on-surface-variant transition-colors hover:text-primary";

export const dayNavPrimaryAction =
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary shadow-sm transition-all hover:bg-primary/20 active:scale-95";

interface DayNavHeaderProps {
    /** `YYYY-MM-DD` day currently in view. */
    date: string;
    onPrev: () => void;
    onNext: () => void;
    /** Left slot, e.g. a link out to the month calendar. */
    leading?: ReactNode;
    /** Right slot, e.g. a create action for the day in view. */
    actions?: ReactNode;
}

/**
 * Sticky day navigation bar: leading slot, previous/next arrows around the
 * formatted date, then a trailing action slot.
 *
 * Expects a scrolling parent padded with `px-4 sm:px-6` — the bar cancels that
 * padding so content cannot show through its side gutters while scrolling
 * underneath it.
 */
export function DayNavHeader({ date, onPrev, onNext, leading, actions }: DayNavHeaderProps) {
    return (
        <header className="sticky top-0 z-30 -mx-4 mb-4 border-b border-outline-variant/10 bg-surface/90 px-4 py-1.5 backdrop-blur-xl sm:-mx-6 sm:px-6">
            <div className="flex items-center gap-2">
                {leading ?? <SlotSpacer />}

                <div className="flex min-w-0 flex-1 items-center justify-center gap-1">
                    <button
                        aria-label="Día anterior"
                        className={dayNavNeutralAction}
                        onClick={onPrev}
                        type="button"
                    >
                        <MaterialIcon name="chevron_left" className="text-xl" />
                    </button>

                    <p className="min-w-0 truncate text-center font-display text-sm font-bold capitalize text-on-surface sm:text-base">
                        <span className="sm:hidden">{formatDayShort(date)}</span>
                        <span className="hidden sm:inline">{formatDayLong(date)}</span>
                    </p>

                    <button
                        aria-label="Día siguiente"
                        className={dayNavNeutralAction}
                        onClick={onNext}
                        type="button"
                    >
                        <MaterialIcon name="chevron_right" className="text-xl" />
                    </button>
                </div>

                {actions ?? <SlotSpacer />}
            </div>
        </header>
    );
}

/** Keeps the date optically centred when a slot is unused. */
function SlotSpacer() {
    return <div aria-hidden className="h-9 w-9 shrink-0" />;
}
