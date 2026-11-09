import type { UpdateState } from './types.ts';

export interface UpdaterPort {
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  allowPrerelease: boolean;
  allowDowngrade: boolean;
  on(event: string, listener: (...args: any[]) => void): unknown;
  checkForUpdates(): Promise<unknown>;
  quitAndInstall(silent?: boolean, forceRunAfter?: boolean): void;
}
export class Updates {
  private state: UpdateState;
  private checking = false;
  private updater: UpdaterPort;
  private available: boolean;
  private publish: (state: UpdateState) => void;
  private busy: () => boolean;
  constructor(updater: UpdaterPort, version: string, available: boolean,
    publish: (state: UpdateState) => void, busy: () => boolean) {
    this.updater = updater; this.available = available; this.publish = publish; this.busy = busy;
    this.state = { phase: available ? 'idle' : 'disabled', currentVersion: version,
      message: available ? 'Las actualizaciones se buscan y descargan automáticamente.' : 'Las actualizaciones están disponibles en la versión instalada para Windows.' };
    updater.autoDownload = true;
    updater.autoInstallOnAppQuit = true;
    updater.allowPrerelease = false;
    updater.allowDowngrade = false;
    updater.on('checking-for-update', () => this.set({ phase: 'checking', message: 'Buscando actualizaciones…' }));
    updater.on('update-available', (info: { version: string }) => this.set({ phase: 'downloading', version: info.version, percent: 0, message: `Descargando CertaFreeSpace ${info.version}…` }));
    updater.on('download-progress', (progress: { percent: number }) => {
      const percent = Math.min(100, Math.max(0, Math.round(progress.percent)));
      this.set({ phase: 'downloading', percent, message: `Descargando actualización… ${percent}%` });
    });
    updater.on('update-not-available', () => this.set({ phase: 'idle', version: undefined, percent: undefined, message: 'Tienes la versión más reciente.' }));
    updater.on('update-downloaded', (info: { version: string }) => this.set({ phase: 'ready', version: info.version, percent: 100,
      message: `CertaFreeSpace ${info.version} está listo. Se instalará al cerrar la aplicación o al pulsar Reiniciar e instalar.` }));
    updater.on('error', () => this.failed());
  }
  snapshot(): UpdateState { return { ...this.state }; }
  private set(change: Partial<UpdateState>) { this.state = { ...this.state, ...change }; this.publish(this.snapshot()); }
  private failed() {
    // Keep a verified downloaded update available if a later network request fails.
    if (this.state.phase !== 'ready') this.set({ phase: 'error', message: 'No se pudo buscar, descargar o instalar la actualización. Comprueba tu conexión y vuelve a intentarlo.' });
  }
  async check(): Promise<UpdateState> {
    if (!this.available || this.checking || ['downloading', 'ready', 'installing'].includes(this.state.phase)) return this.snapshot();
    this.checking = true;
    this.set({ phase: 'checking', message: 'Buscando actualizaciones…' });
    try { await this.updater.checkForUpdates(); } catch { this.failed(); }
    finally { this.checking = false; }
    return this.snapshot();
  }
  install(): UpdateState {
    if (this.state.phase !== 'ready') throw new Error('Todavía no hay una actualización lista para instalar.');
    if (this.busy()) throw new Error('Espera a que termine el análisis o el mantenimiento antes de instalar.');
    this.set({ phase: 'installing', message: 'Cerrando CertaFreeSpace para instalar la actualización…' });
    setImmediate(() => {
      try { this.updater.quitAndInstall(true, true); } catch { this.failed(); }
    });
    return this.snapshot();
  }
}
