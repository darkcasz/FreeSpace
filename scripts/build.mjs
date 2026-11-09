import { build } from 'esbuild';
import { mkdir, copyFile, cp } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
for (const name of ['main', 'preload', 'worker']) {
  await build({ entryPoints: [`src/${name}.ts`], outfile: `dist/${name}.cjs`, bundle: true, platform: 'node', format: 'cjs', external: ['electron'] });
}
await build({ entryPoints: ['src/renderer.ts'], outfile: 'dist/renderer.js', bundle: true, platform: 'browser', target: 'chrome120' });
for (const name of ['index.html', 'styles.css']) await copyFile(`src/${name}`, `dist/${name}`);

await cp('src/assets', 'dist/assets', { recursive: true });
await import('./prepare-nsis.mjs');
