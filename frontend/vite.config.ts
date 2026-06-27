import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
      '/status': 'http://localhost:8000',
      '/start_bot': 'http://localhost:8000',
      '/stop_bot': 'http://localhost:8000',
      '/logs': 'http://localhost:8000',
      '/save_config': 'http://localhost:8000',
      '/settings': 'http://localhost:8000',
      '/reset_stats': 'http://localhost:8000',
      '/stats': 'http://localhost:8000',
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
