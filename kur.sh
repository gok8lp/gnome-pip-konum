#!/bin/bash
# PiP Konum Hafızası GNOME eklentisini kurar ve etkinleştirir.
# Kullanım: ./kur.sh   (sonra oturumu kapatıp aç)
set -e
R="$(cd "$(dirname "$0")" && pwd)"
UUID="pip-konum@gokalp"
HEDEF=~/.local/share/gnome-shell/extensions/$UUID

echo "==> Eklenti kopyalanıyor: $HEDEF"
mkdir -p "$HEDEF"
cp "$R/$UUID/metadata.json" "$R/$UUID/extension.js" "$HEDEF/"

echo "==> Etkin eklentiler listesine ekleniyor"
python3 - "$UUID" <<'PY'
import ast, subprocess, sys
uuid = sys.argv[1]
cur = subprocess.run(['gsettings', 'get', 'org.gnome.shell', 'enabled-extensions'],
                     capture_output=True, text=True, check=True).stdout.strip()
lst = ast.literal_eval(cur.replace('@as ', ''))
if uuid not in lst:
    lst.append(uuid)
    subprocess.run(['gsettings', 'set', 'org.gnome.shell', 'enabled-extensions', str(lst)], check=True)
PY
gsettings set org.gnome.shell disable-user-extensions false

echo
echo "Tamam. Wayland'da GNOME eklenti kodunu yalnızca oturum açılışında yükler:"
echo "oturumu bir kez kapatıp aç."
