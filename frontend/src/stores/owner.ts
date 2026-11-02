import { create } from "zustand";

type OwnerState = {
    ownerId: string | null;
    setOwner: (ownerId: string | null) => void;
};

export const useOwnerStore = create<OwnerState>((set) => ({
    ownerId: null,
    setOwner: (ownerId) => set({ ownerId }),
}));
