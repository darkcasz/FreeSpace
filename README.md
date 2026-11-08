# FreeSpace

Aplicación de escritorio en español para analizar discos y liberar espacio en Windows x64.

## Instalación

Instala `FreeSpace-0.3.1-Windows-x64-Setup.exe` desde GitHub Releases, cuando la publicación esté disponible. No necesitas Node.js ni comandos en el equipo de destino.

Las versiones 0.1 y 0.2 deben actualizarse una vez mediante este instalador para incorporar el actualizador.

## Análisis de discos

- Selección de unidad o carpeta, capacidad y espacio disponible del volumen.
- Análisis en segundo plano con progreso y cancelación.
- Carpetas ordenadas por tamaño acumulado, navegación y búsqueda.
- Lista de los 100 archivos más grandes del análisis.

El analizador solo lee metadatos. Omite enlaces simbólicos, junctions y elementos sin acceso. Los resultados cancelados son parciales. Se conserva el árbol de carpetas en memoria; falta evaluar discos con millones de carpetas.

Los tamaños son lógicos y pueden diferir del espacio físico por compresión, archivos dispersos, enlaces duros, instantáneas y archivos protegidos. Los enlaces duros se cuentan por ruta. No se consulta la MFT ni el diario USN. No se calcula un porcentaje de avance porque se desconoce el total antes del recorrido.

## Limpieza de Windows

- **Analizar WinSxS**: ejecuta `DISM /Online /Cleanup-Image /AnalyzeComponentStore` con elevación. Muestra el tamaño real y la recomendación de mantenimiento en una ventana de Windows.
- **Limpiar WinSxS**: solicita confirmación y elevación; ejecuta `DISM /Online /Cleanup-Image /StartComponentCleanup`. No utiliza `/ResetBase` ni elimina archivos de WinSxS directamente.
- **Limpiar temporales**: abre `cleanmgr.exe /d %SystemDrive%`. El usuario selecciona las categorías y confirma qué desea eliminar en el Liberador de espacio.

Las herramientas actúan sobre el Windows activo, independientemente de la carpeta seleccionada en el analizador. Al terminar DISM, presiona Entrar en su ventana para volver. FreeSpace comunica el resultado o la necesidad de reiniciar y actualiza la capacidad del volumen; vuelve a escanear para actualizar las carpetas. Cerrar el Liberador de espacio no garantiza que se haya eliminado nada.

No se ejecutan análisis y mantenimiento simultáneamente. FreeSpace no se cierra mientras espera el mantenimiento. Las acciones están predefinidas en el proceso principal; la interfaz no puede proporcionar comandos ni rutas arbitrarios.

