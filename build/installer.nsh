; Prima di installare: chiude Salotto se è acceso (solo Salotto.exe, per nome esatto).
!macro customCheckAppRunning
  nsExec::Exec `"$SYSDIR\taskkill.exe" /F /T /IM "${APP_EXECUTABLE_FILENAME}"`
  Pop $0
  Sleep 800
  !ifndef __UNINSTALL__
    ; Le versioni 0.1.0-0.1.4 costruite sul Mac hanno il disinstallatore rovinato (CRC sbagliato per via
    ; delle icone diverse): lanciarlo fallisce sempre e blocca l'aggiornamento ("non può essere chiuso").
    ; Per quelle versioni si toglie solo il comando di disinstallazione dal registro: l'installer salta
    ; il vecchio disinstallatore e scrive i file nuovi sopra i vecchi, poi rimette la voce giusta.
    !insertmacro salottoSaltaDisinstallatoreRotto HKEY_CURRENT_USER
    !insertmacro salottoSaltaDisinstallatoreRotto HKEY_LOCAL_MACHINE
  !endif
!macroend

; Anche in .onInit: lì gira pure la parte dell'installer con i permessi da amministratore (installazione
; "Per tutti gli utenti"), l'unica che può togliere la voce rovinata da HKLM. customCheckAppRunning invece
; gira solo nella parte senza permessi, e da lì HKLM non si può modificare.
!macro customInit
  !insertmacro salottoSaltaDisinstallatoreRotto HKEY_CURRENT_USER
  !insertmacro salottoSaltaDisinstallatoreRotto HKEY_LOCAL_MACHINE
!macroend

!macro salottoSaltaDisinstallatoreRotto RADICE
  ReadRegStr $R8 ${RADICE} "${UNINSTALL_REGISTRY_KEY}" "DisplayVersion"
  StrCmp $R8 "0.1.0" +6
  StrCmp $R8 "0.1.1" +5
  StrCmp $R8 "0.1.2" +4
  StrCmp $R8 "0.1.3" +3
  StrCmp $R8 "0.1.4" +2
  Goto +3
  DetailPrint "Salotto $R8: salto il vecchio disinstallatore rovinato"
  DeleteRegValue ${RADICE} "${UNINSTALL_REGISTRY_KEY}" "UninstallString"
  ClearErrors
!macroend
