import { create } from "zustand";

type CreateState = {
    open: boolean;
    date: string | null;
    openCreate: (date?: string) => void;
    closeCreate: () => void;
};

export const useCreateStore = create<CreateState>((set) => ({
    open: false,
    date: null,
    openCreate: (date) => set({ open: true, date: date ?? null }),
    closeCreate: () => set({ open: false }),
}));
