import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scanDirectory } from '../src/scanner.ts';

test('agrega tamaños, conserva carpetas vacías y omite enlaces sin seguir ciclos', async () => {
  const root = await mkdtemp(join(tmpdir(), 'freespace-'));
  try {
    await mkdir(join(root, 'nested')); await mkdir(join(root, 'empty'));
    await writeFile(join(root, 'a'), Buffer.alloc(11)); await writeFile(join(root, 'nested', 'b'), Buffer.alloc(23));
    await symlink(root, join(root, 'nested', 'loop'), process.platform === 'win32' ? 'junction' : 'dir');
    const result = await scanDirectory(root);
    assert.equal(result.root.size, 34); assert.equal(result.root.files, 2); assert.equal(result.root.folders, 2);
    assert.equal(result.progress.skipped, 1); assert.equal(result.largest[0].size, 23);
    assert.equal(result.root.children.find(c => c.name === 'nested')?.size, 23);
    assert.equal(result.root.children.find(c => c.name === 'empty')?.size, 0);
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('limita los archivos más grandes a 100 y permite cancelar', async () => {
  const root = await mkdtemp(join(tmpdir(), 'freespace-'));
  try {
    for (let i = 0; i < 110; i++) await writeFile(join(root, String(i)), Buffer.alloc(i));
    const result = await scanDirectory(root);
    assert.equal(result.largest.length, 100); assert.equal(result.largest[0].size, 109); assert.equal(result.largest[99].size, 10);
    const cancelled = await scanDirectory(root, { cancelled: () => true });
    assert.equal(cancelled.cancelled, true); assert.equal(cancelled.progress.files, 0);
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('rechaza un destino inexistente', async () => {
  await assert.rejects(scanDirectory(join(tmpdir(), 'freespace-missing', 'not-there')));
});
