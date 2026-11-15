import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // The linked workspace package emits CommonJS and needs conversion for dev ESM imports.
  optimizeDeps: { include: ['@parcelflow/types'] },
})
