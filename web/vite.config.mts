import { defineConfig } from 'vite';

// The React bundle lives under the already embedded /scripts/ tree.
export default defineConfig({
  define: { 'process.env.IS_PREACT': JSON.stringify('true') },
  build: {
    outDir: 'js/react',
    emptyOutDir: true,
    cssCodeSplit: false,
    rollupOptions: {
      input: {
        desktop: 'src/react/desktop.tsx',
        note: 'src/react/note.tsx',
        mobile: 'src/react/mobile.tsx',
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: asset => asset.names.some(name => name.endsWith('.css')) ? 'assets/style.css' : 'assets/[name]-[hash][extname]',
      },
    },
  },
});
