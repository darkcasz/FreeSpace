import { lstat, opendir } from 'node:fs/promises';
import { basename, join } from 'node:path';
import type { Entry, Progress, Result } from './types.ts';

// Only folder nodes are retained; file memory is bounded to the largest 100.
export async function scanDirectory(rootPath: string, options: { cancelled?: () => boolean; progress?: (p: Progress) => void } = {}): Promise<Result> {
  const started = Date.now();
  const initial = await lstat(rootPath);
  if (!initial.isDirectory() || initial.isSymbolicLink()) throw new Error('Selecciona una carpeta o unidad válida.');
  const makeNode = (path: string): Entry => ({ name: basename(path) || path, path, size: 0, files: 0, folders: 0, children: [], directory: true });
  const root = makeNode(rootPath);
  const progress: Progress = { files: 0, folders: 0, bytes: 0, skipped: 0, current: rootPath };
  const largest: Entry[] = [];
  const stack: { node: Entry; parents: Entry[] }[] = [{ node: root, parents: [] }];
  let last = 0;
  while (stack.length && !options.cancelled?.()) {
    const { node, parents } = stack.pop()!;
    const ancestors = [...parents, node];
    progress.current = node.path;
    try {
      const dir = await opendir(node.path);
      for await (const item of dir) {
        if (options.cancelled?.()) break;
        const path = join(node.path, item.name);
        try {
          const stat = await lstat(path);
          if (stat.isSymbolicLink()) { progress.skipped++; continue; }
          if (stat.isDirectory()) {
            const child = makeNode(path);
            node.children.push(child);
            stack.push({ node: child, parents: ancestors });
            progress.folders++;
            for (const parent of ancestors) parent.folders++;
          } else if (stat.isFile()) {
            progress.files++; progress.bytes += stat.size;
            for (const parent of ancestors) { parent.size += stat.size; parent.files++; }
            if (largest.length < 100 || stat.size > largest[largest.length - 1].size) {
              largest.push({ name: item.name, path, size: stat.size, files: 1, folders: 0, children: [], directory: false });
              largest.sort((a, b) => b.size - a.size);
              if (largest.length > 100) largest.pop();
            }
          } else progress.skipped++;
        } catch { progress.skipped++; }
        if (Date.now() - last > 120) { options.progress?.({ ...progress }); last = Date.now(); }
      }
    } catch { progress.skipped++; }
  }
  return { root, largest, progress, elapsed: Date.now() - started, cancelled: !!options.cancelled?.() };
}
