# Sloty kapsli: co wstaje przy starcie, co się zapisuje, co się dzieje ze zdarzeniami zapomnianego
# slotu i co panel uznaje za „nie ma żadnego kapsla". Run: py tests/test_devices_slots.py
#
# Powód (2026-09-04): po zapomnieniu kapsli w hubie „dodawały się" pigułki
# d0, d1, d2…, a próba ich usunięcia kończyła się komunikatem „Nie można usunąć ostatniego
# urządzenia". Dwie wady naraz:
#   1. SERWER przy każdym starcie otwierał d0..d{--devices-1} NA SIŁĘ i dopiero do tego dokładał
#      zapamiętane sloty — komu kapsel mieszkał w d4, temu na każdym starcie wracał pusty d0.
#   2. PANEL tworzył wpis urządzenia (devEntry) dla KAŻDEGO zdarzenia z nieznanym id, także dla
#      spóźnionego „szukam" z pętli slotu usuniętego chwilę wcześniej — widmowa pigułka, której
#      serwer nie znał, więc /device/forget odpowiadał 409 (tekst „ostatni slot").
# Serwer: czyste funkcje startup_slot_ids / remembered_slot_ids i DeviceBus.closed, bez uruchamiania
# DeviceManagera (jego konstruktor podnosi silniki i wątki). Panel: devKnownId (rf-05) i _devAddFirst
# (rf-11) wycięte z plików po nazwie i uruchomione w Node (tests/devices_hub_harness.mjs), tak jak
# inne harnessy w tym katalogu — brak Node = te sprawdzenia są pomijane, nie udawane.
import json
import os
import shutil
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import ribbitflip_monitor as rf  # noqa: E402

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")   # konsola cp1250 vs „→” w nazwach
except Exception:
    pass

_passed = 0
_failed = 0


def check(name, cond, detail=""):
    global _passed, _failed
    if cond:
        _passed += 1
        print("PASS  %s" % name)
    else:
        _failed += 1
        print("FAIL  %s   %s" % (name, detail))


