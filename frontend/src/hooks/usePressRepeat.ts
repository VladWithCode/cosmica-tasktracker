import { useCallback, useEffect, useRef, type PointerEvent, type MouseEvent } from "react";

const INITIAL_DELAY = 400;
const START_INTERVAL = 180;
const MIN_INTERVAL = 70;

export function usePressRepeat(action: () => void, enabled = true) {
    const timer = useRef<number | null>(null);
    const actionRef = useRef(action);
    actionRef.current = action;

    const stop = useCallback(() => {
        if (timer.current !== null) window.clearTimeout(timer.current);
        timer.current = null;
    }, []);

    useEffect(() => stop, [stop]);

    const onPointerDown = useCallback(
        (event: PointerEvent<HTMLButtonElement>) => {
            if (!enabled || event.button !== 0) return;
            actionRef.current();
            let interval = START_INTERVAL;
            const tick = () => {
                actionRef.current();
                interval = Math.max(MIN_INTERVAL, interval * 0.85);
                timer.current = window.setTimeout(tick, interval);
            };
            timer.current = window.setTimeout(tick, INITIAL_DELAY);
        },
        [enabled],
    );

    const onClick = useCallback(
        (event: MouseEvent<HTMLButtonElement>) => {
            if (enabled && event.detail === 0) actionRef.current();
        },
        [enabled],
    );

    return { onPointerDown, onPointerUp: stop, onPointerLeave: stop, onPointerCancel: stop, onClick, onContextMenu: (event: MouseEvent) => event.preventDefault() };
}
