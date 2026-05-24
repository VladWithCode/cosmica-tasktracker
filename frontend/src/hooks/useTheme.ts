import { useCallback, useSyncExternalStore } from "react";

export type ThemePreference = "system" | "light" | "dark";

const STORAGE_KEY = "theme-preference";

function getStoredPreference(): ThemePreference {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored === "light" || stored === "dark" || stored === "system") {
            return stored;
        }
    } catch {
        // localStorage unavailable
    }
    return "system";
}

function getResolvedTheme(preference: ThemePreference): "light" | "dark" {
    if (preference === "light" || preference === "dark") return preference;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

const THEME_COLORS = { light: "#fdf8ff", dark: "#0d0d18" } as const;

function applyTheme(preference: ThemePreference) {
    const resolved = getResolvedTheme(preference);
    const root = document.documentElement;
    root.classList.toggle("dark", resolved === "dark");
    root.classList.toggle("light", resolved === "light");
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", THEME_COLORS[resolved]);
}

// Simple external store for cross-component sync
let currentPreference = getStoredPreference();
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

function getSnapshot(): ThemePreference {
    return currentPreference;
}

function setPreference(next: ThemePreference) {
    currentPreference = next;
    try {
        localStorage.setItem(STORAGE_KEY, next);
    } catch {
        // localStorage unavailable
    }
    applyTheme(next);
    for (const listener of listeners) listener();
}

// Apply on module load (before React renders)
applyTheme(currentPreference);

// Listen for system preference changes
if (typeof window !== "undefined") {
    window
        .matchMedia("(prefers-color-scheme: dark)")
        .addEventListener("change", () => {
            if (currentPreference === "system") {
                applyTheme("system");
                for (const listener of listeners) listener();
            }
        });
}

export function useTheme() {
    const preference = useSyncExternalStore(subscribe, getSnapshot);
    const resolved = getResolvedTheme(preference);

    const setTheme = useCallback((next: ThemePreference) => {
        setPreference(next);
    }, []);

    const cycle = useCallback(() => {
        const order: ThemePreference[] = ["system", "light", "dark"];
        const idx = order.indexOf(currentPreference);
        setPreference(order[(idx + 1) % order.length]!);
    }, []);

    return { preference, resolved, setTheme, cycle };
}
