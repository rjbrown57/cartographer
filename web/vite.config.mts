import { defineConfig } from 'vite';

// The React bundle lives under the already embedded /scripts/ tree.
export default defineConfig({
  build: {
    outDir: 'js/react',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        desktop: 'src/react/desktop.tsx',
        note: 'src/react/note.tsx',
        mobile: 'src/react/mobile.tsx',
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});
