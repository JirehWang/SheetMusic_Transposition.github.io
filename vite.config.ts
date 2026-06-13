import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/SheetMusic_Transposition.github.io/',
  build: {
    rollupOptions: {
      input: resolve(__dirname, 'src/index.html'),
    },
  },
})
