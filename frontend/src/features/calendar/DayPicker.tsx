import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronDown } from "lucide-react";
import { WeekStrip } from "@/components/ui/WeekStrip";
import { cn } from "@/lib/cn";
import { formatMonth, monthGrid, weekDays } from "@/lib/date";
import { fade, spring } from "@/lib/motion";
import type { DayMark } from "@/queries/history";
import { MonthGrid } from "./MonthGrid";

export function visibleRange(date: string, monthOpen: boolean): { from: string; to: string } {
    if (monthOpen) {
        const grid = monthGrid(date);
        return { from: grid[0]?.[0] ?? date, to: grid[grid.length - 1]?.[6] ?? date };
    }
    const week = weekDays(date);
    return { from: week[0] ?? date, to: week[6] ?? date };
}

export function MonthToggle({ date, open, onToggle }: { date: string; open: boolean; onToggle: () => void }) {
    return (
        <button type="button" aria-expanded={open} onClick={onToggle} className="flex min-h-11 items-center gap-1 text-callout font-medium text-accent">
            {formatMonth(date)}
            <ChevronDown aria-hidden className={cn("size-4 transition-transform motion-reduce:transition-none", open && "rotate-180")} />
        </button>
    );
}

type DayPickerProps = {
    date: string;
    monthOpen: boolean;
    onSelect: (date: string) => void;
    marks?: Map<string, DayMark>;
    dotDays?: Set<string>;
};

export function DayPicker({ date, monthOpen, onSelect, marks, dotDays }: DayPickerProps) {
    const reduceMotion = useReducedMotion();
    return (
        <div className="material-bar top-below-bar sticky z-20 py-1">
            <AnimatePresence initial={false} mode="popLayout">
                {monthOpen ? (
                    <motion.div
                        key="month"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={reduceMotion ? fade : spring.default}
                        className="overflow-hidden"
                    >
                        <MonthGrid selected={date} onSelect={onSelect} marks={marks} dotDays={dotDays} />
                    </motion.div>
                ) : (
                    <motion.div key="week" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={fade}>
                        <WeekStrip selected={date} onSelect={onSelect} marks={marks} dotDays={dotDays} />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
