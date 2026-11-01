import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  envDir: false,
  test: {
    environment: 'jsdom',
    include: ['integration/**/*.spec.tsx'],
    clearMocks: true,
    restoreMocks: true,
    testTimeout: 15_000,
    hookTimeout: 30_000,
  },
})
