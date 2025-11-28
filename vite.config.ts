import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: true
  },
  define: {
    // Polyfill process.env for the Google GenAI SDK usage in the code
    'process.env': process.env
  },
  server: {
    port: 3000
  }
});