# Сборка и выкладка «Карты сети v2» на srv-diamedika (192.168.1.227:8092)
#
#   powershell -ExecutionPolicy Bypass -File "...\netmap-v2\deploy-227.ps1"
#
# Делает: npm run build -> архив dist -> scp -> установка/перезапуск на сервере.

$ErrorActionPreference = 'Stop'
$v2 = $PSScriptRoot
$tar = Join-Path $env:TEMP 'netmap-v2.tar.gz'

Write-Host "Сборка (npm run build) ..."
Push-Location $v2
try {
    & "C:\Program Files\nodejs\npm.cmd" run build
    if ($LASTEXITCODE -ne 0) { throw "build failed: $LASTEXITCODE" }
} finally {
    Pop-Location
}

$dist = Join-Path $v2 'dist'
if (-not (Test-Path $dist)) { throw "нет папки dist" }

Write-Host "Архив dist ..."
if (Test-Path $tar) { Remove-Item -LiteralPath $tar -Force }
Push-Location $dist
try {
    tar -czf $tar index.html assets
    if ($LASTEXITCODE -ne 0) { throw "tar failed: $LASTEXITCODE" }
} finally {
    Pop-Location
}

Write-Host "Копирование на serv-diamedika ..."
scp -q $tar serv-diamedika:/tmp/netmap-v2.tar.gz
if ($LASTEXITCODE -ne 0) { throw "scp archive failed: $LASTEXITCODE" }
scp -q (Join-Path $v2 'deploy\netmap-v2-setup.sh') serv-diamedika:/tmp/netmap-v2-setup.sh
if ($LASTEXITCODE -ne 0) { throw "scp setup failed: $LASTEXITCODE" }

Write-Host "Установка ..."
ssh -o BatchMode=yes serv-diamedika "bash /tmp/netmap-v2-setup.sh"
if ($LASTEXITCODE -ne 0) { throw "remote setup failed: $LASTEXITCODE" }

Write-Host ""
Write-Host "Готово: http://192.168.1.227:8092/"

