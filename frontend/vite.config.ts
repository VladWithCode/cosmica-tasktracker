import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const backendUrl = process.env.BACKEND_URL ?? "http://127.0.0.1:8080";

export default defineConfig({
    plugins: [
        tanstackRouter({ target: "react", autoCodeSplitting: true }),
        react(),
        tailwindcss(),
        VitePWA({
            strategies: "injectManifest",
            srcDir: "src/sw",
            filename: "service-worker.ts",
            registerType: "autoUpdate",
            injectRegister: "auto",
            devOptions: { enabled: true, type: "module" },
            injectManifest: { globPatterns: ["**/*.{js,css,html,svg,png,ico}"] },
            includeAssets: ["icon.svg", "apple-touch-icon.png", "badge-72x72.png"],
            manifest: {
                name: "Cosmica",
                short_name: "Cosmica",
                description: "Tus tareas y rutinas de cada día.",
                lang: "es",
                start_url: "/",
                scope: "/",
                display: "standalone",
                background_color: "#f2f2f7",
                theme_color: "#f2f2f7",
                icons: [
                    { src: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
                    { src: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
                    { src: "/icon-maskable-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
                ],
            },
        }),
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
