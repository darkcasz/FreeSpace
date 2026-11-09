// Keep the standard electron-builder installer/uninstaller generation and validation.
// Add a bounded legacy migration to the standard helper instead of a custom script.
export function patchInstallUtility(source: string, migration: string): string {
  const anchor = '  # Retry counter\n  StrCpy $R5 0\n';
  if (source.split(anchor).length !== 2 || !source.includes('Function uninstallOldVersion\n')) {
    throw new Error('La plantilla NSIS cambió; revisar la migración antes de compilar.');
  }
  const oldMessage = 'MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "$(appCannotBeClosed)" /SD IDCANCEL IDRETRY OneMoreAttempt';
  if (source.split(oldMessage).length !== 2) throw new Error('No se encontró el diagnóstico de desinstalación esperado.');
  return source.replace(anchor, `${migration}\n${anchor}`).replace(oldMessage,
    '!insertmacro FreeSpaceLog "Fallo del desinstalador anterior; codigo $R0; archivo $uninstallerFileNameTemp"\n' +
    '      MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "No se pudo ejecutar el desinstalador anterior de FreeSpace (código $R0).$\\r$\\nRegistro: $TEMP\\FreeSpace-install.log" /SD IDCANCEL IDRETRY OneMoreAttempt');
}
