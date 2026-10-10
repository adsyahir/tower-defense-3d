/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // For GitHub Pages set base to '/<repo-name>/' (and keep PWA scope/start_url in sync).
  base: '/',
  // three.js + GLTFLoader + gsap + howler is ~810 kB minified (~220 kB gzipped); that's expected.
  build: { chunkSizeWarningLimit: 900 },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png', 'icons/*.svg'],
      manifest: {
        name: 'Tower Defense',
        short_name: 'Tower Defense',
        description: 'A 3D tower defense game that runs in your browser.',
        display: 'fullscreen',
        orientation: 'landscape',
        background_color: '#1b2430',
        theme_color: '#1b2430',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,glb,wav,webm,mp3}'],
        maximumFileSizeToCacheInBytes: 5_000_000,
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
