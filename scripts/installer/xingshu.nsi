; 星枢破甲工具 · NSIS 安装程序
;
; 真正意义上的 Windows 安装包：欢迎页 → 许可协议 → 选择目录 → 安装进度 → 完成页，
; 写 HKCU 卸载项（设置 → 应用 里可见）、开始菜单、桌面快捷方式、卸载程序。
;
; 构建：makensis /DAPP_VERSION=5.0.0 scripts\installer\xingshu.nsi

!include "MUI2.nsh"
!include "FileFunc.nsh"

!ifndef APP_VERSION
  !define APP_VERSION "5.0.0"
!endif

!define APP_NAME      "星枢破甲工具"
!define APP_PUBLISHER "星枢[未来科技]"
!define APP_EXE       "星枢破甲工具.exe"
!define APP_KEY       "Software\Microsoft\Windows\CurrentVersion\Uninstall\星枢破甲工具"
!define STAGE_DIR     "release\win-unpacked"

Name "${APP_NAME}"
BrandingText "星枢[未来科技] · ${APP_NAME} ${APP_VERSION}"
OutFile "release\星枢破甲工具-安装版-${APP_VERSION}.exe"
InstallDir "$LOCALAPPDATA\${APP_NAME}"
InstallDirRegKey HKCU "${APP_KEY}" "InstallLocation"
RequestExecutionLevel user
Unicode true
; 压缩方式可用 /DCOMPRESS_MODE=zlib 覆盖（低内存环境 / 模拟器上 lzma 可能失败）
!ifndef COMPRESS_MODE
  !define COMPRESS_MODE "lzma"
!endif
SetCompressor /SOLID ${COMPRESS_MODE}
SetCompressorDictSize 32
XPStyle on
CRCCheck on

VIProductVersion "5.0.0.0"
VIAddVersionKey "ProductName"     "${APP_NAME}"
VIAddVersionKey "ProductVersion"  "${APP_VERSION}"
VIAddVersionKey "CompanyName"     "${APP_PUBLISHER}"
VIAddVersionKey "LegalCopyright"  "Copyright © ${APP_PUBLISHER}"
VIAddVersionKey "FileDescription" "${APP_NAME} 安装程序"
VIAddVersionKey "FileVersion"     "5.0.0.0"

; ---------------- 界面 ----------------
!define MUI_ICON   "build\icon.ico"
!define MUI_UNICON "build\icon.ico"
!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_BITMAP "build\nsis-header.bmp"
!define MUI_HEADERIMAGE_RIGHT
!define MUI_WELCOMEFINISHPAGE_BITMAP "build\nsis-welcome.bmp"
!define MUI_ABORTWARNING

!define MUI_WELCOMEPAGE_TITLE "安装 ${APP_NAME}"
!define MUI_WELCOMEPAGE_TEXT "本向导将把 ${APP_NAME} ${APP_VERSION} 安装到你的电脑。$\r$\n$\r$\n安装完成后需要输入卡密激活。程序只在本机运行，不上传任何用户数据。$\r$\n$\r$\n点击「下一步」继续。"

!define MUI_LICENSEPAGE_TEXT_TOP "请阅读以下许可协议。继续安装表示你接受这些条款。"
!define MUI_LICENSEPAGE_TEXT_BOTTOM "本软件仅限授权范围内的安全研究使用。"

!define MUI_DIRECTORYPAGE_TEXT_TOP "选择安装位置。默认装到当前用户目录，不需要管理员权限。"
!define MUI_DIRECTORYPAGE_TEXT_DESTINATION "安装到："

!define MUI_INSTFILESPAGE_COLORS "FFFFFF 1C1C1E"
!define MUI_INSTFILESPAGE_PROGRESSBAR colored

!define MUI_FINISHPAGE_TITLE "安装完成"
!define MUI_FINISHPAGE_TEXT "${APP_NAME} ${APP_VERSION} 已安装到你的电脑。$\r$\n首次启动需要输入卡密完成激活。"
!define MUI_FINISHPAGE_RUN "$INSTDIR\${APP_EXE}"
!define MUI_FINISHPAGE_RUN_TEXT "立即运行 ${APP_NAME}（推荐）"
!define MUI_FINISHPAGE_LINK "查看使用教程"
!define MUI_FINISHPAGE_LINK_LOCATION "https://github.com/TuLu-openclaw/xingshu-codex"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "LICENSE"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "SimpChinese"

; ---------------- 安装 ----------------
Section "主程序" SEC_MAIN
  SectionIn RO
  SetOutPath "$INSTDIR"
  SetOverwrite on
  File /r "${STAGE_DIR}\*.*"

  WriteUninstaller "$INSTDIR\uninstall.exe"

  ; 快捷方式
  CreateShortcut "$DESKTOP\${APP_NAME}.lnk" "$INSTDIR\${APP_EXE}" "" "$INSTDIR\${APP_EXE}" 0
  CreateDirectory "$SMPROGRAMS\${APP_NAME}"
  CreateShortcut "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk" "$INSTDIR\${APP_EXE}" "" "$INSTDIR\${APP_EXE}" 0
  CreateShortcut "$SMPROGRAMS\${APP_NAME}\卸载 ${APP_NAME}.lnk" "$INSTDIR\uninstall.exe"

  ; 卸载信息（设置 → 应用）
  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  WriteRegStr   HKCU "${APP_KEY}" "DisplayName"     "${APP_NAME}"
  WriteRegStr   HKCU "${APP_KEY}" "DisplayVersion"  "${APP_VERSION}"
  WriteRegStr   HKCU "${APP_KEY}" "Publisher"       "${APP_PUBLISHER}"
  WriteRegStr   HKCU "${APP_KEY}" "DisplayIcon"     "$INSTDIR\${APP_EXE},0"
  WriteRegStr   HKCU "${APP_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr   HKCU "${APP_KEY}" "UninstallString" "$\"$INSTDIR\uninstall.exe$\""
  WriteRegStr   HKCU "${APP_KEY}" "QuietUninstallString" "$\"$INSTDIR\uninstall.exe$\" /S"
  WriteRegDWORD HKCU "${APP_KEY}" "EstimatedSize"   "$0"
  WriteRegDWORD HKCU "${APP_KEY}" "NoModify"        1
  WriteRegDWORD HKCU "${APP_KEY}" "NoRepair"        1
SectionEnd

; ---------------- 卸载 ----------------
Section "Uninstall"
  Delete "$DESKTOP\${APP_NAME}.lnk"
  Delete "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk"
  Delete "$SMPROGRAMS\${APP_NAME}\卸载 ${APP_NAME}.lnk"
  RMDir "$SMPROGRAMS\${APP_NAME}"

  RMDir /r "$INSTDIR"

  DeleteRegKey HKCU "${APP_KEY}"
  DeleteRegKey HKCU "Software\${APP_NAME}"
SectionEnd
