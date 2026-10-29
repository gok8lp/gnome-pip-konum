import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

// Chrome'un normal tarayıcı penceresi bundan büyük açılır; bundan küçükler PiP/popup sayılır
const MAX_POPUP_W = 1000;
const MAX_POPUP_H = 800;
const MARGIN = 16;
const PIP_TITLE = /picture.in.picture|resim içinde resim|pencere içinde pencere/i;
const STATE_FILE = GLib.build_filenamev([GLib.get_user_data_dir(), 'pip-konum', 'state.json']);
// Wayland'da sınıf adı ve boyut geç gelebiliyor; bu kadar süre boyunca tekrar bakılır
const RETRY_MS = 100;
const RETRY_COUNT = 15;

function log(msg) {
    console.log(`pip-konum: ${msg}`);
}

// Sınıf adına güvenilmez (Chrome PiP penceresinde boş geliyor); pencerenin sürecine bakılır
function isChrome(win) {
    const id = `${win.get_wm_class() ?? ''} ${win.get_gtk_application_id() ?? ''} ${win.get_sandboxed_app_id() ?? ''}`;
    if (/chrome|chromium/i.test(id))
        return true;
    const pid = win.get_pid();
    if (pid <= 0)
        return false;
    try {
        const [ok, bytes] = GLib.file_get_contents(`/proc/${pid}/comm`);
        return ok && /chrome|chromium/i.test(new TextDecoder().decode(bytes));
    } catch {
        return false;
    }
}

export default class PipKonum extends Extension {
    enable() {
        this._tracked = new Map();
        this._sources = new Set();
        this._saveId = 0;
        this._createdId = global.display.connect('window-created', (_d, win) => this._watch(win));
        log('etkin');
    }

    disable() {
        global.display.disconnect(this._createdId);
        for (const [win, ids] of this._tracked)
            ids.forEach(id => win.disconnect(id));
        this._tracked.clear();
        this._sources.forEach(id => GLib.source_remove(id));
        this._sources.clear();
        if (this._saveId)
            GLib.source_remove(this._saveId);
        this._saveId = 0;
    }

    _watch(win) {
        let tries = 0;
        const id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, RETRY_MS, () => {
            tries++;
            const r = win.get_frame_rect();
            // Pencere henüz boyutlanmadıysa veya kimliği belli değilse biraz daha bekle
            const ready = r.width > 0 && r.height > 0 && win.get_pid() > 0;
            if (!ready && tries < RETRY_COUNT)
                return GLib.SOURCE_CONTINUE;
            this._sources.delete(id);
            if (ready)
                this._place(win);
            return GLib.SOURCE_REMOVE;
        });
        this._sources.add(id);
    }

    _isPopup(win) {
        const type = win.get_window_type();
        if (type !== Meta.WindowType.NORMAL && type !== Meta.WindowType.DIALOG && type !== Meta.WindowType.UTILITY)
            return false;
        if (!isChrome(win))
            return false;
        const r = win.get_frame_rect();
        return PIP_TITLE.test(win.get_title() ?? '') ||
            (r.width < MAX_POPUP_W && r.height < MAX_POPUP_H);
    }

    _place(win) {
        const r = win.get_frame_rect();
        if (!this._isPopup(win))
            return;
        log(`"${win.get_title()}" ${r.width}x${r.height} yakalandı`);

        const saved = this._load();
        const monitor = saved ? this._savedMonitor(saved) : -1;
        let w = r.width, h = r.height, x, y, how;
        if (monitor >= 0) {
            // Kayıt hangi monitördeyse o monitörün sınırları içinde, bırakıldığı yere birebir uygula
            const g = global.display.get_monitor_geometry(monitor);
            w = Math.min(saved.width ?? w, g.width);
            h = Math.min(saved.height ?? h, g.height);
            // Monitör düzeni değiştiyse mutlak konum yerine monitöre göreli konum kullanılır
            const sameLayout = !saved.mon || (saved.mon.x === g.x && saved.mon.y === g.y);
            x = sameLayout ? saved.x : g.x + saved.relX * g.width;
            y = sameLayout ? saved.y : g.y + saved.relY * g.height;
            x = Math.round(Math.min(Math.max(x, g.x), g.x + g.width - w));
            y = Math.round(Math.min(Math.max(y, g.y), g.y + g.height - h));
            how = `hafızadan, monitör ${monitor}`;
        } else {
            const area = win.get_work_area_for_monitor(win.get_monitor());
            x = area.x + area.width - w - MARGIN;
            y = area.y + area.height - h - MARGIN;
            how = `sağ alt, monitör ${win.get_monitor()}`;
        }
        // Wayland'da boyut değişikliği istemcinin onayını bekler; konum önce ayrıca verilir
        win.move_frame(true, x, y);
        if (w !== r.width || h !== r.height)
            win.move_resize_frame(true, x, y, w, h);
        win.make_above();
        // Hangi çalışma alanına geçilirse geçilsin görünür kalsın
        win.stick();
        log(`yerleştirildi ${x},${y} ${w}x${h} (${how})`);

        const ids = [
            win.connect('position-changed', () => this._queueSave(win)),
            win.connect('size-changed', () => this._queueSave(win)),
            // Kapanırken son hâli hemen kaydet
            win.connect('unmanaging', () => {
                this._save(win);
                this._tracked.delete(win);
            }),
        ];
        this._tracked.set(win, ids);
    }

    _queueSave(win) {
        if (this._saveId)
            GLib.source_remove(this._saveId);
        this._saveId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 400, () => {
            this._saveId = 0;
            if (this._tracked.has(win))
                this._save(win);
            return GLib.SOURCE_REMOVE;
        });
    }

    _save(win) {
        const r = win.get_frame_rect();
        if (r.width <= 0 || r.height <= 0)
            return;
        const monitor = win.get_monitor();
        if (monitor < 0)
            return;
        const g = global.display.get_monitor_geometry(monitor);
        const state = {
            x: r.x, y: r.y, width: r.width, height: r.height,
            monitor,
            mon: {x: g.x, y: g.y, width: g.width, height: g.height},
            relX: (r.x - g.x) / g.width,
            relY: (r.y - g.y) / g.height,
        };
        try {
            GLib.mkdir_with_parents(GLib.path_get_dirname(STATE_FILE), 0o755);
            GLib.file_set_contents(STATE_FILE, JSON.stringify(state));
        } catch (e) {
            console.error(`pip-konum: ${e}`);
        }
    }

    // Kaydın ait olduğu monitör: önce aynı yerde duran monitör, yoksa aynı numaralı monitör
    _savedMonitor(saved) {
        const n = global.display.get_n_monitors();
        const cx = saved.x + (saved.width ?? 0) / 2;
        const cy = saved.y + (saved.height ?? 0) / 2;
        for (let i = 0; i < n; i++) {
            const g = global.display.get_monitor_geometry(i);
            if (cx >= g.x && cx < g.x + g.width && cy >= g.y && cy < g.y + g.height)
                return i;
        }
        if (saved.relX !== undefined && saved.monitor >= 0 && saved.monitor < n)
            return saved.monitor;
        return -1;
    }

    _load() {
        try {
            const [ok, bytes] = GLib.file_get_contents(STATE_FILE);
            return ok ? JSON.parse(new TextDecoder().decode(bytes)) : null;
        } catch {
            return null;
        }
    }
}
