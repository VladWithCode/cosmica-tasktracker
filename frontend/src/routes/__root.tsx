import { Outlet, createRootRoute } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { TanstackDevtools } from "@tanstack/react-devtools";
import { Toaster } from "sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export const queryClient = new QueryClient();

export const Route = createRootRoute({
    component: () => (
        <QueryClientProvider client={queryClient}>
            <Outlet />
            <Toaster />
            <TanstackDevtools
                config={{
                    position: "bottom-left",
                }}
                plugins={[
                    {
                        name: "Tanstack Router",
                        render: <TanStackRouterDevtoolsPanel />,
                    },
                ]}
            />
        </QueryClientProvider>
    ),
});
