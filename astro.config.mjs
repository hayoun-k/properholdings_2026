// @ts-check
import { defineConfig, passthroughImageService } from 'astro/config';

import cloudflare from '@astrojs/cloudflare';

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

  adapter: cloudflare(),
});