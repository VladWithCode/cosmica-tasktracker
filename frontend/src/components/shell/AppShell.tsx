import { lazy } from "react";
import { Outlet } from "@tanstack/react-router";
import { Deferred } from "@/components/ui/Deferred";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useCreateStore } from "@/stores/create";
import { Sidebar } from "./Sidebar";
import { TabBar } from "./TabBar";

const CreateSheet = lazy(() => import("@/features/create/CreateSheet").then((module) => ({ default: module.CreateSheet })));

export function AppShell() {
    const createOpen = useCreateStore((state) => state.open);
    useKeyboardShortcuts();
    return (
        <div data-vaul-drawer-wrapper="" className="min-h-dvh bg-bg lg:pl-64">
            <Sidebar />
            <Outlet />
            <TabBar />
            <Deferred when={createOpen}>
                <CreateSheet />
            </Deferred>
        </div>
    );
}
