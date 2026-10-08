import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  // Three.js целиком больше 500 КБ — для стенда это ожидаемо.
  build: { chunkSizeWarningLimit: 1000 },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
