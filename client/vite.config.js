import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves 404.html for unknown paths; copying index.html there lets deep links
// such as /<repo>/sales/12 load the app, which then routes on the client.
function spaFallback() {
  let outDir = 'dist';
  return {
    name: 'spa-fallback-404',
    apply: 'build',
    configResolved(config) { outDir = config.build.outDir; },
    closeBundle() {
      const index = path.resolve(outDir, 'index.html');
      if (fs.existsSync(index)) fs.copyFileSync(index, path.resolve(outDir, '404.html'));
    }
  };
}

export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [react(), spaFallback()],
  server: {
    host: true,
    port: 5180,
    proxy: {
      '/api': 'http://localhost:5006'
    }
  }
});
