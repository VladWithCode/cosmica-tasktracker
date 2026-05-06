import { defineConfig } from "vitest/config";
import viteReact from "@vitejs/plugin-react";
import { resolve } from "node:path";

// Vitest-only config. The production build config lives in `vite.config.ts`
// and includes plugins (TanStack Router, Vite PWA, Tailwind) that should not
// run during unit tests. Keeping the test config separate lets the build
// pipeline and the test pipeline evolve independently.
export default defineConfig({
    plugins: [viteReact()],
    resolve: {
        alias: {
            "@": resolve(__dirname, "./src"),
        },
    },
    test: {
        environment: "jsdom",
        globals: false,
        include: ["src/**/*.test.{ts,tsx}"],
        css: false,
    },
});
