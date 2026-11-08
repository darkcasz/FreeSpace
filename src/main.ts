import { autoUpdater } from 'electron-updater';
import { Updates } from './updates.ts';
import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { statfs, access } from 'node:fs/promises';
import { join } from 'node:path';
import { Worker } from 'node:worker_threads';
import { runMaintenance, maintenanceScript } from './maintenance.ts';
import type { ScanEvent, Volume } from './types.ts';
let window: BrowserWindow | null = null;
let worker: Worker | null = null;
let cancelFlag: Int32Array | null = null;
const allowed = new Set<string>();
let maintenanceBusy = false;
let updates: Updates | null = null;
ipcMain.handle('update-state', () => updates?.snapshot() ?? { phase: 'disabled', currentVersion: app.getVersion(), message: 'No se pudo iniciar el actualizador. Puedes seguir usando FreeSpace.' });
ipcMain.handle('update-check', () => { if (!updates) throw new Error('El actualizador no está disponible. Reinicia FreeSpace.'); return updates.check(); });
ipcMain.handle('update-install', () => { if (!updates) throw new Error('El actualizador no está disponible.'); return updates.install(); });
ipcMain.handle('maintenance-available', () => process.platform === 'win32');
ipcMain.handle('maintenance', async (_event, action: unknown) => {
  maintenanceScript(action); // Validate before showing dialogs or invoking processes.
  if (process.platform !== 'win32') throw new Error('Disponible únicamente en Windows.');
  if (maintenanceBusy || worker || updates?.snapshot().phase === 'installing') throw new Error('Espera a que termine la operación en curso.');
  maintenanceBusy = true;
  try {
    if (action === 'clean-components') {
      const answer = await dialog.showMessageBox(window!, {
        type: 'question', title: 'Limpiar WinSxS',
        message: '¿Iniciar la limpieza de componentes de Windows?',
        detail: 'Windows eliminará versiones reemplazadas de componentes mediante DISM. La operación afecta al Windows de este equipo, independientemente de la unidad seleccionada. Puede tardar varios minutos. Se solicitarán permisos de administrador.',
        buttons: ['Cancelar', 'Limpiar WinSxS'], defaultId: 0, cancelId: 0
      });
      if (answer.response !== 1) return { status: 'cancelled', message: 'Limpieza cancelada.' };
    }
    return await runMaintenance(action);
  } finally { maintenanceBusy = false; }
});
async function volume(path: string): Promise<Volume | null> {
  try { await access(path); const s = await statfs(path); return { path, total: s.blocks * s.bsize, free: s.bfree * s.bsize, available: s.bavail * s.bsize }; } catch { return null; }
}
ipcMain.handle('volumes', async () => {
  const paths = process.platform === 'win32' ? Array.from({ length: 26 }, (_, i) => `${String.fromCharCode(65 + i)}:\\`) : ['/'];
  const found = (await Promise.all(paths.map(volume))).filter((v): v is Volume => !!v);
  for (const v of found) allowed.add(v.path);
  return found;
});
ipcMain.handle('choose', async () => {
  const choice = await dialog.showOpenDialog(window!, { properties: ['openDirectory'], title: 'Seleccionar carpeta para analizar' });
  const path = choice.canceled ? null : choice.filePaths[0];
  if (path) allowed.add(path);
  return path;
});
ipcMain.handle('cancel', () => { if (cancelFlag) Atomics.store(cancelFlag, 0, 1); });
ipcMain.handle('scan', (_event, path: unknown) => {
  if (worker || maintenanceBusy || updates?.snapshot().phase === 'installing') throw new Error('Hay una operación en curso.');
  if (typeof path !== 'string' || !allowed.has(path)) throw new Error('Selecciona primero una unidad o carpeta.');
  cancelFlag = new Int32Array(new SharedArrayBuffer(4));
  const active = new Worker(join(__dirname, 'worker.cjs'), { workerData: { path, flag: cancelFlag.buffer } });
  worker = active;
  let completed = false;
  const send = (event: ScanEvent) => { if (window && !window.isDestroyed()) window.webContents.send('scan-event', event); };
  const finish = () => { if (worker === active) { worker = null; cancelFlag = null; } };
  active.on('message', (event: ScanEvent) => {
    if (event.type !== 'progress') { completed = true; finish(); }
    send(event);
  });
  active.on('error', error => { completed = true; finish(); send({ type: 'error', message: error.message }); });
  active.on('exit', code => { finish(); if (!completed) send({ type: 'error', message: `El análisis terminó inesperadamente (${code}).` }); });
});
function createWindow() {
  window = new BrowserWindow({ width: 1320, height: 860, minWidth: 960, minHeight: 680, backgroundColor: '#0b1016', title: 'FreeSpace', webPreferences: { preload: join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true } });
  window.setMenuBarVisibility(false);
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  void window.loadFile(join(__dirname, 'index.html')).catch(error => {
    console.error('No se pudo cargar la interfaz', error);
    dialog.showErrorBox('FreeSpace no pudo abrirse', 'Vuelve a instalar FreeSpace para restaurar sus archivos. La aplicación se cerrará.');
    app.quit();
  });
  window.on('close', event => {
    if (maintenanceBusy) {
      event.preventDefault();
      void dialog.showMessageBox(window!, { type: 'info', message: 'El mantenimiento sigue en curso.', detail: 'Finaliza la operación en la ventana de Windows y vuelve a FreeSpace antes de cerrar.' });
    }
  });
  window.on('closed', () => { window = null; void worker?.terminate(); worker = null; cancelFlag = null; });
}
const primary = app.requestSingleInstanceLock();
if (!primary) app.quit();
else {
  app.on('second-instance', () => { if (!window || window.isDestroyed()) createWindow(); else { if (window.isMinimized()) window.restore(); window.show(); window.focus(); } });
  void app.whenReady().then(() => {
    createWindow();
    const enabled = app.isPackaged && process.platform === 'win32';
    try {
      updates = new Updates(autoUpdater, app.getVersion(), enabled,
        state => { if (window && !window.isDestroyed()) window.webContents.send('update-state', state); },
        () => !!worker || maintenanceBusy);
    } catch (error) {
      console.error('No se pudo iniciar el actualizador', error);
    }
    if (enabled && updates) {
      setTimeout(() => { void updates!.check(); }, 8000).unref();
      setInterval(() => { void updates!.check(); }, 4 * 60 * 60 * 1000).unref();
    }
  });
}
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (primary && !BrowserWindow.getAllWindows().length) createWindow(); });
