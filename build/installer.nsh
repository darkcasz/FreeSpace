; Match the application image, never every executable under $INSTDIR.
; The default directory-prefix check can include the uninstaller itself.
!macro customCheckAppRunning
  nsProcess::_FindProcess /NOUNLOAD "${APP_EXECUTABLE_FILENAME}"
  Pop $R0
  ${If} $R0 == 0
    ; Give an updater-triggered shutdown time to release its processes.
    ${If} ${Silent}
      StrCpy $R1 0
      ${DoWhile} $R0 == 0
        Sleep 500
        IntOp $R1 $R1 + 1
        nsProcess::_FindProcess /NOUNLOAD "${APP_EXECUTABLE_FILENAME}"
        Pop $R0
        ${If} $R1 >= 20
          ${ExitDo}
        ${EndIf}
      ${Loop}
    ${EndIf}
    ${If} $R0 == 0
      ; The plugin's CloseProcess also force-terminates after its grace period,
      ; so only invoke it after explicit confirmation, never on a silent update.
      ${If} ${Silent}
        SetErrorLevel 1
        Quit
      ${Else}
        MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION "FreeSpace.exe está en ejecución. Cierra cualquier análisis o mantenimiento antes de continuar.$\r$\n$\r$\nAceptar cerrará los procesos de FreeSpace, incluso si están bloqueados. Cancelar deja la instalación sin cambios." /SD IDCANCEL IDOK +2
        Quit
        nsProcess::_CloseProcess /NOUNLOAD "${APP_EXECUTABLE_FILENAME}"
        Pop $R0
        Sleep 500
        nsProcess::_FindProcess /NOUNLOAD "${APP_EXECUTABLE_FILENAME}"
        Pop $R0
      ${EndIf}
    ${EndIf}
  ${EndIf}
  ${If} $R0 != 603
    ; 603 means not running. Never treat enumeration/access errors as absence.
    MessageBox MB_OK|MB_ICONSTOP "No se pudo confirmar el cierre de FreeSpace.exe (código $R0). Revisa ese proceso en el Administrador de tareas y vuelve a intentar." /SD IDOK
    SetErrorLevel 1
    Quit
  ${EndIf}
  nsProcess::_Unload

!macroend

; Compile the standard installer from a local template copy. Only installUtil is patched.
!macro customHeader
  !cd "${PROJECT_DIR}/.build-cache/nsis"
!macroend

!macro FreeSpaceLog MESSAGE
  Push $R8
  FileOpen $R8 "$TEMP\FreeSpace-install.log" a
  FileSeek $R8 0 END
  FileWrite $R8 "${MESSAGE}$\r$\n"
  FileClose $R8
  Pop $R8
  ClearErrors
!macroend

!macro customInit
  !insertmacro FreeSpaceLog "Inicio instalador ${VERSION}; destino $INSTDIR"
!macroend

!macro customUnInit
  !insertmacro FreeSpaceLog "Inicio desinstalador ${VERSION}; destino $INSTDIR"
!macroend

!macro customInstall
  !insertmacro FreeSpaceLog "Instalacion ${VERSION} completada; destino $INSTDIR"
!macroend
