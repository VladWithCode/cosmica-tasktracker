import { useRef, useState, type PointerEvent, type ReactNode } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { lockDirection, project, rubberband, VelocityTracker } from "@/lib/gesture";
import { haptic } from "@/lib/haptics";
import { spring, withVelocity } from "@/lib/motion";

type Tone = "success" | "danger" | "neutral" | "warning" | "accent";

export type SwipeAction = {
    id: string;
    label: string;
    icon: LucideIcon;
    tone: Tone;
    onTrigger: () => void;
};

type SwipeRowProps = {
    leading?: SwipeAction;
    trailing?: SwipeAction[];
    disabled?: boolean;
    children: ReactNode;
    className?: string;
};

const ACTION_WIDTH = 78;
const EDGE_GUARD = 20;
const COMMIT_RATIO = 0.45;
const COMMIT_MIN_TRAVEL = 0.2;
const FULL_SWIPE_RATIO = 0.6;
const FULL_SWIPE_MIN_TRAVEL = 0.35;
const MAX_VELOCITY = 4000;

const toneClass: Record<Tone, string> = {
    success: "bg-success text-on-status",
    danger: "bg-danger text-on-status",
    neutral: "bg-label-tertiary text-white",
    warning: "bg-warning text-on-status",
    accent: "bg-accent text-on-accent",
};

type DragStart = { x: number; y: number; offset: number; pointerId: number };

export function SwipeRow({ leading, trailing = [], disabled, children, className }: SwipeRowProps) {
    const reduceMotion = useReducedMotion();
    const containerRef = useRef<HTMLDivElement>(null);
    const start = useRef<DragStart | null>(null);
    const axis = useRef<"x" | "y" | null>(null);
    const tracker = useRef(new VelocityTracker());
    const suppressClick = useRef(false);
    const [open, setOpen] = useState(false);
    const x = useMotionValue(0);

    const trailingWidth = trailing.length * ACTION_WIDTH;
    const width = () => containerRef.current?.offsetWidth ?? 360;

    const leadingProgress = useTransform(x, (value) => Math.min(1, Math.max(0, value / (width() * COMMIT_RATIO))));
    const leadingIconScale = useTransform(leadingProgress, [0, 1], [0.6, 1]);
    const leadingOpacity = useTransform(leadingProgress, [0, 0.35, 1], [0, 0.75, 1]);
    const trailingAreaWidth = useTransform(x, (value) => Math.max(0, -value));

    const settleTo = (target: number, velocity = 0, momentum = false) => {
        const transition = reduceMotion ? spring.default : withVelocity(momentum ? spring.momentum : spring.default, velocity);
        setOpen(target < 0);
        return animate(x, target, transition);
    };

    const constrain = (raw: number) => {
        const w = width();
        const maxRight = leading ? w : 0;
        const minLeft = trailing.length ? -w : 0;
        if (raw > maxRight) return maxRight + rubberband(raw - maxRight, w);
        if (raw < minLeft) return minLeft + rubberband(raw - minLeft, w);
        return raw;
    };

    const commit = async (action: SwipeAction, direction: 1 | -1, velocity: number) => {
        haptic();
        await animate(x, direction * width(), reduceMotion ? spring.snappy : withVelocity({ ...spring.momentum, bounce: 0 }, velocity));
        action.onTrigger();
        setOpen(false);
        animate(x, 0, spring.default);
    };

    const settle = (rawVelocity: number) => {
        const velocity = Math.max(-MAX_VELOCITY, Math.min(MAX_VELOCITY, rawVelocity));
        const current = x.get();
        const projected = current + project(velocity);
        const w = width();
        if (current > 0 && leading) {
            if (projected > w * COMMIT_RATIO && current > w * COMMIT_MIN_TRAVEL && velocity > -300) void commit(leading, 1, velocity);
            else settleTo(0, velocity);
            return;
        }
        if (current < 0 && trailing.length) {
            const [first] = trailing;
            if (first && projected < -w * FULL_SWIPE_RATIO && current < -w * FULL_SWIPE_MIN_TRAVEL && velocity < 300) void commit(first, -1, velocity);
            else if (projected < -trailingWidth / 2 && velocity < 300) settleTo(-trailingWidth, velocity, true);
            else settleTo(0, velocity);
            return;
        }
        settleTo(0, velocity);
    };

    const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
        if (disabled || event.button !== 0) return;
        if (event.pointerType === "touch" && event.clientX < EDGE_GUARD) return;
        x.stop();
        start.current = { x: event.clientX, y: event.clientY, offset: x.get(), pointerId: event.pointerId };
        axis.current = null;
        tracker.current.reset();
        tracker.current.add(x.get(), event.timeStamp);
    };

    const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
        const origin = start.current;
        if (!origin || origin.pointerId !== event.pointerId) return;
        const dx = event.clientX - origin.x;
        const dy = event.clientY - origin.y;
        if (axis.current === null) {
            axis.current = lockDirection(dx, dy);
            if (axis.current === "y") {
                start.current = null;
                return;
            }
            if (axis.current !== "x") return;
            try {
                event.currentTarget.setPointerCapture(event.pointerId);
            } catch {
                axis.current = "x";
            }
        }
        x.set(constrain(origin.offset + dx));
        tracker.current.add(x.get(), event.timeStamp);
    };

    const onPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
        const origin = start.current;
        start.current = null;
        if (!origin || axis.current !== "x") return;
        suppressClick.current = true;
        window.setTimeout(() => {
            suppressClick.current = false;
        }, 0);
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        tracker.current.add(x.get(), event.timeStamp);
        settle(event.type === "pointercancel" ? 0 : tracker.current.velocity());
    };

    return (
        <div ref={containerRef} className={cn("relative overflow-hidden", className)}>
            {leading ? (
                <motion.div aria-hidden style={{ opacity: leadingOpacity }} className={cn("absolute inset-0 flex items-center pl-6", toneClass[leading.tone])}>
                    <motion.span style={{ scale: leadingIconScale }} className="flex flex-col items-center gap-0.5 text-caption">
                        <leading.icon className="size-6" strokeWidth={2.2} />
                        {leading.label}
                    </motion.span>
                </motion.div>
            ) : null}
            {trailing.length ? (
                <motion.div style={{ width: trailingAreaWidth }} className="absolute inset-y-0 right-0 flex justify-end overflow-hidden">
                    {trailing.map((action, index) => (
                        <button
                            key={action.id}
                            type="button"
                            tabIndex={open ? 0 : -1}
                            aria-hidden={!open}
                            onClick={() => {
                                action.onTrigger();
                                settleTo(0);
                            }}
                            style={{ minWidth: ACTION_WIDTH }}
                            className={cn(
                                "flex h-full flex-col items-center justify-center gap-0.5 text-caption",
                                index === 0 ? "flex-1" : "shrink-0",
                                toneClass[action.tone],
                            )}
                        >
                            <action.icon aria-hidden className="size-5" strokeWidth={2} />
                            {action.label}
                        </button>
                    ))}
                </motion.div>
            ) : null}
            <motion.div
                style={{ x }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerEnd}
                onPointerCancel={onPointerEnd}
                onClickCapture={(event) => {
                    if (suppressClick.current) {
                        event.preventDefault();
                        event.stopPropagation();
                    } else if (open) {
                        event.preventDefault();
                        event.stopPropagation();
                        settleTo(0);
                    }
                }}
                className="relative touch-pan-y bg-bg-elevated select-none [-webkit-touch-callout:none]"
            >
                {children}
            </motion.div>
        </div>
    );
}
