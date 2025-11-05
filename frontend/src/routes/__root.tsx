import { Outlet, createRootRoute } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/queries/queryClient";
import { useNotifications, useNotificationSubscription } from "@/notifications/notifications";
import { useEffect } from "react";

export const Route = createRootRoute({
    component: () => {
        const { subscribe, vapidKey } = useNotifications();

        useEffect(() => {
            subscribe(vapidKey)
        }, [])

        return (
            <QueryClientProvider client={queryClient}>
                <Outlet />
                <Toaster />
            </QueryClientProvider>
        )
    },
});
