import { spawn } from 'node:child_process';
import { win32 } from 'node:path';
import type { MaintenanceAction, MaintenanceResult } from './types.ts';

const actions = ['analyze-components', 'clean-components', 'clean-temporary'] as const;
export function maintenanceScript(action: unknown): string {
  if (!actions.includes(action as MaintenanceAction)) throw new Error('Acción de mantenimiento no válida.');
  if (action === 'clean-temporary') {
    // Interactive Windows dialog: Windows handles eligibility, locked files and confirmation.
    return `$ErrorActionPreference = 'Stop'\ntry {\n$p = Start-Process -FilePath (Join-Path $env:SystemRoot 'System32\\cleanmgr.exe') -ArgumentList @('/d', $env:SystemDrive) -Wait -PassThru\nexit $p.ExitCode\n} catch { [Console]::Error.WriteLine($_.Exception.Message); exit 1 }`;
  }
  const operation = action === 'analyze-components' ? '/AnalyzeComponentStore' : '/StartComponentCleanup';
  const inner = `$ErrorActionPreference = 'Stop'\n$code = 1\ntry {\nWrite-Host 'FreeSpace - Mantenimiento de WinSxS'\nWrite-Host 'Espera a que termine. No cierres esta ventana durante la operacion.'\n& (Join-Path $env:SystemRoot 'System32\\Dism.exe') /Online /Cleanup-Image ${operation}\n$code = $LASTEXITCODE\nWrite-Host ('Codigo de resultado: ' + $code)\nif ($code -eq 3010) { Write-Host 'Es necesario reiniciar Windows.' }\n} catch { Write-Host $_.Exception.Message }\n[void](Read-Host 'Presiona Entrar para volver a FreeSpace')\nexit $code`;
  const encoded = Buffer.from(inner, 'utf16le').toString('base64');
  return `$ErrorActionPreference = 'Stop'\ntry {\n$p = Start-Process -FilePath (Join-Path $env:SystemRoot 'System32\\WindowsPowerShell\\v1.0\\powershell.exe') -Verb RunAs -ArgumentList @('-NoProfile', '-EncodedCommand', '${encoded}') -Wait -PassThru\nexit $p.ExitCode\n} catch {\nif ($_.Exception.NativeErrorCode -eq 1223 -or $_.Exception.InnerException.NativeErrorCode -eq 1223) { exit 1223 }\n[Console]::Error.WriteLine($_.Exception.Message); exit 1\n}`;
}
export function maintenanceResult(action: MaintenanceAction, code: number | null): MaintenanceResult {
  if (code === 1223) return { status: 'cancelled', message: 'Se canceló la solicitud de permisos de administrador.' };
  if (code !== 0 && code !== 3010) return { status: 'error', message: `Windows no completó la operación (código ${code ?? 'desconocido'}). Revisa el resultado en la ventana de mantenimiento y el registro de DISM de Windows.` };
  if (action === 'clean-temporary') return { status: 'completed', message: 'Se cerró el Liberador de espacio de Windows. El espacio disponible se ha actualizado; la eliminación depende de lo que hayas seleccionado y confirmado allí.' };
  return { status: 'completed', message: `${action === 'analyze-components' ? 'Análisis de WinSxS completado. Consulta el informe mostrado por DISM para saber si recomienda limpiar.' : 'Limpieza de WinSxS completada. Los resultados anteriores del escaneo deben volver a analizarse.'}${code === 3010 ? ' Windows solicita reiniciar el equipo.' : ''}` };
}
export function runMaintenance(action: unknown): Promise<MaintenanceResult> {
  const script = maintenanceScript(action);
  if (process.platform !== 'win32') throw new Error('El mantenimiento está disponible únicamente en Windows.');
  const executable = win32.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  return new Promise((resolve, reject) => {
    const child = spawn(executable, ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', data => { stderr = (stderr + data.toString()).slice(-4000); });
    child.once('error', reject);
    child.once('close', code => {
      const result = maintenanceResult(action as MaintenanceAction, code);
      if (result.status === 'error' && stderr.trim()) result.message += ` ${stderr.trim()}`;
      resolve(result);
    });
  });
}
