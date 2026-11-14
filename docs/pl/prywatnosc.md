# Bezpieczeństwo i prywatność

← [README](../../README.md) · [English](../en/privacy.md)

RibbitFlip działa tylko na Twoim komputerze. Panel otwiera się w przeglądarce, ale nie jest stroną
w internecie: nikt z zewnątrz się do niego nie dostanie. Aplikacja **nie sprawdza aktualizacji,
nie zbiera danych o Tobie i nie ma kont**. Sama z siebie niczego nie wysyła.

Z internetem albo z siecią łączy się tylko wtedy, gdy mu każesz, w sześciu sytuacjach:

1. **Moduł Usługi** wysyła polecenia pod adresy, które wpiszesz.
2. **Połączenie z OBS Studio** działa tylko z OBS na tym komputerze albo w Twojej sieci domowej.
3. **Pobranie zestawu z odnośnika** działa tylko z Discorda i z GitHuba.
4. **Kubek Ko-fi** otwiera stronę Ko-fi dopiero po kliknięciu.
5. **OSC** wysyła ruch tylko na adres, który wpiszesz (domyślnie ten komputer).
6. **Gra RibbitBeat** pobiera pakiety MIDI z Hugging Face i piosenkę z wklejonego adresu, ale
   tylko z internetu, nigdy z Twojej sieci domowej.

**Mikrofon** jest potrzebny tylko w jednym miejscu: gdy w Studiu instrumentów klikniesz **Nagraj**,
żeby zrobić własną próbkę dźwięku. Przeglądarka pyta wtedy o zgodę, a mikrofon gaśnie, gdy skończysz
nagrywać albo wyjdziesz ze Studia. Nagranie zostaje na tym komputerze — nie jest nigdzie wysyłane.
Bez kliknięcia „Nagraj” aplikacja nigdy nie prosi o mikrofon i go nie włącza.

Nic nie trafia do systemu, dopóki nie włączysz modułu. Wczytany zestaw nie włączy
modułu za Ciebie, a asystent AI tylko wtedy, gdy w karcie Serwer MCP sam mu na to pozwolisz
(„Asystent może uzbrajać”, domyślnie wyłączone). Każdą jego zmianę panel pokazuje dymkiem.
W symulacji ruch jest udawany, ale klawisze i kliknięcia prawdziwe, dlatego moduły startują wtedy wyłączone, a pierwsze włączenie potwierdzasz.

**Stop awaryjny: `Alt`+`R`+`F`.** Działa zawsze, nawet gdy panel jest schowany, i wyłącza
wszystkie moduły na każdym kapslu, łącznie ze Skanerem i Kołem wyboru (zamyka też okno skanera
nad pulpitem). Włączasz je z powrotem tymi samymi przełącznikami. Kombinację zmienisz
w **Ustawienia → Stop awaryjny**. Prawy Alt (AltGr) nigdy go nie uruchamia, więc pisanie „ł"
czy „ó" jest bezpieczne.

Szczegóły techniczne są w części [Pod maską](programisci.md#pod-maską) i w [`SECURITY.md`](../../.github/SECURITY.md).
Mapę wszystkich mechanizmów, które sterują komputerem, z odnośnikami do kodu, znajdziesz w części
[Cel i zabezpieczenia](cel-i-zabezpieczenia.md).
