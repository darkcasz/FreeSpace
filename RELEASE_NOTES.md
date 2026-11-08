FreeSpace 0.3.1 para Windows x64.

- Corrige la comprobación de aplicación en ejecución del instalador y desinstalador: detecta únicamente FreeSpace.exe mediante la API nativa de Windows, sin considerar otros ejecutables de la carpeta.
- Antes de actualizar, reemplaza el desinstalador de las versiones 0.1.0, 0.2.0 y 0.3.0 por el corregido. No hace falta desinstalar esas versiones manualmente.
- Una actualización silenciosa espera a que FreeSpace termine; no fuerza el cierre de procesos.
- La aplicación abre su ventana antes de inicializar el actualizador, para que un fallo del actualizador no la deje sin interfaz.
- Conserva el análisis, la limpieza de Windows y las actualizaciones automáticas.

Cierra cualquier instalador anterior y ejecuta este instalador para actualizar la instalación existente. La corrección está compilada y verificada estáticamente; requiere confirmar en Windows que resuelve el bloqueo observado.
