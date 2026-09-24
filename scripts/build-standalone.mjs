// Package the SAME game and simulation as the hosted build, with no server,
// external resources or file:// worker imports. Normal Vite builds keep their
// split workers; this build alone requests Vite's bundled Blob workers.
import {build} from 'vite';
import {mkdir, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {standaloneHTML} from './standalone-html.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const workers = new Set();
const built = await build({
  configFile: false, root, base: './', publicDir: false,
  plugins: [{
    name: 'frontlines-offline-packaging', enforce: 'pre',
    transformIndexHtml: {
      order: 'pre',
      handler: html => html
        .replace(/<script data-file-launch>[\s\S]*?<\/script>/, '')
        .replace(/<script type="module" data-source-entry>[\s\S]*?<\/script>/,
          '<script type="module" src="./src/main.ts"></script>'),
    },
    transform(code, id) {
      if (!id.startsWith(root.replaceAll('\\', '/')) || !id.endsWith('.ts')) return;
      const imports = [];
      const rewritten = code.replace(/new Worker\(new URL\('([^']+)',\s*import\.meta\.url\),\s*\{type:'module'\}\)/g,
        (_, source) => {
          const name = `FrontlinesOfflineWorker${imports.length}`;
          imports.push(`import ${name} from '${source}?worker&inline';`);
          workers.add(source);
          return `new ${name}()`;
        });
      return imports.length ? imports.join('\n') + '\n' + rewritten : undefined;
    },
  }],
  build: {
    write: false, target: 'es2022', cssCodeSplit: false, modulePreload: false,
    assetsInlineLimit: Infinity,
    rollupOptions: {output: {inlineDynamicImports: true}},
  },
});

if (Array.isArray(built) || !('output' in built)) throw Error('Expected one portable bundle.');
const chunks = built.output.filter(file => file.type === 'chunk');
if (chunks.length !== 1 || chunks[0].imports.length || chunks[0].dynamicImports.length)
  throw Error('Offline build must contain exactly one self-contained script.');
const template = built.output.find(file => file.fileName === 'index.html');
const styles = built.output.filter(file => file.fileName.endsWith('.css'));
const unexpected = built.output.filter(file => file !== template && !chunks.includes(file) && !styles.includes(file));
if (!template || unexpected.length) throw Error(`Unbundled offline assets: ${unexpected.map(file => file.fileName).join(', ')}`);
for (const worker of ['./NavigationWorker.ts', './GroundWorker.ts'])
  if (!workers.has(worker)) throw Error(`Missing offline worker: ${worker}`);

// Fail closed rather than distribute a menu which hides a missing worker/asset.
const html = standaloneHTML(String(template.source), chunks[0].code,
  styles.map(file => String(file.source)).join('\n'));

await mkdir(join(root, 'dist'), {recursive: true});
for (const target of [join(root, 'FRONTLINES.html'), join(root, 'dist', 'FRONTLINES.html')])
  await writeFile(target, html);
console.log(`Offline game: FRONTLINES.html (${(Buffer.byteLength(html) / 1024).toFixed(0)} KiB, ${workers.size} embedded workers).`);
