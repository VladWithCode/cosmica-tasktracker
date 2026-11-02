import { Outlet } from "@tanstack/react-router";
import { Sidebar } from "./Sidebar";
import { TabBar } from "./TabBar";

export function AppShell() {
    return (
        <div className="min-h-dvh lg:pl-64">
            <Sidebar />
            <Outlet />
            <TabBar />
        </div>
    );
}
