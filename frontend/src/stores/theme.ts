import { create } from "zustand";
import { readStorage, writeStorage } from "@/lib/storage";

export type ThemePreference = "system" | "light" | "dark";

const STORAGE_KEY = "cosmica.theme";

function readPreference(): ThemePreference {
    const value = readStorage(STORAGE_KEY);
    return value === "light" || value === "dark" ? value : "system";
}

export function applyTheme(preference: ThemePreference, animate = false) {
    const root = document.documentElement;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (animate && !reduceMotion) {
        root.classList.add("theme-transition");
        window.setTimeout(() => root.classList.remove("theme-transition"), 250);
    }
    if (preference === "system") delete root.dataset.theme;
    else root.dataset.theme = preference;
}

type ThemeState = {
    preference: ThemePreference;
    setPreference: (preference: ThemePreference) => void;
};

export const useThemeStore = create<ThemeState>((set) => ({
    preference: readPreference(),
    setPreference: (preference) => {
        writeStorage(STORAGE_KEY, preference === "system" ? null : preference);
        applyTheme(preference, true);
        set({ preference });
    },
}));

export function initTheme() {
    applyTheme(readPreference());
}
