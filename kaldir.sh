#!/bin/bash
# Eklentiyi kapatır, siler ve kayıtlı PiP konumunu temizler.
set -e
UUID="pip-konum@gokalp"
gnome-extensions disable "$UUID" 2>/dev/null || true
python3 - "$UUID" <<'PY'
import ast, subprocess, sys
uuid = sys.argv[1]
cur = subprocess.run(['gsettings', 'get', 'org.gnome.shell', 'enabled-extensions'],
                     capture_output=True, text=True, check=True).stdout.strip()
lst = [u for u in ast.literal_eval(cur.replace('@as ', '')) if u != uuid]
subprocess.run(['gsettings', 'set', 'org.gnome.shell', 'enabled-extensions', str(lst)], check=True)
PY
rm -rf ~/.local/share/gnome-shell/extensions/$UUID ~/.local/share/pip-konum
echo "Eklenti kaldırıldı; tamamen çıkması için oturumu kapatıp aç."
