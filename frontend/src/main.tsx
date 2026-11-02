import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "motion/react";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { setSessionExpiredHandler } from "@/api/client";
import { queryClient } from "@/queries/client";
import { queryKeys } from "@/queries/keys";
import { initTheme } from "@/stores/theme";
import { routeTree } from "./routeTree.gen";
import "./styles/app.css";

initTheme();

const router = createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    scrollRestoration: true,
});

declare module "@tanstack/react-router" {
    interface Register {
        router: typeof router;
    }
}

setSessionExpiredHandler(() => {
    const { pathname, href } = router.state.location;
    if (pathname === "/login" || pathname === "/register") return;
    if (!queryClient.getQueryData(queryKeys.session)) return;
    queryClient.clear();
    void router.navigate({ to: "/login", search: { redirect: href } });
});

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");

createRoot(root).render(
    <StrictMode>
        <MotionConfig reducedMotion="user">
            <QueryClientProvider client={queryClient}>
                <RouterProvider router={router} />
            </QueryClientProvider>
        </MotionConfig>
    </StrictMode>,
);
