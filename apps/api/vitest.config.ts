import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/modules/**/*.spec.ts'],
    clearMocks: true,
  },
});
