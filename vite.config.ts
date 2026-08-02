import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Honor a port assigned via the PORT env var (used by the preview harness's
  // autoPort); fall back to Vite's default when it isn't set.
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : undefined,
  },
})
