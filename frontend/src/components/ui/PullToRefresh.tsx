import { useEffect, useRef, type ReactNode } from "react";
import { animate, motion, useMotionValue, useTransform } from "motion/react";
import { RefreshCw } from "lucide-react";
import { rubberband } from "@/lib/gesture";
import { haptic } from "@/lib/haptics";
import { spring } from "@/lib/motion";

const THRESHOLD = 72;
const HOLD = 56;

export function PullToRefresh({ onRefresh, children }: { onRefresh: () => Promise<unknown>; children: ReactNode }) {
    const ref = useRef<HTMLDivElement>(null);
    const pull = useMotionValue(0);
    const refreshing = useRef(false);
    const indicatorOpacity = useTransform(pull, [0, THRESHOLD * 0.6, THRESHOLD], [0, 0.4, 1]);
    const indicatorRotate = useTransform(pull, [0, THRESHOLD], [0, 270]);
    const onRefreshRef = useRef(onRefresh);
    onRefreshRef.current = onRefresh;

    useEffect(() => {
        const element = ref.current;
        if (!element) return;
        let startY: number | null = null;
        let armed = false;

        const onStart = (event: TouchEvent) => {
            if (refreshing.current || window.scrollY > 0 || event.touches.length !== 1) return;
            startY = event.touches[0]?.clientY ?? null;
            armed = false;
            pull.stop();
        };

        const onMove = (event: TouchEvent) => {
            if (startY === null) return;
            const dy = (event.touches[0]?.clientY ?? startY) - startY;
            if (dy <= 0 || window.scrollY > 0) {
                if (pull.get() !== 0) pull.set(0);
                return;
            }
            event.preventDefault();
            const value = rubberband(dy, window.innerHeight, 0.7);
            pull.set(value);
            if (!armed && value >= THRESHOLD) {
                armed = true;
                haptic(8);
            } else if (armed && value < THRESHOLD) {
                armed = false;
            }
        };

        const onEnd = () => {
            if (startY === null) return;
            startY = null;
            if (pull.get() >= THRESHOLD) {
                refreshing.current = true;
                animate(pull, HOLD, spring.default);
                void onRefreshRef.current().finally(() => {
                    refreshing.current = false;
                    animate(pull, 0, spring.default);
                });
            } else {
                animate(pull, 0, spring.default);
            }
        };

        element.addEventListener("touchstart", onStart, { passive: true });
        element.addEventListener("touchmove", onMove, { passive: false });
        element.addEventListener("touchend", onEnd);
        element.addEventListener("touchcancel", onEnd);
        return () => {
            element.removeEventListener("touchstart", onStart);
            element.removeEventListener("touchmove", onMove);
            element.removeEventListener("touchend", onEnd);
            element.removeEventListener("touchcancel", onEnd);
        };
    }, [pull]);

    return (
        <div ref={ref} className="relative">
            <motion.div aria-hidden style={{ opacity: indicatorOpacity }} className="pointer-events-none absolute inset-x-0 top-0 flex justify-center pt-3">
                <motion.span style={{ rotate: indicatorRotate }} className="text-label-secondary">
                    <RefreshCw className="size-6" />
                </motion.span>
            </motion.div>
            <motion.div style={{ y: pull }}>{children}</motion.div>
        </div>
    );
}
