import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { Updates } from '../src/updates.ts';
class FakeUpdater extends EventEmitter {
  autoDownload = false; autoInstallOnAppQuit = false; allowPrerelease = true; allowDowngrade = true;
  checks = 0; installs = 0;
  checkForUpdates: () => Promise<unknown> = async () => { this.checks++; this.emit('update-not-available'); };
  quitAndInstall() { this.installs++; }
}
test('activa descarga e instalación al cerrar y excluye versiones previas y preliminares', async () => {
  const port = new FakeUpdater(); const updates = new Updates(port, '0.3.0', true, () => {}, () => false);
  assert.equal(port.autoDownload, true); assert.equal(port.autoInstallOnAppQuit, true);
  assert.equal(port.allowDowngrade, false); assert.equal(port.allowPrerelease, false);
  await updates.check(); assert.equal(updates.snapshot().phase, 'idle');
});
test('no comprueba fuera de una instalación Windows ni duplica búsquedas concurrentes', async () => {
  const disabled = new FakeUpdater(); await new Updates(disabled, '0.3.0', false, () => {}, () => false).check();
  assert.equal(disabled.checks, 0);
  const port = new FakeUpdater(); let finish!: () => void;
  port.checkForUpdates = () => { port.checks++; return new Promise<void>(resolve => { finish = resolve; }); };
  const updates = new Updates(port, '0.3.0', true, () => {}, () => false);
  const first = updates.check(); await updates.check(); assert.equal(port.checks, 1); finish(); await first;
});
test('descarga, conserva el estado listo y bloquea instalar durante mantenimiento o escaneo', async () => {
  const port = new FakeUpdater(); let busy = true;
  const updates = new Updates(port, '0.3.0', true, () => {}, () => busy);
  port.emit('update-available', { version: '0.4.0' }); port.emit('download-progress', { percent: 54.5 });
  assert.equal(updates.snapshot().percent, 55);
  port.emit('update-downloaded', { version: '0.4.0' });
  await updates.check(); assert.equal(port.checks, 0); assert.equal(updates.snapshot().phase, 'ready');
  port.emit('error', Error('network')); assert.equal(updates.snapshot().phase, 'ready');
  assert.throws(() => updates.install(), /termine/); assert.equal(port.installs, 0);
  busy = false; updates.install(); assert.equal(updates.snapshot().phase, 'installing');
  assert.throws(() => updates.install(), /no hay/);
  await new Promise<void>(resolve => setImmediate(resolve)); assert.equal(port.installs, 1);
});
test('un error de red no se presenta como versión actualizada y permite reintentar', async () => {
  const port = new FakeUpdater(); port.checkForUpdates = async () => { throw Error('network'); };
  const updates = new Updates(port, '0.3.0', true, () => {}, () => false);
  await updates.check(); assert.equal(updates.snapshot().phase, 'error');
  port.checkForUpdates = async () => { port.emit('update-not-available'); };
  await updates.check(); assert.equal(updates.snapshot().phase, 'idle');
});
