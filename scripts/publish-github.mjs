import { readFileSync, existsSync, cpSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const { owner, repo } = pkg.build.publish[0];
const repository = `${owner}/${repo}`;
const filename = `FreeSpace-${pkg.version}-Windows-x64-Setup.exe`;
const files = [`release/${filename}`, 'release/latest.yml'];
if (pkg.build.nsis.differentialPackage !== false) files.splice(1, 0, `release/${filename}.blockmap`);
for (const file of files) if (!existsSync(file)) throw Error(`Falta ${file}. Genera el instalador antes de publicar.`);
const yaml = readFileSync('release/latest.yml', 'utf8');
const checksum = createHash('sha512').update(readFileSync(files[0])).digest('base64');
if (!yaml.includes(`version: ${pkg.version}\n`) || !yaml.includes(filename) || !yaml.includes(checksum)) {
  throw Error('Los metadatos no corresponden al instalador. No se publicará una versión incompleta.');
}
const gh = (...args) => execFileSync('gh', args, { stdio: 'inherit' });
const tag = `v${pkg.version}`;
if (process.argv.includes('--bootstrap')) {
  // Bootstrap is explicit and only creates a new public repository; never changes visibility.
  let existing;
  try { existing = JSON.parse(execFileSync('gh', ['repo', 'view', repository, '--json', 'isPrivate'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })); }
  catch {
    gh('auth', 'status');
    gh('repo', 'create', repository, '--public', '--description', 'Analizador de espacio en disco y mantenimiento de Windows');
  }
  if (existing?.isPrivate) throw Error('El repositorio es privado. No se cambiará su visibilidad; el actualizador necesita un repositorio público.');
  const snapshot = mkdtempSync(join(tmpdir(), 'freespace-publish-'));
  for (const file of ['src', 'tests', 'scripts', 'build', 'package.json', 'tsconfig.json', '.gitignore', 'README.md', 'RELEASE_NOTES.md']) {
    cpSync(file, join(snapshot, file), { recursive: true });
  }
  const git = (...args) => execFileSync('git', args, { cwd: snapshot, stdio: 'inherit' });
  git('init', '-b', 'main');
  git('add', '.');
  git('-c', 'user.name=FreeSpace', '-c', `user.email=${owner}@users.noreply.github.com`, 'commit', '-m', `FreeSpace ${pkg.version}: actualizaciones automáticas`);
  git('remote', 'add', 'origin', `https://github.com/${repository}.git`);
  git('-c', 'credential.helper=!gh auth git-credential', 'push', 'origin', 'main');
  console.log(`Copia Git de publicación: ${snapshot}`);
}
if (process.argv.includes('--sync-source')) {
  const snapshot = mkdtempSync(join(tmpdir(), 'freespace-publish-'));
  const git = (...args) => execFileSync('git', args, { cwd: snapshot, stdio: 'inherit' });
  git('-c', 'credential.helper=!gh auth git-credential', 'clone', '--depth', '1', `https://github.com/${repository}.git`, '.');
  for (const file of ['src', 'tests', 'scripts', 'build', 'package.json', 'tsconfig.json', '.gitignore', 'README.md', 'RELEASE_NOTES.md']) {
    cpSync(file, join(snapshot, file), { recursive: true });
  }
  git('add', '.');
  git('-c', 'user.name=FreeSpace', '-c', `user.email=${owner}@users.noreply.github.com`, 'commit', '-m', `FreeSpace ${pkg.version}: corregir instalación y desinstalación`);
  git('-c', 'credential.helper=!gh auth git-credential', 'push', 'origin', 'main');
  console.log(`Código fuente sincronizado en ${snapshot}`);
}
// Create a draft first: clients never see latest.yml without the matching installer.
gh('release', 'create', tag, '--repo', repository, '--target', 'main', '--draft', '--title', `FreeSpace ${pkg.version}`, '--notes-file', 'RELEASE_NOTES.md');
gh('release', 'upload', tag, '--repo', repository, ...files);
gh('release', 'edit', tag, '--repo', repository, '--draft=false', '--latest');
console.log(`Publicado: https://github.com/${repository}/releases/tag/${tag}`);
