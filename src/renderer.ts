import type { Entry, Result, Volume, MaintenanceAction, UpdateState } from './types.ts';
const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const format = (value: number) => { const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']; let i = 0; while (value >= 1024 && i < units.length - 1) { value /= 1024; i++; } return `${value.toLocaleString('es-MX', { maximumFractionDigits: i ? 1 : 0 })} ${units[i]}`; };
const number = (n: number) => n.toLocaleString('es-MX');
let volumes: Volume[] = [], result: Result | null = null, current: Entry | null = null, trail: Entry[] = [], mode = 'folders', busy = false;
const select = el<HTMLSelectElement>('volumes');
let maintenanceBusy = false, maintenanceAvailable = false;
const maintenanceActions: MaintenanceAction[] = ['analyze-components', 'clean-components', 'clean-temporary'];
let update: UpdateState | null = null;
function maintenanceControls() {
  for (const action of maintenanceActions) el<HTMLButtonElement>(action).disabled = !maintenanceAvailable || maintenanceBusy || busy || update?.phase === 'installing';
}
for (const action of maintenanceActions) el(action).onclick = async () => {
  if (busy || maintenanceBusy) return;
  maintenanceBusy = true; setBusy(false);
  el('maintenance-status').dataset.state = '';
  text('maintenance-status', action === 'clean-temporary'
    ? 'Abriendo el Liberador de espacio. Selecciona las categorías y confirma la eliminación en la ventana de Windows; cierra esa ventana para volver.'
    : 'Esperando la autorización y el mantenimiento de Windows. No cierres la ventana durante DISM. Al terminar, presiona Entrar en esa ventana para volver a FreeSpace.');
  try {
    const response = await window.freeSpace.maintenance(action);
    el('maintenance-status').dataset.state = response.status;
    text('maintenance-status', response.message);
    if (response.status === 'completed') {
      try { volumes = await window.freeSpace.volumes(); capacity(); }
      catch { text('maintenance-status', response.message + ' No se pudo actualizar la capacidad; vuelve a analizar la unidad.'); }
      if (action !== 'analyze-components' && result) text('status', 'Los resultados son anteriores a la limpieza. Vuelve a analizar para actualizarlos.');
    }
  } catch (e) {
    el('maintenance-status').dataset.state = 'error';
    text('maintenance-status', e instanceof Error ? e.message : String(e));
  } finally { maintenanceBusy = false; setBusy(false); }
};
function text(id: string, value: string) { el(id).textContent = value; }
function error(error: unknown) { text('status', error instanceof Error ? error.message : String(error)); }
function setBusy(value: boolean) {
  busy = value; document.body.classList.toggle('busy', value);
  el<HTMLButtonElement>('scan').disabled = value || maintenanceBusy || !select.value;
  el<HTMLButtonElement>('choose').disabled = value || maintenanceBusy; select.disabled = value || maintenanceBusy; el('cancel').hidden = !value; maintenanceControls(); renderUpdate();
}
function capacity() {
  const path = select.value;
  const volume = [...volumes].sort((a, b) => b.path.length - a.path.length).find(v => path.toLowerCase().startsWith(v.path.toLowerCase()));
  text('total', volume ? format(volume.total) : '—'); text('used', volume ? format(volume.total - volume.free) : '—'); text('free', volume ? format(volume.available) : '—');
  el('capacity-bar').style.width = `${volume?.total ? (1 - volume.free / volume.total) * 100 : 0}%`;
}
function render() {
  const rows = el('rows'); rows.replaceChildren();
  const crumbs = el('breadcrumbs'); crumbs.replaceChildren();
  if (!result || !current) return;
  for (const [i, entry] of trail.entries()) {
    if (i) crumbs.append(document.createTextNode(' / '));
    const button = document.createElement('button'); button.textContent = entry.name; button.title = entry.path;
    button.onclick = () => { trail = trail.slice(0, i + 1); current = entry; render(); }; crumbs.append(button);
  }
  const query = el<HTMLInputElement>('search').value.toLowerCase();
  const entries = (mode === 'folders' ? current.children : result.largest).filter(e => e.name.toLowerCase().includes(query)).slice().sort((a, b) => b.size - a.size);
  for (const entry of entries) {
    const row = document.createElement('div'); row.className = `row ${entry.directory ? 'folder' : ''}`;
    const name = document.createElement('div'); name.className = 'name'; name.title = entry.path;
    const icon = document.createElement('span'); icon.className = 'icon'; icon.textContent = entry.directory ? '▰' : '▫'; name.append(icon, document.createTextNode(entry.name));
    if (mode === 'files') { const path = document.createElement('span'); path.className = 'path'; path.textContent = entry.path; name.append(path); }
    const bar = document.createElement('div'); bar.className = 'bar'; const fill = document.createElement('div'); fill.className = 'bar-fill'; fill.style.width = `${current.size ? Math.min(100, entry.size / current.size * 100) : 0}%`; bar.append(fill);
    const size = document.createElement('div'); size.className = 'size'; size.textContent = format(entry.size);
    const count = document.createElement('div'); count.className = 'count'; count.textContent = number(entry.files);
    row.append(name, bar, size, count);
    if (entry.directory) {
      row.tabIndex = 0; row.setAttribute('role', 'button'); row.setAttribute('aria-label', `Abrir ${entry.name}`);
      const open = () => { current = entry; trail.push(entry); render(); }; row.onclick = open; row.onkeydown = event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } };
    }
    rows.append(row);
  }
  if (!entries.length) { const empty = document.createElement('div'); empty.className = 'empty'; empty.textContent = query ? 'No hay coincidencias.' : 'No hay subcarpetas. Consulta Archivos grandes para ver los archivos de mayor tamaño del análisis.'; rows.append(empty); }
  text('summary', `${number(result.progress.files)} archivos · ${number(result.progress.folders)} carpetas · ${format(result.progress.bytes)} analizados`);
}
el('choose').onclick = async () => { try { const path = await window.freeSpace.choose(); if (path) { if (![...select.options].some(o => o.value === path)) select.add(new Option(path, path)); select.value = path; capacity(); setBusy(false); } } catch (e) { error(e); } };
select.onchange = () => { capacity(); text('status', 'Listo para analizar la selección'); };
el('scan').onclick = async () => {
  setBusy(true); text('status', 'Analizando…'); text('progress', 'Preparando el análisis de archivos y carpetas.'); text('current', select.value);
  result = null; current = null; trail = []; el('rows').replaceChildren(); text('breadcrumbs', select.value); text('summary', 'Análisis en curso');
  try { await window.freeSpace.scan(select.value); } catch (e) { setBusy(false); error(e); }
};
el('cancel').onclick = async () => { try { await window.freeSpace.cancel(); text('status', 'Cancelando…'); } catch (e) { error(e); } };
el('folders-tab').onclick = () => { mode = 'folders'; el('folders-tab').classList.add('selected'); el('files-tab').classList.remove('selected'); render(); };
el('files-tab').onclick = () => { mode = 'files'; el('files-tab').classList.add('selected'); el('folders-tab').classList.remove('selected'); render(); };
el('search').oninput = render;
window.freeSpace.onEvent(event => {
  if (event.type === 'error') { setBusy(false); text('status', event.message); return; }
  const p = event.type === 'progress' ? event.data : event.data.progress;
  text('progress', `${number(p.files)} archivos · ${number(p.folders)} carpetas · ${format(p.bytes)} · ${number(p.skipped)} omitidos`); text('current', p.current);
  if (event.type === 'done') {
    result = event.data; current = result.root; trail = [current]; setBusy(false);
    text('status', `${result.cancelled ? 'Análisis cancelado · resultados parciales' : 'Análisis completado'} · ${(result.elapsed / 1000).toFixed(1)} s`); render();
    void window.freeSpace.volumes().then(data => { volumes = data; capacity(); }).catch(() => {});
  }
});
function renderUpdate() {
  if (!update) return;
  text('app-version', update.currentVersion);
  text('update-status', update.message);
  el('update-status').closest('section')!.dataset.state = update.phase;
  el<HTMLButtonElement>('update-check').disabled = ['disabled', 'checking', 'downloading', 'ready', 'installing'].includes(update.phase);
  el('update-install').hidden = !['ready', 'installing'].includes(update.phase);
  el<HTMLButtonElement>('update-install').disabled = busy || maintenanceBusy || update.phase !== 'ready';
}
window.freeSpace.onUpdate(state => { update = state; renderUpdate(); });
el('update-check').onclick = async () => {
  try { update = await window.freeSpace.checkUpdates(); renderUpdate(); }
  catch (e) { text('update-status', e instanceof Error ? e.message : String(e)); }
};
el('update-install').onclick = async () => {
  try { update = await window.freeSpace.installUpdate(); renderUpdate(); }
  catch (e) { text('update-status', e instanceof Error ? e.message : String(e)); }
};
async function init() {
  try {
    update = await window.freeSpace.updateState(); renderUpdate();
    maintenanceAvailable = await window.freeSpace.maintenanceAvailable();
    maintenanceControls();
    text('maintenance-status', maintenanceAvailable ? 'Listo. Analiza WinSxS antes de decidir si deseas limpiarlo.' : 'El mantenimiento está disponible únicamente en Windows.');
    volumes = await window.freeSpace.volumes(); select.replaceChildren();
    for (const v of volumes) select.add(new Option(v.path, v.path));
    if (!volumes.length) { select.add(new Option('Selecciona una carpeta', '')); text('status', 'No se encontraron unidades accesibles.'); }
    capacity(); setBusy(false);
  } catch (e) { error(e); }
}
void init();
