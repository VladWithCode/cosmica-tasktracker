import { useEffect } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/cn";
import { project } from "@/lib/gesture";
import { fade, spring } from "@/lib/motion";
import { useToastStore, type Toast } from "@/stores/toast";

function ToastItem({ item }: { item: Toast }) {
    const dismiss = useToastStore((state) => state.dismiss);
    const reduceMotion = useReducedMotion();

    useEffect(() => {
        const timer = window.setTimeout(() => dismiss(item.id, true), item.duration);
        return () => window.clearTimeout(timer);
    }, [dismiss, item.id, item.duration]);

    return (
        <motion.li
            layout={!reduceMotion}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.96 }}
            transition={reduceMotion ? fade : spring.default}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.1, bottom: 0.8 }}
            onDragEnd={(_, info) => {
                if (info.offset.y + project(info.velocity.y) > 60) dismiss(item.id, true);
            }}
            role={item.tone === "error" ? "alert" : "status"}
            className={cn(
                "pointer-events-auto flex min-h-12 w-full max-w-md touch-none items-center gap-3 rounded-card px-4 py-3 shadow-float",
                "bg-bg-elevated text-callout text-label",
                item.tone === "error" && "text-danger",
            )}
        >
            <span className="flex-1">{item.message}</span>
            {item.action ? (
                <button
                    type="button"
                    className="-my-2 -mr-2 min-h-11 px-2 font-semibold text-accent"
                    onClick={() => {
                        item.action?.onAction();
                        dismiss(item.id);
                    }}
                >
                    {item.action.label}
                </button>
            ) : null}
        </motion.li>
    );
}

export function Toaster() {
    const toasts = useToastStore((state) => state.toasts);
    return (
        <ol
            aria-live="polite"
            className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-50 flex flex-col items-center gap-2 px-4 lg:bottom-6"
        >
            <AnimatePresence initial={false}>
                {toasts.map((item) => (
                    <ToastItem key={item.id} item={item} />
                ))}
            </AnimatePresence>
        </ol>
    );
}
