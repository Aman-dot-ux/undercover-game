@echo off
title UNDERCOVER — Network Diagnostics
cls

echo ===============================================================
echo   UNDERCOVER — NETWORK ^& FIREWALL DIAGNOSTIC TOOL
echo ===============================================================
echo.

cd /d "%~dp0"

echo [1/3] Detecting Local Wi-Fi / LAN IP addresses:
powershell -NoProfile -Command "Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notlike '*Loopback*' -and $_.IPAddress -notlike '169.254*' } | Select-Object InterfaceAlias, IPAddress | Format-Table -AutoSize"

echo [2/3] Checking Port 3000 Availability:
powershell -NoProfile -Command "$conn = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue; if ($conn) { Write-Host 'Port 3000 is CURRENTLY IN USE by PID:' $conn[0].OwningProcess -ForegroundColor Yellow } else { Write-Host 'Port 3000 is FREE and ready for the server.' -ForegroundColor Green }"

echo.
echo [3/3] Checking Windows Defender Firewall Inbound Rules:
powershell -NoProfile -Command "$rule = Get-NetFirewallRule -DisplayName '*Undercover*' -ErrorAction SilentlyContinue; if ($rule) { Write-Host 'Firewall rule detected:' $rule.DisplayName -ForegroundColor Green } else { Write-Host 'Tip: If mobile phones cannot connect, ensure Node.js is allowed on Private networks in Windows Firewall.' -ForegroundColor Cyan }"

echo.
echo ===============================================================
echo   Quick Firewall Command (Run as Administrator if needed):
echo   netsh advfirewall firewall add rule name="Undercover Party Game" dir=in action=allow protocol=TCP localport=3000 profile=private
echo ===============================================================
echo.
pause
