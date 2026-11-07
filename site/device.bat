@echo off
title Hadir Almoalem - Dedicated class computer setup
setlocal
echo.
echo  ===========================================================
echo   Hadir Almoalem - prepare this computer to run classes alone
echo  ===========================================================
echo.
echo  [1/5] Installing / updating the extension ...
set "INS=%TEMP%\hadir-install.bat"
curl.exe -sSL --fail -o "%INS%" "https://hadir.wasl.uk/install.bat" >nul 2>&1
if not exist "%INS%" powershell -NoProfile -Command "Invoke-WebRequest 'https://hadir.wasl.uk/install.bat' -OutFile '%INS%' -UseBasicParsing" >nul 2>&1
if exist "%INS%" (call "%INS%" silent) else (echo   ERROR: could not download the installer)
if not exist "%USERPROFILE%\HadirAlmoalem\update.bat" if exist "%INS%" copy /y "%INS%" "%USERPROFILE%\HadirAlmoalem\update.bat" >nul
echo        scheduling daily updates (6:00 AM, 1:00 PM) ...
schtasks /Create /TN "HadirAlmoalemUpdate" /TR "cmd /c start \"\" /min \"%USERPROFILE%\HadirAlmoalem\update.bat\" silent" /SC DAILY /ST 06:00 /F >nul 2>&1
schtasks /Create /TN "HadirAlmoalemUpdate2" /TR "cmd /c start \"\" /min \"%USERPROFILE%\HadirAlmoalem\update.bat\" silent" /SC DAILY /ST 13:00 /F >nul 2>&1

echo  [2/5] Never sleep / hibernate while plugged in ...
powercfg /change standby-timeout-ac 0 >nul 2>&1
powercfg /change hibernate-timeout-ac 0 >nul 2>&1
powercfg /change monitor-timeout-ac 30 >nul 2>&1

echo  [3/5] Open Chrome with Teams automatically when Windows starts ...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$c=@(\"$env:ProgramFiles\Google\Chrome\Application\chrome.exe\",\"${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe\",\"$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe\") | Where-Object { Test-Path $_ } | Select-Object -First 1; if ($c) { $s=(New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Startup')+'\Hadir Classes.lnk'); $s.TargetPath=$c; $s.Arguments='--restore-last-session --auto-select-tab-capture-source-by-title=YouTube --autoplay-policy=no-user-gesture-required https://teams.microsoft.com/v2/'; $s.Save(); $d=(New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Desktop')+'\Hadir Chrome.lnk'); $d.TargetPath=$c; $d.Arguments=$s.Arguments; $d.Save(); 'ok' } else { 'nochrome' }" > "%TEMP%\hadir-chrome.txt"
findstr /c:"nochrome" "%TEMP%\hadir-chrome.txt" >nul && echo   WARNING: Chrome was not found. Install Google Chrome, then run this file again.

echo  [4/5] Chrome settings for classes (no tab sleeping, Teams camera/mic allowed) ...
reg add "HKCU\Software\Policies\Google\Chrome" /v HighEfficiencyModeEnabled /t REG_DWORD /d 0 /f >nul 2>&1
reg add "HKCU\Software\Policies\Google\Chrome" /v BackgroundModeEnabled /t REG_DWORD /d 1 /f >nul 2>&1
reg add "HKCU\Software\Policies\Google\Chrome\AudioCaptureAllowedUrls" /v 1 /t REG_SZ /d "https://teams.microsoft.com" /f >nul 2>&1
reg add "HKCU\Software\Policies\Google\Chrome\VideoCaptureAllowedUrls" /v 1 /t REG_SZ /d "https://teams.microsoft.com" /f >nul 2>&1
reg add "HKCU\Software\Policies\Google\Chrome\NotificationsAllowedForUrls" /v 1 /t REG_SZ /d "https://teams.microsoft.com" /f >nul 2>&1

echo  [5/5] Restart this computer every night at 3:00 AM (fresh start) ...
schtasks /Create /TN "HadirAlmoalemNightlyRestart" /TR "shutdown /r /t 60 /c \"Hadir Almoalem nightly restart\"" /SC DAILY /ST 03:00 /F >nul 2>&1

echo.
echo  ===========================================================
echo   DONE. Remaining (one time only, by you):
echo   1- In Chrome sign in to Teams and Outlook (teacher account)
echo   2- chrome://extensions : Developer mode - Load unpacked -
echo      %USERPROFILE%\HadirAlmoalem\extension
echo   3- Windows auto sign-in: press Win+R, type  netplwiz
echo      untick "Users must enter a user name and password"
echo      (so the PC opens by itself after the nightly restart)
echo   4- Close ALL Chrome windows, then open Chrome only from
echo      the Desktop shortcut "Hadir Chrome" (or restart the PC)
echo   5- Leave the computer ON and plugged in. Nothing else.
echo  ===========================================================
pause
