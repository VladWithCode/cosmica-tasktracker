import { forwardRef } from "react";
import { motion, type HTMLMotionProps } from "motion/react";
import { spring } from "@/lib/motion";

export type PressableProps = HTMLMotionProps<"button"> & { pressScale?: number };

export const Pressable = forwardRef<HTMLButtonElement, PressableProps>(function Pressable(
    { pressScale = 0.97, type = "button", disabled, ...props },
    ref,
) {
    return (
        <motion.button
            ref={ref}
            type={type}
            disabled={disabled}
            whileTap={disabled ? undefined : { scale: pressScale, opacity: 0.85 }}
            transition={spring.snappy}
            {...props}
        />
    );
});
