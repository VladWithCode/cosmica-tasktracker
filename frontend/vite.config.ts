import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const backendUrl = process.env.BACKEND_URL ?? "http://127.0.0.1:8080";

export default defineConfig({
    plugins: [
        tanstackRouter({ target: "react", autoCodeSplitting: true }),
        react(),
        tailwindcss(),
    ],
    resolve: {
        alias: { "@": resolve(__dirname, "./src") },
    },
    server: {
        host: true,
        proxy: {
            "/api": {
                target: backendUrl,
                changeOrigin: true,
                configure: (proxy) => {
                    proxy.on("proxyReq", (request) => request.removeHeader("origin"));
                },
            },
        },
    },
});
