import { create } from "zustand";

type CreateState = {
    open: boolean;
    date: string | null;
    ownerId: string | null;
    openCreate: (options?: { date?: string; ownerId?: string | null }) => void;
    closeCreate: () => void;
};

export const useCreateStore = create<CreateState>((set) => ({
    open: false,
    date: null,
    ownerId: null,
    openCreate: (options = {}) => set({ open: true, date: options.date ?? null, ownerId: options.ownerId ?? null }),
    closeCreate: () => set({ open: false }),
}));
