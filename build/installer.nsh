!include "WinVer.nsh"

!macro customInit
  ${IfNot} ${AtLeastWin10}
    MessageBox MB_OK|MB_ICONSTOP "TuneVault requires Windows 10 or later."
    Quit
  ${EndIf}
!macroend
