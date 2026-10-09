import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@jump-king/physics': path.resolve(__dirname, '../../packages/physics/src/index.ts'),
      '@jump-king/protocol': path.resolve(__dirname, '../../packages/protocol/src/index.ts'),
      '@jump-king/game-config': path.resolve(__dirname, '../../packages/game-config/src/index.ts'),
      '@jump-king/maps': path.resolve(__dirname, '../../packages/maps/src/index.ts')
    }
  },
  server: {
    port: 3000,
  },
});
