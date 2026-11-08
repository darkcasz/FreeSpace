export interface Entry { name: string; path: string; size: number; files: number; folders: number; children: Entry[]; directory: boolean }
export interface Progress { files: number; folders: number; bytes: number; skipped: number; current: string }
export interface Result { root: Entry; largest: Entry[]; progress: Progress; elapsed: number; cancelled: boolean }
export interface Volume { path: string; total: number; free: number; available: number }
export type ScanEvent = { type: 'progress'; data: Progress } | { type: 'done'; data: Result } | { type: 'error'; message: string };
export type MaintenanceAction = 'analyze-components' | 'clean-components' | 'clean-temporary';
export interface MaintenanceResult { status: 'completed' | 'cancelled' | 'error'; message: string }
export interface UpdateState {
  phase: 'disabled' | 'idle' | 'checking' | 'downloading' | 'ready' | 'installing' | 'error';
  currentVersion: string; message: string; version?: string; percent?: number;
}
export interface API {
  updateState(): Promise<UpdateState>;
  checkUpdates(): Promise<UpdateState>;
  installUpdate(): Promise<UpdateState>;
  onUpdate(callback: (state: UpdateState) => void): () => void;
  maintenanceAvailable(): Promise<boolean>;
  maintenance(action: MaintenanceAction): Promise<MaintenanceResult>;
  volumes(): Promise<Volume[]>;
  choose(): Promise<string | null>;
  scan(path: string): Promise<void>;
  cancel(): Promise<void>;
  onEvent(callback: (event: ScanEvent) => void): () => void;
}
declare global { interface Window { freeSpace: API } }