Referencias de Microsoft: [WinSxS](https://learn.microsoft.com/en-us/windows-hardware/manufacture/desktop/clean-up-the-winsxs-folder?view=windows-11), [cleanmgr](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/cleanmgr).

## Actualizaciones automáticas

La versión instalada para Windows consulta GitHub Releases al iniciar (después de ocho segundos) y cada cuatro horas. También incluye **Buscar actualización**.

Las nuevas versiones estables se descargan en segundo plano. Una actualización verificada se instala al cerrar FreeSpace o con **Reiniciar e instalar**. Ese botón espera a que terminen el análisis y el mantenimiento. Solo se permite una instancia de FreeSpace. Los errores de conexión no impiden analizar ni limpiar; se puede reintentar. No se permiten degradaciones ni versiones preliminares.

El instalador incluye `app-update.yml` y las publicaciones deben incluir los tres archivos correspondientes a la misma versión:

- `FreeSpace-<version>-Windows-x64-Setup.exe`
- `FreeSpace-<version>-Windows-x64-Setup.exe.blockmap`
- `latest.yml`

El cliente no contiene credenciales de GitHub. El repositorio configurado debe ser público para permitir descargas sin iniciar sesión. Esta versión no configura firma digital de Windows.

## Desarrollo

Requiere Node.js 24 y npm.

```sh
npm install
npm start
```

```sh
npm run check
npm test
npm run dist:win -- --publish never
```

El instalador se genera en `release/`. Para publicar una versión, actualiza `package.json` y `RELEASE_NOTES.md`, compila y ejecuta `npm run publish:updates` con GitHub CLI autenticado. El script verifica el SHA-512 y los archivos requeridos, crea un borrador, sube todos los archivos y finalmente publica la versión. Si queda un borrador por una subida fallida, complétalo antes de publicar; el script no sobrescribe releases existentes.

Se incluye un workflow opcional en `scripts/release-workflow.example.yml`. Si se instala como `.github/workflows/release.yml`, compila, prueba y publica desde Windows al enviar una etiqueta `v<version>` que coincida con `package.json`. Usa el token de GitHub Actions con permiso `contents: write`. La publicación normal no requiere habilitar Actions.

## Estructura

- `src/main.ts`: ventana, volúmenes, IPC y coordinación de operaciones.
- `src/scanner.ts` y `src/worker.ts`: recorrido del sistema de archivos fuera del proceso de interfaz.
- `src/maintenance.ts`: herramientas de mantenimiento y elevación.
- `src/updates.ts`: estado, descarga e instalación de actualizaciones con electron-updater.
- `src/preload.ts` y `src/renderer.ts`: API limitada e interfaz.

La interfaz usa aislamiento de contexto, sandbox y contenido local siguiendo la [guía de Electron](https://www.electronjs.org/docs/latest/tutorial/security). Las conexiones del actualizador se realizan en el proceso principal.

## Validación

Once pruebas cubren el escaneo, enlaces y ciclos, cancelación, comandos de mantenimiento, códigos de salida y el ciclo de actualización con un proveedor simulado. Pasaron la revisión TypeScript y la compilación. Los instaladores anteriores se probaron en Windows por el usuario. La descarga e instalación real entre dos versiones y las acciones de mantenimiento de la versión actual requieren validación en Windows.

En este entorno macOS se utilizaron dependencias y distribuciones de Electron disponibles localmente, porque npm no tiene conexión al registro en el entorno de ejecución. Estos enlaces de `node_modules` no se incluyen en el repositorio ni en el instalador; las dependencias necesarias se empaquetan en `dist/main.cjs`.


## Corrección 0.3.1 del instalador

Se sustituyó la detección de procesos por prefijo de carpeta de electron-builder por `nsProcess::_FindProcess` con el nombre exacto `FreeSpace.exe`. El instalador y el desinstalador dejan de considerar otros ejecutables de la carpeta, incluidos los propios asistentes, como si fueran la aplicación.

El modo silencioso espera hasta diez segundos el cierre de FreeSpace; si sigue activo o la enumeración falla, se detiene sin matar procesos. El modo interactivo solicita autorización antes de intentar cerrar procesos con ese nombre. El código 603 del plugin significa que no hay coincidencias; otros errores no se interpretan como ausencia.

La actualización ejecuta normalmente el desinstalador que ya estaba instalado. Por eso, antes de esa fase, el instalador 0.3.1 sustituye el desinstalador de las versiones 0.1.0, 0.2.0 y 0.3.0 por el corregido. Solo considera ubicaciones y versiones registradas bajo el GUID propio de FreeSpace y con ambos ejecutables presentes. No modifica otras aplicaciones ni claves ajenas. Cierra cualquier asistente anterior antes de ejecutar el nuevo instalador.

La ventana de FreeSpace ahora se crea antes de inicializar el actualizador. Si falla la carga de la interfaz, se muestra el error y la aplicación termina, en lugar de continuar sin ventana.

Se verificó la compilación de ambos programas NSIS (instalador y desinstalador), además de los tipos y las once pruebas existentes. La resolución del bloqueo reportado y la migración desde 0.3.0 deben confirmarse en Windows; no se reprodujo el equipo afectado desde macOS.
