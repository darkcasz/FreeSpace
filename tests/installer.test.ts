import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { patchInstallUtility } from '../scripts/nsis-patch.ts';
const require = createRequire(import.meta.url);
const builderRequire = createRequire(require.resolve('electron-builder/package.json'));
const source = readFileSync(join(dirname(builderRequire.resolve('app-builder-lib/package.json')), 'templates/nsis/include/installUtil.nsh'), 'utf8');
const migration = readFileSync(new URL('../build/migrate-legacy.nsh', import.meta.url), 'utf8');
test('la recuperación se aplica antes de ejecutar el desinstalador anterior', () => {
  const patched = patchInstallUtility(source, migration);
  const body = patched.slice(patched.indexOf('Function uninstallOldVersion\n'));
  assert.ok(body.indexOf(migration) < body.indexOf('  UninstallLoop:'));
  assert.ok(body.indexOf(migration) > body.indexOf('StrCpy $uninstallerFileNameTemp'));
  assert.equal(patched.split(migration).length, 2);
  assert.ok(patched.startsWith(source.slice(0, source.indexOf('Function uninstallOldVersion\n'))));
});
test('una plantilla incompatible detiene la compilación en vez de omitir silenciosamente la reparación', () => {
  assert.throws(() => patchInstallUtility(source.replace('Function uninstallOldVersion\n', 'Function renamed\n'), migration), /plantilla/);
  assert.throws(() => patchInstallUtility(source + '  # Retry counter\n  StrCpy $R5 0\n', migration), /plantilla/);
  assert.throws(() => patchInstallUtility(source.replace('$(appCannotBeClosed)', 'changed'), migration), /diagnóstico/);
});
