import { Check, EyeOff, Minus, X } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import type { TaskStatus } from "@/api/schemas";
import { cn } from "@/lib/cn";
import { spring } from "@/lib/motion";

type StatusCheckProps = {
    status: TaskStatus;
    title: string;
    onToggle?: () => void;
    disabled?: boolean;
};

const ringClass: Record<TaskStatus, string> = {
    pending: "border-2 border-label-tertiary",
    in_progress: "border-2 border-warning",
    completed: "bg-success text-on-status",
    skipped: "bg-fill text-label-secondary",
    failed: "bg-danger-soft text-danger",
    dismissed: "bg-dismissed-soft text-dismissed",
};

export function StatusCheck({ status, title, onToggle, disabled }: StatusCheckProps) {
    const reduceMotion = useReducedMotion();
    const completed = status === "completed";
    return (
        <motion.button
            type="button"
            aria-label={completed ? `Marcar «${title}» como pendiente` : `Completar «${title}»`}
            aria-pressed={completed}
            disabled={disabled || !onToggle}
            onClick={(event) => {
                event.stopPropagation();
                onToggle?.();
            }}
            whileTap={{ scale: 0.86 }}
            transition={spring.snappy}
            className="-m-2.5 flex size-11 shrink-0 items-center justify-center disabled:cursor-not-allowed"
        >
            <motion.span
                key={status}
                initial={reduceMotion ? false : { scale: 0.7 }}
                animate={{ scale: 1 }}
                transition={spring.snappy}
                className={cn("flex size-[1.625rem] items-center justify-center rounded-full", ringClass[status])}
            >
                {status === "completed" ? <Check aria-hidden className="size-4" strokeWidth={3} /> : null}
                {status === "skipped" ? <Minus aria-hidden className="size-4" strokeWidth={3} /> : null}
                {status === "failed" ? <X aria-hidden className="size-4" strokeWidth={3} /> : null}
                {status === "dismissed" ? <EyeOff aria-hidden className="size-3.5" strokeWidth={2.5} /> : null}
                {status === "in_progress" ? <span aria-hidden className="size-2.5 rounded-full bg-warning" /> : null}
            </motion.span>
        </motion.button>
    );
}
