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

  !ifndef BUILD_UNINSTALLER
    ; Updating runs the OLD uninstaller, so fixing only the new one isn't enough.
    ; Repair only known affected releases registered under this app's own GUID.
    !insertmacro FreeSpaceRepairLegacyUninstaller HKCU
    ${If} $installMode == "all"
      !insertmacro FreeSpaceRepairLegacyUninstaller HKLM
    ${EndIf}
  !endif
!macroend

!macro FreeSpaceRepairLegacyUninstaller ROOT
  Push $R2
  Push $R3
  Push $OUTDIR
  ReadRegStr $R2 ${ROOT} "${INSTALL_REGISTRY_KEY}" "InstallLocation"
  ReadRegStr $R3 ${ROOT} "${UNINSTALL_REGISTRY_KEY}" "DisplayVersion"
  ${If} $R3 == "0.1.0"
  ${OrIf} $R3 == "0.2.0"
  ${OrIf} $R3 == "0.3.0"
    ${If} ${FileExists} "$R2\${APP_EXECUTABLE_FILENAME}"
    ${AndIf} ${FileExists} "$R2\${UNINSTALL_FILENAME}"
      ClearErrors
      SetOutPath "$R2"
      File "/oname=${UNINSTALL_FILENAME}" "${UNINSTALLER_OUT_FILE}"
      ${If} ${Errors}
        MessageBox MB_OK|MB_ICONSTOP "No se pudo reparar el desinstalador anterior. Cierra otros instaladores de FreeSpace y vuelve a intentar." /SD IDOK
        SetErrorLevel 1
        Quit
      ${EndIf}
      DetailPrint "Desinstalador de FreeSpace $R3 reparado."
    ${EndIf}
  ${EndIf}
  Pop $R2
  SetOutPath "$R2"
  Pop $R3
  Pop $R2
!macroend
