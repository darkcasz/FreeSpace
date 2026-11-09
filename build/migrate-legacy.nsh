  ; Recover known affected releases in place, only at the SAME registered location.
  ; Do not launch their broken uninstallers or alter registry before extraction.
  Push $R2
  Push $R3
  Push $R4
  !insertmacro readReg $R2 "$rootKey" "${UNINSTALL_REGISTRY_KEY}" DisplayVersion
  GetFullPathName $R3 "$installationDir"
  GetFullPathName $R4 "$INSTDIR"
  ${If} $R3 != ""
  ${AndIf} $R3 == $R4
    ${If} $R2 == "0.1.0"
    ${OrIf} $R2 == "0.2.0"
    ${OrIf} $R2 == "0.3.0"
    ${OrIf} $R2 == "0.3.1"
    ${OrIf} $R2 == "0.3.2"
      !insertmacro FreeSpaceLog "Recuperacion en sitio de $R2; se omite el desinstalador anterior."
      DetailPrint "Recuperando FreeSpace $R2 sin ejecutar el desinstalador anterior."
      Pop $R4
      Pop $R3
      Pop $R2
      StrCpy $R0 0
      ClearErrors
      Return
    ${EndIf}
  ${EndIf}
  Pop $R4
  Pop $R3
  Pop $R2
