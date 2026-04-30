import { defineConfig } from 'vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'node:path'

const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:8080'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        tanstackRouter({ autoCodeSplitting: true }),
        viteReact(),
        VitePWA({
            srcDir: 'src/notifications',
            filename: 'notif_sw.ts',
            strategies: 'injectManifest',
            injectRegister: 'auto',
            devOptions: {
                enabled: true,
                type: 'module',
            },
            manifest: {
                name: 'Cosmica Task Tracker',
                short_name: 'Cosmica',
                description: 'Task your tracks',
                theme_color: '#ffffff',
                icons: [
                    {
                        src: '/icon-192x192.png',
                        sizes: '192x192',
                        type: 'image/png'
                    },
                    {
                        src: '/icon-512x512.png',
                        sizes: '512x512',
                        type: 'image/png'
                    }
                ],
            },
        }),
        tailwindcss(),
    ],
    resolve: {
        alias: {
            '@': resolve(__dirname, './src'),
        },
    },
    server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
            '/api': backendUrl,
        },
    },
    envDir: resolve(__dirname, '..'),
})
