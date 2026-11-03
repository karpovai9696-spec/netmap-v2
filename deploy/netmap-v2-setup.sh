#!/usr/bin/env bash
# Установка/обновление «Карты сети v2» на srv-diamedika (192.168.1.227:8092)
# Запуск: bash /tmp/netmap-v2-setup.sh   (архив dist уже должен быть в /tmp/netmap-v2.tar.gz)
set -euo pipefail

APP_DIR=/home/karpov/netmap-v2
PORT=8092
TARBALL=/tmp/netmap-v2.tar.gz

[ -f "$TARBALL" ] || { echo "нет $TARBALL"; exit 1; }

if [ -d "$APP_DIR" ] && [ -n "$(ls -A "$APP_DIR" 2>/dev/null)" ]; then
  BACKUP="/home/karpov/netmap-v2-backup-$(date +%Y%m%d-%H%M%S).tar.gz"
  tar -czf "$BACKUP" -C /home/karpov netmap-v2 >/dev/null 2>&1 || true
  echo "backup: $BACKUP"
fi

mkdir -p "$APP_DIR"
rm -rf "${APP_DIR:?}"/*
tar -xzf "$TARBALL" -C "$APP_DIR"
chmod -R u+rwX,go+rX "$APP_DIR"

cat > "$APP_DIR/start-netmap-v2.sh" <<'EOS'
#!/usr/bin/env bash
APP_DIR=/home/karpov/netmap-v2
PORT=8092
cd "$APP_DIR" || exit 1
if [ -f netmap-v2.pid ] && kill -0 "$(cat netmap-v2.pid)" 2>/dev/null; then
  exit 0
fi
if ss -ltn 2>/dev/null | grep -q ":$PORT "; then
  exit 0
fi
nohup python3 -m http.server "$PORT" --bind 0.0.0.0 --directory "$APP_DIR" \
  >> "$APP_DIR/netmap-v2.log" 2>&1 &
echo $! > netmap-v2.pid
sleep 0.5
EOS
chmod +x "$APP_DIR/start-netmap-v2.sh"

crontab -l > /tmp/cron.netmap2.bak 2>/dev/null || true
if ! grep -q "netmap-v2/start-netmap-v2.sh" /tmp/cron.netmap2.bak; then
  {
    echo "@reboot $APP_DIR/start-netmap-v2.sh >/dev/null 2>&1"
    echo "*/2 * * * * $APP_DIR/start-netmap-v2.sh >/dev/null 2>&1"
  } >> /tmp/cron.netmap2.bak
  crontab /tmp/cron.netmap2.bak
  echo "cron: добавлены автозапуск и watchdog"
fi

if [ -f "$APP_DIR/netmap-v2.pid" ] && kill -0 "$(cat "$APP_DIR/netmap-v2.pid")" 2>/dev/null; then
  kill "$(cat "$APP_DIR/netmap-v2.pid")" 2>/dev/null || true
  sleep 0.6
  rm -f "$APP_DIR/netmap-v2.pid"
fi
"$APP_DIR/start-netmap-v2.sh"
sleep 1
echo "--- listening:"
ss -ltn | grep ":$PORT " || true
echo "--- local check:"
curl -sS -o /dev/null -w "http://127.0.0.1:$PORT/ -> %{http_code}\n" "http://127.0.0.1:$PORT/"
echo "--- files:"
ls -la "$APP_DIR" | head -12

