@echo off
title Hadir Almoalem - Install / Update
set "DIR=%LOCALAPPDATA%\HadirAlmoalem"
if not exist "%DIR%" mkdir "%DIR%"
echo.
echo  Downloading the latest version from hadir.wasl.uk ...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; [Net.ServicePointManager]::SecurityProtocol='Tls12'; $z=Join-Path $env:TEMP 'hadir.zip'; $t=Join-Path $env:TEMP 'hadir-new'; Invoke-WebRequest 'https://hadir.wasl.uk/hadir-almoalem.zip' -OutFile $z -UseBasicParsing; if(Test-Path $t){Remove-Item $t -Recurse -Force}; Expand-Archive $z $t -Force; if(-not (Test-Path (Join-Path $t 'manifest.json'))){throw 'bad package'}; Remove-Item $z"
if errorlevel 1 (
  echo  Download failed - check the internet and try again.
  if /i not "%~1"=="silent" pause
  exit /b 1
)
robocopy "%TEMP%\hadir-new" "%DIR%\extension" /MIR /NFL /NDL /NJH /NJS /NP >nul
rmdir /s /q "%TEMP%\hadir-new" >nul 2>&1
if /i not "%~f0"=="%DIR%\update.bat" copy /y "%~f0" "%DIR%\update.bat" >nul 2>&1
if /i "%~1"=="silent" exit /b 0

powershell -NoProfile -ExecutionPolicy Bypass -Command "$u=Join-Path $env:LOCALAPPDATA 'HadirAlmoalem\update.bat'; try { $a=New-ScheduledTaskAction -Execute 'cmd.exe' -Argument ('/c start \"\" /min \"'+$u+'\" silent'); $tr=@((New-ScheduledTaskTrigger -Daily -At 6:00am),(New-ScheduledTaskTrigger -Daily -At 1:00pm)); Register-ScheduledTask -TaskName 'HadirAlmoalemUpdate' -Action $a -Trigger $tr -Settings (New-ScheduledTaskSettingsSet -StartWhenAvailable) -Force | Out-Null } catch {}; try { $s=(New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Desktop')+'\Hadir Update.lnk'); $s.TargetPath=$u; $s.Save() } catch {}"

echo %DIR%\extension| clip
echo.
echo  ===========================================================
echo   DONE. Extension folder:
echo   %DIR%\extension
echo   (path copied - paste it with Ctrl+V)
echo.
echo   First time only, in chrome://extensions :
echo   1- Turn on Developer mode
echo   2- Load unpacked - paste the path (Ctrl+V) - Enter - Select Folder
echo.
echo   Updates run automatically every day at 6:00 AM and 1:00 PM
echo   Update now any time: "Hadir Update" on the Desktop, then press reload in chrome://extensions
echo  ===========================================================
start "" chrome "chrome://extensions" >nul 2>&1
pause
