import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['rhino3dm']
  },
  build: {
    rollupOptions: {
      external: ['ws']
    }
  }
})