def main():
    # --- 1. co wstaje przy starcie -------------------------------------------------------------
    # Adresy BLE w tym pliku są ZMYŚLONE i takie mają zostać. Adres to stały identyfikator
    # JEDNEGO konkretnego kapsla leżącego na czyimś biurku, a ten plik jedzie na GitHub;
    # sprawdzeniom wystarczy, że pole jest niepuste. Tak samo robi test_diag.py, który z tego
    # samego powodu maskuje adres w paczce zgłoszenia.
    only_d4 = {"d4": {"name": "Triki 5", "addr": "02:AB:CD:00:00:04"}}
    check("zapamiętany tylko d4 + --devices 1 → wstaje SAM d4 (żadnego pustego d0)",
          rf.startup_slot_ids(only_d4, 1) == ["d4"], rf.startup_slot_ids(only_d4, 1))
    check("nic nie zapamiętane → wstaje sam d0",
          rf.startup_slot_ids({}, 1) == ["d0"], rf.startup_slot_ids({}, 1))
    check("--devices 3 przy zapamiętanym d4 → d4 plus dwa najniższe wolne (d0, d1)",
          rf.startup_slot_ids(only_d4, 3) == ["d0", "d1", "d4"], rf.startup_slot_ids(only_d4, 3))
    legacy = {"d0": {"name": "Triki 1", "addr": "02:AB:CD:00:00:01"}, "d1": {"name": "Triki 2"}}
    check("stary plik: wpis BEZ adresu (nigdy niesparowany) nie wraca",
          rf.startup_slot_ids(legacy, 1) == ["d0"], rf.startup_slot_ids(legacy, 1))
    check("remembered_slot_ids ignoruje śmieci i sortuje po numerze",
          rf.remembered_slot_ids({"d10": {"addr": "A"}, "x": {"addr": "B"}, "d2": {"addr": "C"}, "d3": "zle"}) == ["d2", "d10"])
    check("remembered_slot_ids na nie-słowniku → pusta lista", rf.remembered_slot_ids(None) == [])
    check("startup_slot_ids: count 0/None traktowane jak 1",
          rf.startup_slot_ids({}, 0) == ["d0"] and rf.startup_slot_ids({}, None) == ["d0"])

    # --- 2. zamknięta szyna zapomnianego slotu milczy -------------------------------------------
    class Sink:
        def __init__(self):
            self.evs = []

        def publish(self, ev):
            self.evs.append(ev)

        def now(self):
            return 0.0

    sink = Sink()
    bus = rf.DeviceBus(sink, "d1")
    bus.set_status(conn="scanning", msg="Szukam")
    check("DeviceBus przed zamknięciem przekazuje zdarzenia z polem dev",
          len(sink.evs) == 1 and sink.evs[0].get("dev") == "d1" and sink.evs[0].get("conn") == "scanning")
    bus.closed = True
    bus.set_status(conn="scanning", msg="spóźnione")
    bus.publish({"t": "s", "a": [0, 0, 0], "g": [0, 0, 0]})
    check("DeviceBus.closed = spóźnione zdarzenia zapomnianego slotu NIE wychodzą do panelu",
          len(sink.evs) == 1, len(sink.evs))

    # --- 3. handler /device/forget rozróżnia „nie ma takiego" od „ostatni" --------------------
    src = open(rf.__file__, encoding="utf-8").read()
    i = src.find('if path == "/device/forget":')
    block = src[i:i + 900]
    check("/device/forget: nieznany slot → 404 (panel zdejmuje widmo), ostatni → 409",
          'send_error(404, "Nie ma takiego urządzenia")' in block and "send_error(409" in block)
    j = src.find("def _persist_meta(self):")
    pblock = src[j:j + 900]
    check("_persist_meta zapisuje tylko sloty ze związanym kapslem (bez adresu = nie wraca po starcie)",
          "if not d.bound_addr:" in pblock and '"addr": d.bound_addr' in pblock)
    # Slot domyślny MUSI istnieć. startup_slot_ids otwiera same zapamiętane sloty, więc d0 często
    # nie ma wcale — a `default_id` zostawione na stałej kłamało w /devices, w _dev_id() i we
    # wstrzykiwanym id strony, przez co panel otwierał się na slocie, którego serwer nie miał.
    c = src.find("ids = startup_slot_ids(meta_all, self.count)")
    cblock = src[c:c + 900]
    check("DeviceManager.__init__: default_id naprawiany na pierwszy otwarty slot",
          "if self.default_id not in self.devices and self.order:" in cblock
          and "self.default_id = self.order[0]" in cblock)
    # Sygnatura przyjela opcjonalny `plik` (strona nakladki skanera idzie ta sama droga), wiec
    # szukamy nazwy, nie calego naglowka — asercja dotyczy wstrzykiwania, nie liczby argumentow.
    h = src.find("def _serve_html(self")
    hblock = src[h:h + 4000]   # okno powiekszone: doszedl komentarz o drugiej stronie serwowanej ta droga
    check("_serve_html wstrzykuje RIBBITFLIP_DEV = prawdziwy slot domyślny",
          "window.RIBBITFLIP_DEV=" in hblock and "self.dm.default_id" in hblock)
    k = src.find("def add_slot(self, keep_rejected=False):")
    ablock = src[k:k + 2600]
    check("add_slot: jedyny niesparowany slot jest parowany zamiast otwierania drugiego obok",
          "lone = self.devices.get(self.order[0]) if len(self.order) == 1 else None" in ablock)
    check("add_slot: devmeta idzie PRZED pierwszym statusem (panel wpuszcza slot tylko po devmeta)",
          ablock.find("self._publish_meta(d)") < ablock.find('d.bus.set_status(conn="pairing"',
                                                            ablock.find("self._publish_meta(d)")))

    # --- 4. panel: devKnownId i _devAddFirst w Node ---------------------------------------------
    node = shutil.which("node")
    harness = os.path.join(os.path.dirname(os.path.abspath(__file__)), "devices_hub_harness.mjs")
    if not node:
        print("SKIP  brak node — sprawdzenia panelu (devKnownId, _devAddFirst) pominięte")
    else:
        try:
            out = subprocess.run([node, harness], capture_output=True, text=True, timeout=60, encoding="utf-8")
            data = json.loads(out.stdout.strip().splitlines()[-1])
            for name, ok, detail in data.get("checks", []):
                check("panel: " + name, ok, detail)
        except Exception as e:
            check("panel: harness Node uruchamia się", False, str(e))

    print("\n%d PASS, %d FAIL" % (_passed, _failed))
    sys.exit(1 if _failed else 0)


if __name__ == "__main__":
    main()
