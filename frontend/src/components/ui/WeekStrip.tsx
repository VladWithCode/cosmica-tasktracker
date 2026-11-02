import { useRef, type PointerEvent } from "react";
import { animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import { cn } from "@/lib/cn";
import { formatDay, fromISODate, isToday, shiftISODate, weekDays } from "@/lib/date";
import { lockDirection, project, VelocityTracker } from "@/lib/gesture";
import { spring, withVelocity } from "@/lib/motion";
import type { DayMark } from "@/queries/history";

const letters = ["L", "M", "X", "J", "V", "S", "D"];

type WeekStripProps = {
    selected: string;
    onSelect: (date: string) => void;
    marks?: Map<string, DayMark>;
    dotDays?: Set<string>;
};

function Mark({ mark }: { mark?: DayMark }) {
    if (!mark) return <span aria-hidden className="size-1.5" />;
    return (
        <span
            aria-hidden
            className={cn(
                "size-1.5 rounded-full",
                mark === "full" && "bg-success",
                mark === "partial" && "bg-accent",
                mark === "empty" && "bg-label-tertiary",
            )}
        />
    );
}

function Week({ anchor, selected, onSelect, marks, dotDays, interactive }: WeekStripProps & { anchor: string; interactive: boolean }) {
    return (
        <div className="grid w-full shrink-0 grid-cols-7 gap-1 px-2">
            {weekDays(anchor).map((day, index) => {
                const active = day === selected;
                const today = isToday(day);
                return (
                    <button
                        key={day}
                        type="button"
                        tabIndex={interactive ? 0 : -1}
                        aria-hidden={!interactive}
                        aria-pressed={active}
                        aria-label={formatDay(day)}
                        onClick={() => onSelect(day)}
                        className="flex flex-col items-center gap-1 py-1"
                    >
                        <span className="text-caption text-label-secondary">{letters[index]}</span>
                        <span
                            className={cn(
                                "tabular flex size-9 items-center justify-center rounded-full text-callout",
                                active && "bg-accent font-semibold text-on-accent",
                                !active && today && "font-semibold text-accent",
                                !active && !today && "text-label",
                            )}
                        >
                            {fromISODate(day).getDate()}
                        </span>
                        {dotDays ? <span aria-hidden className={cn("size-1.5 rounded-full", dotDays.has(day) ? "bg-label-secondary" : "")} /> : <Mark mark={marks?.get(day)} />}
                    </button>
                );
            })}
        </div>
    );
}

export function WeekStrip(props: WeekStripProps) {
    const { selected, onSelect } = props;
    const reduceMotion = useReducedMotion();
    const ref = useRef<HTMLDivElement>(null);
    const x = useMotionValue(0);
    const start = useRef<{ x: number; y: number; offset: number; id: number } | null>(null);
    const axis = useRef<"x" | "y" | null>(null);
    const tracker = useRef(new VelocityTracker());
    const dragged = useRef(false);

    const width = () => ref.current?.offsetWidth ?? 360;

    const page = async (direction: 1 | -1 | 0, velocity: number) => {
        const target = -direction * width();
        const transition = reduceMotion ? { duration: 0 } : withVelocity(direction ? { ...spring.momentum, bounce: 0 } : spring.default, velocity);
        await animate(x, target, transition);
        if (direction && Math.abs(x.get() - target) < 1) {
            onSelect(shiftISODate(selected, direction * 7));
            x.set(0);
        }
    };

    const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
        if (event.button !== 0) return;
        x.stop();
        start.current = { x: event.clientX, y: event.clientY, offset: x.get(), id: event.pointerId };
        axis.current = null;
        dragged.current = false;
        tracker.current.reset();
        tracker.current.add(x.get(), event.timeStamp);
    };

    const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
        const origin = start.current;
        if (!origin || origin.id !== event.pointerId) return;
        if (axis.current === null) {
            axis.current = lockDirection(event.clientX - origin.x, event.clientY - origin.y);
            if (axis.current === "y") {
                start.current = null;
                return;
            }
            if (axis.current !== "x") return;
            dragged.current = true;
            try {
                event.currentTarget.setPointerCapture(event.pointerId);
            } catch {
                axis.current = "x";
            }
        }
        x.set(origin.offset + event.clientX - origin.x);
        tracker.current.add(x.get(), event.timeStamp);
    };

    const onPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
        const origin = start.current;
        start.current = null;
        if (!origin || axis.current !== "x") return;
        tracker.current.add(x.get(), event.timeStamp);
        const velocity = Math.max(-4000, Math.min(4000, tracker.current.velocity()));
        const projected = x.get() + project(velocity);
        const w = width();
        if (projected < -w / 2 && velocity < 300) void page(1, velocity);
        else if (projected > w / 2 && velocity > -300) void page(-1, velocity);
        else void page(0, velocity);
    };

    return (
        <div ref={ref} className="overflow-hidden" role="group" aria-label="Semana">
            <motion.div
                style={{ x }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerEnd}
                onPointerCancel={onPointerEnd}
                onClickCapture={(event) => {
                    if (dragged.current) {
                        event.preventDefault();
                        event.stopPropagation();
                        dragged.current = false;
                    }
                }}
                className="touch-pan-y select-none"
            >
                <div className="flex -translate-x-full">
                    <Week {...props} anchor={shiftISODate(selected, -7)} interactive={false} />
                    <Week {...props} anchor={selected} interactive />
                    <Week {...props} anchor={shiftISODate(selected, 7)} interactive={false} />
                </div>
            </motion.div>
        </div>
    );
}
