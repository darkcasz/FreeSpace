import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { readFile, writeFile, cp, mkdir } from 'node:fs/promises';
import { patchInstallUtility } from './nsis-patch.ts';
const require = createRequire(import.meta.url);
const builderRequire = createRequire(require.resolve('electron-builder/package.json'));
const root = dirname(builderRequire.resolve('app-builder-lib/package.json'));
const templates = join(root, 'templates', 'nsis');
const output = '.build-cache/nsis';
await mkdir(output, { recursive: true });
await cp(templates, output, { recursive: true });
const source = await readFile(join(templates, 'include/installUtil.nsh'), 'utf8');
const migration = await readFile('build/migrate-legacy.nsh', 'utf8');
// !include looks in its current compiler directory before its include path.
await writeFile(join(output, 'installUtil.nsh'), patchInstallUtility(source, migration));
