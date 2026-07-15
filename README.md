# a'la Winsped — System dyspozytorski NT Cargo

Prosta aplikacja dla dyspozytorów **NT Cargo Sp. z o.o.** — inspirowana systemem WinSped (LIS).
Służy do **wprowadzania zleceń transportowych** i **wystawiania z nich faktur VAT**.

Działa w przeglądarce, **nie wymaga instalacji ani serwera**. Wszystkie dane są zapisywane
lokalnie w przeglądarce (localStorage), więc pozostają na Twoim komputerze.

---

## Co potrafi

- **Pulpit** — podsumowanie: aktywne zlecenia, zlecenia do zafakturowania, przychód miesiąca,
  należności (w tym po terminie) oraz wykres przychodów z 6 miesięcy.
- **Zlecenia** — rejestr zleceń transportowych: trasa (załadunek/rozładunek), ładunek,
  pojazd i kierowca, fracht (sprzedaż/zakup/marża), statusy, wydruk zlecenia dla przewoźnika
  lub potwierdzenia dla klienta.
- **Kontrahenci** — baza klientów i przewoźników (z walidacją NIP). **Auto‑pobieranie danych po NIP**
  z rejestru VAT (Biała lista Ministerstwa Finansów) — wpisz NIP, kliknij „Pobierz dane", a nazwa
  i adres uzupełnią się same. W *Ustawieniach* pobiera dodatkowo REGON, KRS i numer konta.
- **Faktury** — wystawianie faktur VAT: jednym kliknięciem ze zlecenia albo ręcznie.
  Pozycje z automatycznym liczeniem netto / VAT / brutto, rozbicie na stawki VAT,
  kwota słownie, wydruk do PDF, oznaczanie jako opłacona.
- **Ustawienia** — dane firmy (sprzedawcy na fakturach), numeracja, wartości domyślne,
  kopia zapasowa (eksport/import) danych.

Dane sprzedawcy są wstępnie uzupełnione danymi NT Cargo Sp. z o.o.
(NIP 6423186618, al. Armii Krajowej 53, 50-541 Wrocław). Uzupełnij jeszcze **numer konta bankowego**
w zakładce *Ustawienia*, aby pojawiał się na fakturach.

---

## Jak uruchomić

**Najprościej:** otwórz plik `index.html` w przeglądarce (dwuklik).

**Online (GitHub Pages):** repozytorium można opublikować jako stronę — wtedy aplikacja
jest dostępna pod adresem `https://<użytkownik>.github.io/a-la-winsped/` i działa z każdego
urządzenia (dane i tak są zapisywane w danej przeglądarce).

---

## Ważne — kopia zapasowa

Dane są przechowywane **tylko w tej przeglądarce, na tym komputerze**. Wyczyszczenie danych
przeglądarki lub praca na innym komputerze = brak dostępu do wcześniejszych danych.
Dlatego regularnie klikaj **„Kopia zapasowa"** (panel boczny lub *Ustawienia*), aby pobrać
plik `.json`. Ten plik można wczytać na innym komputerze (*Ustawienia → Wczytaj kopię z pliku*).

---

## KSeF (Krajowy System e-Faktur)

Od **1 lutego 2026 r.** faktury B2B w Polsce muszą być wystawiane w KSeF.
Ta aplikacja generuje **wydruk pomocniczy faktury** ze wszystkimi wymaganymi danymi
(art. 106e ustawy o VAT). Wysyłkę do KSeF należy wykonać w programie księgowym —
integracja z KSeF może zostać dodana w kolejnej wersji.

---

## Dla technicznych

Czysty HTML + CSS + JavaScript (bez frameworków i bez kroku budowania). Struktura:

```
index.html            szkielet + kolejność skryptów
styles.css            motyw (dark) + arkusz wydruku faktury (A4)
js/
  utils.js            formatowanie, VAT, walidacja NIP, kwota słownie
  store.js            warstwa danych (localStorage), numeracja, dane startowe
  ui.js               modale, powiadomienia, statusy, budowa formularzy
  print.js            szablony wydruku (faktura, zlecenie)
  gus.js              auto-pobieranie danych firmy po NIP (API Białej listy MF)
  views_*.js          widoki: pulpit, kontrahenci, zlecenia, faktury, ustawienia
  app.js              router (hash) + inicjalizacja
```
