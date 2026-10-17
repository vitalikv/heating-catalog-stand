import { defineConfig } from 'vite';

// Сборка пакета библиотеки (`npm run build:lib`), отдельно от сборки стенда.
// Three.js — внешняя зависимость вместе с подмодулями: одного peerDependencies
// мало, чтобы `three/examples/jsm/...` не попал в пакет.
export default defineConfig({
  publicDir: false,
  build: {
    outDir: 'dist-lib/package',
    emptyOutDir: true,
    target: 'es2022',
    minify: false,
    sourcemap: true,
    lib: {
      entry: 'src/lib/index.ts',
      formats: ['es'],
      fileName: () => 'index.js',
    },
    rolldownOptions: {
      external: [/^three(\/.*)?$/],
    },
  },
});
