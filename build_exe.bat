@echo off
REM ============================================================
REM  Builds the RibbitFlip executables, one file each, into dist\:
REM    build_exe.bat        RibbitFlip.exe + RibbitBeat.exe  the app and the game, one after another (double-click)
REM    build_exe.bat full   RibbitFlip.exe       the whole app only (RibbitFlip.spec)
REM    build_exe.bat essential  RibbitFlip-Essential.exe  ("lite" works too) the app without the "Wyprobuj" (Try it out) section: no Synth
REM                                              tab, no RibbitBeat game (RibbitFlip.spec, RF_EDITION=lite)
REM    build_exe.bat beat   RibbitBeat.exe       the game on its own, full screen (RibbitBeat.spec)
REM    build_exe.bat all    all three, one after another; stops at the first one that fails
REM  RibbitFlip.spec bundles bleak/pynput/vgamepad/pystray + the web/ front-end (incl. the
REM  dashboard shell) and the third-party licence texts, and excludes the ViGEmBus
REM  driver .msi installer (see third_party_licenses/README.md). RibbitBeat.spec needs none of
REM  those libraries: only the game, its pictures and fonts, and the song-pack manifests.
REM  Requires: pip install pyinstaller  (plus the runtime deps)
REM  Run by double-click (= RibbitFlip.exe, then RibbitBeat.exe), or: build_exe.bat full, essential, beat or all
REM
REM  NOTE: uses the Windows "py" launcher, because a bare "python" is often the
REM  Microsoft Store stub ("Python was not found"). Falls back to "python".
REM  A harmless warning about "bleak.backends.corebluetooth / No module named objc"
REM  may scroll by - that is the macOS BLE backend and is irrelevant on Windows.
REM
REM  What this prints - the wordmark at the start, then the frog or the punk skull and the
REM  summary line with the SHA-256 of the .exe - comes from tools/build_banner.py. Every branch
REM  below falls back to one line of plain text if that script (or Python itself) is not there,
REM  so the build never depends on the decoration.
REM  The drawings come in row by row over about a second; "set RF_BANNER_STATIC=1" before
REM  running this puts them on screen in one go instead (so does piping the output anywhere).
REM ============================================================
cd /d "%~dp0"
setlocal

REM  Which build: nothing (a double-click) = the app AND the game, RibbitFlip.exe then RibbitBeat.exe (2026-10-26:
REM  before that a double-click left dist\RibbitBeat.exe weeks old). "full" alone = only RibbitFlip.exe.
set "_WHAT=%~1"
set "_KNOWN="
if "%_WHAT%"=="" set "_WHAT=default"
if /I "%_WHAT%"=="default" set "_KNOWN=1"
if /I "%_WHAT%"=="essential" set "_WHAT=lite"
for %%W in (full lite beat all) do if /I "%_WHAT%"=="%%W" set "_KNOWN=1"
if not defined _KNOWN (
  echo Unknown build "%_WHAT%". Use: build_exe.bat  ^(RibbitFlip + RibbitBeat^)  or  build_exe.bat full / essential / beat / all
  pause
  exit /b 2
)

REM  Resolved before anything else, because the banners are a Python script too - the one that
REM  prints the name here, then the frog on success or the punk skull when the build never ran.
where py >nul 2>nul && (set "PYCMD=py") || (set "PYCMD=python")

REM  The name, dealt out a row at a time - "ribbit" white, "FLIP" pink. Pure decoration and the
REM  only banner with nothing to say, so when it cannot run the build simply carries on.
%PYCMD% "tools\build_banner.py" start 2>nul

echo Using: %PYCMD%
if /I "%_WHAT%"=="all" (
  call :build full || goto :failed
  call :build lite || goto :failed
  call :build beat || goto :failed
) else if /I "%_WHAT%"=="default" (
  call :build full || goto :failed
  call :build beat || goto :failed
) else (
  call :build %_WHAT% || goto :failed
)
pause
exit /b 0

:failed
pause
exit /b 1

REM ------------------------------------------------------------
REM  One build. %1 = full, lite or beat. Ends with exit /b 0 on success, 1 on failure; the frog or
REM  the skull, with the SHA-256 of THAT file, comes from the banner (--exe names the file).
REM ------------------------------------------------------------
:build
set "_SPEC=RibbitFlip.spec"
set "_EXE=RibbitFlip.exe"
set "RF_EDITION=full"
if /I "%~1"=="lite" set "_EXE=RibbitFlip-Essential.exe"
if /I "%~1"=="lite" set "RF_EDITION=lite"
if /I "%~1"=="beat" set "_SPEC=RibbitBeat.spec"
if /I "%~1"=="beat" set "_EXE=RibbitBeat.exe"
echo.
echo ==== %_EXE%  (%_SPEC%) ====

REM  A running .exe is locked by Windows, and PyInstaller only finds that out at its very LAST
REM  step: it works for half a minute, builds everything, then dies trying to delete the old file
REM  ("PermissionError: [WinError 5] Access is denied: dist\RibbitFlip.exe"). Ask up front instead,
REM  for the one file this build is about to replace.
REM  Full paths on purpose: "find" is also a Unix tool, and a shell like Git Bash puts its own
REM  version earlier in PATH, where it would fail on /I and quietly wave the build through.
"%SystemRoot%\System32\tasklist.exe" /NH /FI "IMAGENAME eq %_EXE%" 2>nul | "%SystemRoot%\System32\findstr.exe" /I /C:"%_EXE%" >nul
if not errorlevel 1 (
  %PYCMD% "tools\build_banner.py" locked --exe "dist\%_EXE%" || echo %_EXE% is still running - close it, then run this again.
  exit /b 1
)

REM  Only so the banner can say how long that took. Windows writes %TIME% in the local format,
REM  and the banner drops the figure rather than guessing if it cannot read it back.
set "_T0=%TIME%"
%PYCMD% -m PyInstaller --noconfirm --clean %_SPEC%
if errorlevel 1 (
  %PYCMD% "tools\build_banner.py" fail --since "%_T0%" --exe "dist\%_EXE%" || echo BUILD FAILED - scroll up for the reason.
  exit /b 1
)
%PYCMD% "tools\build_banner.py" ok --since "%_T0%" --exe "dist\%_EXE%" || echo Done. File: dist\%_EXE%
exit /b 0
