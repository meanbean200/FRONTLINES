import { defineConfig } from 'vite';
import {presetContentPlugin} from './scripts/preset-content.mjs';

export default defineConfig({
  base: './',
  plugins: [presetContentPlugin(),{
    name: 'file-safe-entry', apply: 'build',
    // Do not fetch an external module under file:// while the disk-launch
    // redirect runs. HTTP still uses the normal split/cached production bundle.
    transformIndexHtml: {
      order: 'post',
      handler: html => html.replace(/<script type="module" crossorigin src="([^"]+)"><\/script>/g,
        (_, src) => `<script type="module">if(location.protocol!=='file:') import(${JSON.stringify(src)});</script>`),
    },
  }],
  server: { host: '127.0.0.1', port: 4173 },
  preview: { host: '127.0.0.1', port: 4173 },
  build: { target: 'es2022' },
});
