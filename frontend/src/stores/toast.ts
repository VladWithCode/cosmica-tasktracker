import { create } from "zustand";

export type Toast = {
    id: number;
    message: string;
    tone: "default" | "error";
    action?: { label: string; onAction: () => void };
    duration: number;
    onExpire?: () => void;
};

type ToastInput = Omit<Toast, "id" | "tone" | "duration"> & Partial<Pick<Toast, "tone" | "duration">>;

type ToastState = {
    toasts: Toast[];
    show: (toast: ToastInput) => number;
    dismiss: (id: number, expired?: boolean) => void;
};

let nextId = 1;

export const useToastStore = create<ToastState>((set, get) => ({
    toasts: [],
    show: (input) => {
        const id = nextId++;
        const toast: Toast = { tone: "default", duration: 3500, ...input, id };
        set((state) => ({ toasts: [...state.toasts.slice(-2), toast] }));
        return id;
    },
    dismiss: (id, expired = false) => {
        const toast = get().toasts.find((item) => item.id === id);
        if (!toast) return;
        set((state) => ({ toasts: state.toasts.filter((item) => item.id !== id) }));
        if (expired) toast.onExpire?.();
    },
}));

export const toast = {
    show: (message: string, options: Partial<ToastInput> = {}) => useToastStore.getState().show({ message, ...options }),
    error: (message: string) => useToastStore.getState().show({ message, tone: "error", duration: 5000 }),
};
