# PiP Konum Hafızası · GNOME Eklentisi

Chrome'un resim içinde resim (PiP) ve küçük popup pencerelerini ilk seferde **sağ altta** açar.
Sonra pencereyi nereye taşır ve hangi boyuta getirirsen bir sonraki açılışta **orada ve o boyutta** açar.
YouTube, Spotify Web mini oynatıcısı ve diğer PiP pencerelerinde çalışır.

GNOME Wayland'da Chrome pencere konumunu kendisi seçemez; bu eklenti işi pencere yöneticisinin içinde yapar.

## Kurulum

```bash
git clone <bu-repo> && cd gnome-pip-konum
./kur.sh
```

Sonra **oturumu bir kez kapatıp aç**. Wayland'da GNOME eklenti kodunu yalnızca oturum açılışında yükler.

## Özellikler

- **İlk açılış:** Panel ve dock'u hesaba katarak bulunduğu monitörün sağ alt köşesi.
- **Hafıza:** Konum ve boyut, pencere taşındıkça ve kapanırken `~/.local/share/pip-konum/state.json` dosyasına yazılır.
- **Çoklu monitör:** PiP hangi monitörde bırakıldıysa orada açılır. Monitör düzeni değişirse aynı monitörde ekrana göre aynı oranda bir yere konur. Monitör sökülürse mevcut monitörde sağ alta döner.
- **Sanal masaüstleri:** PiP tüm çalışma alanlarında görünür ve hep üstte kalır.
- **Tanıma:** Chrome PiP penceresi Wayland'da boş uygulama adıyla açılır; eklenti pencereyi ait olduğu süreçten (`/proc/<pid>/comm`) tanır.

Desteklenen GNOME sürümleri: 48–52.

## Test

Eklentiyi ekransız, 3 sanal monitörlü ayrı bir GNOME Shell'de gerçek bir Chrome PiP'iyle dener.
Senin oturumuna, kayıtlı konumuna ve Chrome profiline dokunmaz.

```bash
sudo apt-get install mutter-dev-bin dbus-daemon   # bir kez
./test/test.sh
```

## Sorun giderme

```bash
journalctl --user -b -o cat | grep pip-konum
```

## Kaldırma

```bash
./kaldir.sh
```

## Lisans

[MIT](LICENSE)
