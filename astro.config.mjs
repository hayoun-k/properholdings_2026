// @ts-check
import { defineConfig, passthroughImageService } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  vite: {
    build: {
      cssMinify: 'esbuild', // swap out lightningcss
    },
  },
  image: {
    service: passthroughImageService()
  },
});
