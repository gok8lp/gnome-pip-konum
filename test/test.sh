#!/bin/bash
# Eklentiyi ekransız, 3 sanal monitörlü ayrı bir GNOME Shell'de gerçek Chrome PiP'iyle dener.
# Repodaki eklenti kodunu, ayrı bir veri klasörüyle dener: senin oturumuna, kayıtlı PiP konumuna
# ve Chrome profiline dokunmaz.
# Gerekenler: sudo apt-get install mutter-dev-bin dbus-daemon   ·   Node.js 20+
set -e
T="$(cd "$(dirname "$0")" && pwd)"
EKRAN=wayland-pipkonum-test
PORT=9334
IS=$(mktemp -d); LOG="$IS/shell.log"
# Test kabuğu eklentiyi ve kaydı bu geçici veri klasöründen kullanır
VERI="$IS/veri"
KAYIT="$VERI/pip-konum/state.json"
mkdir -p "$VERI/gnome-shell/extensions"
cp -r "$T/../pip-konum@gokalp" "$VERI/gnome-shell/extensions/"
bekle() { python3 -c "import time; time.sleep($1)"; }
cdp() { node --experimental-websocket "$T/cdp.mjs" "$PORT" "$1" 2>/dev/null; }
AC="document.getElementById('v').requestPictureInPicture().then(w => w.width + 'x' + w.height)"
KAPAT="document.exitPictureInPicture().then(() => 'kapandi')"

temizle() {
    pkill -f "remote-debugging-port=$PORT" 2>/dev/null || true
    pkill -f "wayland-display=$EKRAN" 2>/dev/null || true
    bekle 2
    rm -f "$XDG_RUNTIME_DIR/$EKRAN" "$XDG_RUNTIME_DIR/$EKRAN.lock"
    rm -rf "$IS"
}
trap temizle EXIT

setsid -f env XDG_DATA_HOME="$VERI" bash -c "exec dbus-run-session -- gnome-shell --headless --wayland --no-x11 --wayland-display=$EKRAN \
    --virtual-monitor 1920x1080 --virtual-monitor 1280x1024 --virtual-monitor 1920x1080 > '$LOG' 2>&1"
for _ in $(seq 30); do [ -S "$XDG_RUNTIME_DIR/$EKRAN" ] && break; bekle 1; done
bekle 3
setsid -f env WAYLAND_DISPLAY=$EKRAN DBUS_SESSION_BUS_ADDRESS= google-chrome-stable --user-data-dir="$IS/profil" \
    --ozone-platform=wayland --no-first-run --no-default-browser-check --remote-debugging-port=$PORT \
    "file://$T/page.html" > "$IS/chrome.log" 2>&1
for _ in $(seq 20); do curl -s 127.0.0.1:$PORT/json >/dev/null && break; bekle 1; done
bekle 3

HATA=0
kontrol() { # $1 açıklama, $2 günlükte beklenen ifade
    if grep -aq "pip-konum: yerleştirildi .*$2" "$LOG"; then echo "GEÇTİ  $1"; else echo "KALDI  $1"; HATA=1; fi
}

rm -f "$KAYIT"
cdp "$AC" >/dev/null; bekle 2
kontrol "İlk açılış sağ altta" "sağ alt, monitör 0"
cdp "$KAPAT" >/dev/null; bekle 1

# 3. monitöre taşınmış gibi kayıt bırak, yeniden aç
echo '{"x":4500,"y":600,"width":500,"height":281,"monitor":2,"mon":{"x":3200,"y":0,"width":1920,"height":1080},"relX":0.677,"relY":0.555}' > "$KAYIT"
cdp "$AC" >/dev/null; bekle 2
kontrol "3. monitörde bırakılan yerde açılır" "4500,600 500x281 (hafızadan, monitör 2)"
cdp "$KAPAT" >/dev/null; bekle 1

# Kapanınca son konum kaydedilmiş olmalı
if grep -q '"x":4500' "$KAYIT" && grep -q '"monitor":2' "$KAYIT"; then echo "GEÇTİ  Kapanınca konum kaydedilir"; else echo "KALDI  Kapanınca konum kaydedilir"; HATA=1; fi

grep -a 'JS ERROR' "$LOG" | grep -v DING && HATA=1
exit $HATA
