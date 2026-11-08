import { contextBridge, ipcRenderer } from 'electron';
import type { API, ScanEvent, UpdateState } from './types.ts';
const api: API = {
  updateState: () => ipcRenderer.invoke('update-state'),
  checkUpdates: () => ipcRenderer.invoke('update-check'),
  installUpdate: () => ipcRenderer.invoke('update-install'),
  onUpdate: callback => {
    const listener = (_event: Electron.IpcRendererEvent, state: UpdateState) => callback(state);
    ipcRenderer.on('update-state', listener);
    return () => ipcRenderer.removeListener('update-state', listener);
  },
  maintenanceAvailable: () => ipcRenderer.invoke('maintenance-available'),
  maintenance: action => ipcRenderer.invoke('maintenance', action),
  volumes: () => ipcRenderer.invoke('volumes'), choose: () => ipcRenderer.invoke('choose'),
  scan: path => ipcRenderer.invoke('scan', path), cancel: () => ipcRenderer.invoke('cancel'),
  onEvent: callback => {
    const listener = (_event: Electron.IpcRendererEvent, data: ScanEvent) => callback(data);
    ipcRenderer.on('scan-event', listener);
    return () => ipcRenderer.removeListener('scan-event', listener);
  }
};
contextBridge.exposeInMainWorld('freeSpace', api);
