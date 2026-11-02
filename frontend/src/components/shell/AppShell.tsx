import { lazy } from "react";
import { Outlet } from "@tanstack/react-router";
import { Deferred } from "@/components/ui/Deferred";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useCreateStore } from "@/stores/create";
import { useNoteSheetStore } from "@/stores/note";
import { Sidebar } from "./Sidebar";
import { FloatingMenu } from "./FloatingMenu";

const NoteSheet = lazy(() => import("@/features/notes/NoteSheet").then((module) => ({ default: module.NoteSheet })));
const CreateSheet = lazy(() => import("@/features/create/CreateSheet").then((module) => ({ default: module.CreateSheet })));

export function AppShell() {
    const createOpen = useCreateStore((state) => state.open);
    const noteOpen = useNoteSheetStore((state) => state.target !== null);
    useKeyboardShortcuts();
    return (
        <div data-vaul-drawer-wrapper="" className="min-h-dvh bg-bg lg:pl-64">
            <Sidebar />
            <Outlet />
            <FloatingMenu />
            <Deferred when={noteOpen}>
                <NoteSheet />
            </Deferred>
            <Deferred when={createOpen}>
                <CreateSheet />
            </Deferred>
        </div>
    );
}
