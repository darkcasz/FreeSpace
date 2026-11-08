import { test } from 'node:test';
import assert from 'node:assert/strict';
import { maintenanceScript, maintenanceResult } from '../src/maintenance.ts';
function innerScript(action: string) {
  const outer = maintenanceScript(action);
  const encoded = outer.match(/'-EncodedCommand', '([A-Za-z0-9+/=]+)'/)!;
  assert.ok(encoded);
  return Buffer.from(encoded[1], 'base64').toString('utf16le');
}
test('solo permite acciones predeterminadas, sin comandos arbitrarios', () => {
  for (const action of ['', 'cmd.exe', 'clean-components; Remove-Item C:\\', null, {}, ['clean-components']]) {
    assert.throws(() => maintenanceScript(action), /no válida/);
  }
});
test('WinSxS requiere elevación y preserva código de salida de DISM', () => {
  for (const action of ['analyze-components', 'clean-components']) {
    assert.match(maintenanceScript(action), /-Verb RunAs/);
    assert.match(innerScript(action), /\$code = \$LASTEXITCODE/);
    assert.doesNotMatch(innerScript(action), /ResetBase|Remove-Item|SPSuperseded/);
  }
  assert.match(innerScript('analyze-components'), /\/AnalyzeComponentStore/);
  assert.doesNotMatch(innerScript('analyze-components'), /\/StartComponentCleanup/);
  assert.match(innerScript('clean-components'), /\/StartComponentCleanup/);
});
test('temporales usa selección interactiva de Windows y espera su cierre', () => {
  const script = maintenanceScript('clean-temporary');
  assert.match(script, /cleanmgr.exe/); assert.match(script, /-Wait -PassThru/);
  assert.doesNotMatch(script, /verylowdisk|sagerun|Remove-Item/i);
});
test('distingue rechazo UAC, error, reinicio y cierre sin afirmar eliminación', () => {
  assert.equal(maintenanceResult('clean-components', 1223).status, 'cancelled');
  assert.equal(maintenanceResult('clean-components', 5).status, 'error');
  assert.equal(maintenanceResult('clean-components', null).status, 'error');
  assert.match(maintenanceResult('clean-components', 3010).message, /reiniciar/);
  assert.match(maintenanceResult('clean-temporary', 0).message, /depende de lo que/);
});
