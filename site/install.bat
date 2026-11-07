@echo off
title Hadir Almoalem - Install / Update
setlocal
set "DIR=%USERPROFILE%\HadirAlmoalem"
set "EXT=%DIR%\extension"
set "TMPD=%TEMP%\hadir-new"
set "ZIP=%TEMP%\hadir.zip"
if not exist "%DIR%" mkdir "%DIR%"
echo.
echo  [1/3] Downloading the latest version from hadir.wasl.uk ...
if exist "%ZIP%" del /f /q "%ZIP%" >nul 2>&1
curl.exe -sSL --fail -o "%ZIP%" "https://hadir.wasl.uk/hadir-almoalem.zip" >nul 2>&1
if not exist "%ZIP%" powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol='Tls12'; Invoke-WebRequest 'https://hadir.wasl.uk/hadir-almoalem.zip' -OutFile '%ZIP%' -UseBasicParsing" >nul 2>&1
if not exist "%ZIP%" (
  echo  ERROR: download failed. Check the internet or antivirus, then run again.
  if /i not "%~1"=="silent" pause
  exit /b 1
)
echo  [2/3] Extracting ...
if exist "%TMPD%" rmdir /s /q "%TMPD%" >nul 2>&1
mkdir "%TMPD%"
tar -xf "%ZIP%" -C "%TMPD%" >nul 2>&1
if not exist "%TMPD%\manifest.json" powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -LiteralPath '%ZIP%' -DestinationPath '%TMPD%' -Force" >nul 2>&1
if not exist "%TMPD%\manifest.json" (
  echo  ERROR: could not extract the package.
  if /i not "%~1"=="silent" pause
  exit /b 1
)
echo  [3/3] Copying to %EXT% ...
robocopy "%TMPD%" "%EXT%" /MIR /R:2 /W:2 /NFL /NDL /NJH /NJS /NP >nul
rmdir /s /q "%TMPD%" >nul 2>&1
del /f /q "%ZIP%" >nul 2>&1
if not exist "%EXT%\manifest.json" (
  echo  ERROR: could not copy files to %EXT%
  if /i not "%~1"=="silent" pause
  exit /b 1
)
if /i not "%~f0"=="%DIR%\update.bat" copy /y "%~f0" "%DIR%\update.bat" >nul 2>&1
if /i "%~1"=="silent" exit /b 0

powershell -NoProfile -ExecutionPolicy Bypass -Command "$u=Join-Path $env:USERPROFILE 'HadirAlmoalem\update.bat'; try { $a=New-ScheduledTaskAction -Execute 'cmd.exe' -Argument ('/c start \"\" /min \"'+$u+'\" silent'); $tr=@((New-ScheduledTaskTrigger -Daily -At 6:00am),(New-ScheduledTaskTrigger -Daily -At 1:00pm)); Register-ScheduledTask -TaskName 'HadirAlmoalemUpdate' -Action $a -Trigger $tr -Settings (New-ScheduledTaskSettingsSet -StartWhenAvailable) -Force | Out-Null } catch {}; try { $s=(New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Desktop')+'\Hadir Update.lnk'); $s.TargetPath=$u; $s.Save() } catch {}"

echo %EXT%| clip
echo.
echo  ===========================================================
echo   OK - installed. Extension folder:
echo   %EXT%
echo   (path copied - paste it with Ctrl+V)
echo.
echo   First time only, in chrome://extensions :
echo   1- Remove any old "Hadir Almoalem" copies
echo   2- Turn on Developer mode
echo   3- Load unpacked - paste the path (Ctrl+V) - Enter - Select Folder
echo.
echo   Updates: automatic every day at 6:00 AM and 1:00 PM.
echo   Update now: run "Hadir Update" on the Desktop, then press
echo   reload on the extension in chrome://extensions
echo  ===========================================================
start "" explorer "%EXT%"
start "" chrome "chrome://extensions" >nul 2>&1
pause
