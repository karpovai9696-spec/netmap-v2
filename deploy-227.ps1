# Сборка и выкладка «Карты сети v2» (backend: вход + роли + realtime) на srv-diamedika.
#
#   powershell -ExecutionPolicy Bypass -File "...\netmap-v2\deploy-227.ps1"
#
# Делает: npm run build -> dist.tar.gz -> scp (dist + server.mjs + init-users.mjs + setup.sh)
#         -> установка на сервере (порт 8092), вывод логинов/паролей при первом запуске.

$ErrorActionPreference = 'Stop'
$v2 = $PSScriptRoot
$tar = Join-Path $env:TEMP 'netmap-v2-dist.tar.gz'

Write-Host 'Сборка (npm run build) ...'
Push-Location $v2
try {
    & 'C:\Program Files\nodejs\npm.cmd' run build
    if ($LASTEXITCODE -ne 0) { throw "build failed: $LASTEXITCODE" }
} finally {
    Pop-Location
}

$dist = Join-Path $v2 'dist'
if (-not (Test-Path $dist)) { throw 'нет папки dist' }

Write-Host 'Архив dist ...'
if (Test-Path $tar) { Remove-Item -LiteralPath $tar -Force }
Push-Location $dist
try {
    tar -czf $tar index.html assets
    if ($LASTEXITCODE -ne 0) { throw "tar failed: $LASTEXITCODE" }
} finally {
    Pop-Location
}

Write-Host 'Копирование на serv-diamedika ...'
scp -q $tar serv-diamedika:/tmp/netmap-v2-dist.tar.gz
if ($LASTEXITCODE -ne 0) { throw 'scp dist failed' }
scp -q (Join-Path $v2 'server\server.mjs') serv-diamedika:/tmp/server.mjs
if ($LASTEXITCODE -ne 0) { throw 'scp server.mjs failed' }
scp -q (Join-Path $v2 'server\init-users.mjs') serv-diamedika:/tmp/init-users.mjs
if ($LASTEXITCODE -ne 0) { throw 'scp init-users.mjs failed' }
$docs = Join-Path $v2 'server\docs.json'
if (Test-Path $docs) {
    scp -q $docs serv-diamedika:/tmp/docs.json
    if ($LASTEXITCODE -ne 0) { throw 'scp docs.json failed' }
} else {
    Write-Warning 'server\docs.json не найден — вкладка «Сеть офиса» будет без данных'
}
$walls = Join-Path $v2 'server\walls.json'
if (Test-Path $walls) { scp -q $walls serv-diamedika:/tmp/walls.json }
scp -q (Join-Path $v2 'deploy\netmap-v2-setup.sh') serv-diamedika:/tmp/netmap-v2-setup.sh
if ($LASTEXITCODE -ne 0) { throw 'scp setup failed' }

Write-Host 'Установка ...'
$out = ssh -o BatchMode=yes serv-diamedika "bash /tmp/netmap-v2-setup.sh" 2>&1
$out | ForEach-Object { Write-Host $_ }
if ($LASTEXITCODE -ne 0) { throw "remote setup failed: $LASTEXITCODE" }

# сохранить выданные логины/пароли локально
$creds = $out | Where-Object { $_ -match '^LOGIN=' }
if ($creds) {
    $file = Join-Path $v2 '..\notes\netmap-credentials.txt'
    @(
        "netmap-v2 — доступ (создан $(Get-Date -Format 'yyyy-MM-dd HH:mm'))",
        "URL: http://192.168.1.227:8092/",
        '',
        ($creds -join "`n"),
        '',
        'Пароль можно сменить после входа: клик по своему имени в шапке.'
    ) | Set-Content -LiteralPath $file -Encoding UTF8
    Write-Host ''
    Write-Host "Логины и пароли сохранены: $file"
}

Write-Host ''
Write-Host 'Готово: http://192.168.1.227:8092/'
