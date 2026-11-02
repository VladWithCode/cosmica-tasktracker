import { Outlet } from "@tanstack/react-router";
import { Sidebar } from "./Sidebar";
import { TabBar } from "./TabBar";

export function AppShell() {
    return (
        <div data-vaul-drawer-wrapper="" className="min-h-dvh bg-bg lg:pl-64">
            <Sidebar />
            <Outlet />
            <TabBar />
        </div>
    );
}
