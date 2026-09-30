// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  // Static output: no adapter, no server. See README → Deploy.
  output: 'static',

  // `site` is intentionally unset until the site has a real URL. Setting it to a
  // placeholder would emit wrong canonical URLs and sitemap entries, which is
  // worse than the missing-feature warning. Set it to the deployed origin (or
  // the custom domain once it exists) and add @astrojs/sitemap back at the same
  // time. Base.astro degrades gracefully while it is undefined.

  vite: {
    plugins: [tailwindcss()],
  },
});
