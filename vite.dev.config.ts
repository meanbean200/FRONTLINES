import {defineConfig} from 'vite';
import {devContentPlugin} from './scripts/dev-content-plugin';
import {presetContentPlugin} from './scripts/preset-content.mjs';
export default defineConfig({base:'./',plugins:[devContentPlugin(),presetContentPlugin()],server:{host:'127.0.0.1',port:4176},build:{target:'es2022',outDir:'dist-dev',rollupOptions:{input:'dev.html'}}});
