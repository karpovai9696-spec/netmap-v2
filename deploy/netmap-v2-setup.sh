#!/usr/bin/env bash
# Установка netmap-v2 (backend: auth + WebSocket) на srv-diamedika.
# Ожидает в /tmp: netmap-v2-dist.tar.gz, server.mjs, init-users.mjs, project-seed.json (опционально)
set -uo pipefail

APP_DIR=/home/karpov/netmap-v2
SRV_DIR=/home/karpov/netmap-v2-server
PORT=8092
TARBALL=/tmp/netmap-v2-dist.tar.gz

[ -f "$TARBALL" ] || { echo "нет $TARBALL"; exit 1; }

echo "--- зависимости:"
command -v node >/dev/null || { echo "нет node"; exit 1; }
node --version

echo "--- статика:"
if [ -d "$APP_DIR" ] && [ -n "$(ls -A "$APP_DIR" 2>/dev/null)" ]; then
  BACKUP="/home/karpov/backups/netmap-v2-static-$(date +%Y%m%d-%H%M%S).tar.gz"
  mkdir -p /home/karpov/backups
  tar -czf "$BACKUP" -C /home/karpov netmap-v2 >/dev/null 2>&1 || true
  echo "backup: $BACKUP"
fi
mkdir -p "$APP_DIR"
rm -rf "${APP_DIR:?}"/*
tar -xzf "$TARBALL" -C "$APP_DIR"
chmod -R u+rwX,go+rX "$APP_DIR"

echo "--- сервер:"
mkdir -p "$SRV_DIR"
cp /tmp/server.mjs /tmp/init-users.mjs "$SRV_DIR"/
if [ -f /tmp/docs.json ]; then cp /tmp/docs.json "$SRV_DIR/docs.json"; chmod 600 "$SRV_DIR/docs.json"; echo "docs.json установлен (документация по сети)"; fi
if [ -f /tmp/walls.json ]; then cp /tmp/walls.json "$SRV_DIR/walls.json"; chmod 600 "$SRV_DIR/walls.json"; echo "walls.json установлен (актуальный план)"; fi
if [ -f /tmp/openings.json ]; then cp /tmp/openings.json "$SRV_DIR/openings.json"; chmod 600 "$SRV_DIR/openings.json"; echo "openings.json установлен (проёмы плана)"; fi
chmod 600 "$SRV_DIR"/*.mjs

if [ ! -f "$SRV_DIR/users.json" ]; then
  echo "--- создание пользователей:"
  node "$SRV_DIR/init-users.mjs"
else
  echo "--- users.json уже есть (пароли не меняются)"
fi

if [ ! -f "$SRV_DIR/project.json" ] && [ -f /tmp/project-seed.json ]; then
  cp /tmp/project-seed.json "$SRV_DIR/project.json"
  echo "--- проект инициализирован из seed"
fi

cat > "$SRV_DIR/start-netmap-server.sh" <<'EOS'
#!/usr/bin/env bash
SRV_DIR=/home/karpov/netmap-v2-server
PORT=8092
cd "$SRV_DIR" || exit 1
if [ -f server.pid ] && kill -0 "$(cat server.pid)" 2>/dev/null; then
  exit 0
fi
if ss -ltn 2>/dev/null | grep -q ":$PORT "; then
  exit 0
fi
PORT="$PORT" DIST=/home/karpov/netmap-v2 DATA_DIR="$SRV_DIR" \
  nohup node "$SRV_DIR/server.mjs" >> "$SRV_DIR/server.log" 2>&1 &
echo $! > server.pid
sleep 0.7
EOS
chmod +x "$SRV_DIR/start-netmap-server.sh"

# остановить старый python-статик и снять прежние cron-записи
if [ -f "$APP_DIR/netmap-v2.pid" ]; then
  kill "$(cat "$APP_DIR/netmap-v2.pid")" 2>/dev/null || true
  rm -f "$APP_DIR/netmap-v2.pid"
fi
fuser -k 8092/tcp 2>/dev/null || true
sleep 0.7

crontab -l > /tmp/cron.now 2>/dev/null || true
grep -v -E "netmap-v2/start-netmap-v2.sh|netmap-v2-server/start-netmap-server.sh" /tmp/cron.now > /tmp/cron.new
{
  echo "@reboot $SRV_DIR/start-netmap-server.sh >/dev/null 2>&1"
  echo "*/2 * * * * $SRV_DIR/start-netmap-server.sh >/dev/null 2>&1"
} >> /tmp/cron.new
crontab /tmp/cron.new

"$SRV_DIR/start-netmap-server.sh"
sleep 1

echo "--- проверка:"
code=""
for _ in 1 2 3 4 5; do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 "http://127.0.0.1:$PORT/api/config" || true)
  [ "$code" = "200" ] && break
  sleep 1
done
echo "GET /api/config -> ${code:-нет ответа}"
curl -s -o /dev/null -w "GET / -> %{http_code}\n" --max-time 3 "http://127.0.0.1:$PORT/"
echo "--- наличие пользователей:"
node -e "const u=require('/home/karpov/netmap-v2-server/users.json'); console.log(u.users.map(x=>x.login+' ('+x.role+')').join(', '))" 2>/dev/null || true
echo "--- логи:"
tail -5 "$SRV_DIR/server.log" 2>/dev/null || true
echo "--- ports:"
ss -ltn | grep ":$PORT " || true
