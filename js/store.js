/* ============================================================
   store.js — warstwa danych (localStorage). App.store
   Struktura bazy:
   {
     wersja, ustawienia, liczniki:{zlecenia:{2026:N}, faktury:{2026:N}},
     kontrahenci:[], zlecenia:[], faktury:[]
   }
   ============================================================ */
window.App = window.App || {};

App.store = (function () {
  "use strict";
  const KEY = "alawinsped_db_v1";
  const U = App.utils;
  let db = null;

  /* ---------- Domyślne ustawienia (dane sprzedawcy = NT Cargo) ---------- */
  function domyslneUstawienia() {
    return {
      firma: {
        nazwa: "NT Cargo Sp. z o.o.",
        nip: "6423186618",
        regon: "243579629",
        krs: "0000510587",
        ulica: "al. Armii Krajowej 53",
        kod: "50-541",
        miasto: "Wrocław",
        kraj: "Polska",
        email: "biuro@ntcargo.pl",
        telefon: "+48 607 139 701",
        www: "ntcargo.pl",
        bank: "",
        numerKonta: ""
      },
      faktura: {
        prefix: "FV",
        domyslnaStawkaVat: "23",
        terminPlatnosciDni: 14,
        sposobPlatnosci: "Przelew",
        domyslnaJednostka: "usługa",
        domyslnyOpis: "Usługa transportowa",
        uwagi: ""
      },
      zlecenie: {
        prefix: "ZL",
        domyslnaWaluta: "PLN"
      }
    };
  }

  function pustaBaza() {
    return {
      wersja: 1,
      ustawienia: domyslneUstawienia(),
      liczniki: { zlecenia: {}, faktury: {} },
      kontrahenci: [],
      zlecenia: [],
      faktury: []
    };
  }

  /* ---------- Wczytywanie / zapis ---------- */
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) { db = JSON.parse(raw); _migruj(); }
      else { db = pustaBaza(); seedDemo(); save(); }
    } catch (e) {
      console.error("Błąd wczytywania bazy:", e);
      db = pustaBaza();
    }
    return db;
  }
  function _migruj() {
    // Uzupełnienie brakujących pól po ewentualnej zmianie struktury
    const def = pustaBaza();
    if (!db.ustawienia) db.ustawienia = def.ustawienia;
    if (!db.ustawienia.firma) db.ustawienia.firma = def.ustawienia.firma;
    if (!db.ustawienia.faktura) db.ustawienia.faktura = def.ustawienia.faktura;
    if (!db.ustawienia.zlecenie) db.ustawienia.zlecenie = def.ustawienia.zlecenie;
    if (!db.liczniki) db.liczniki = { zlecenia: {}, faktury: {} };
    if (!db.liczniki.zlecenia) db.liczniki.zlecenia = {};
    if (!db.liczniki.faktury) db.liczniki.faktury = {};
    ["kontrahenci", "zlecenia", "faktury"].forEach(function (k) { if (!Array.isArray(db[k])) db[k] = []; });
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(db)); }
    catch (e) { console.error("Błąd zapisu:", e); alert("Nie udało się zapisać danych (pamięć przeglądarki pełna?)."); }
  }
  function reset() { db = pustaBaza(); save(); }
  function resetWithDemo() { db = pustaBaza(); seedDemo(); save(); }

  /* ---------- Eksport / import ---------- */
  function exportJSON() { return JSON.stringify(db, null, 2); }
  function importJSON(text) {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object") throw new Error("Nieprawidłowy plik.");
    db = parsed; _migruj(); save();
  }

  /* ---------- Dostęp do kolekcji ---------- */
  function all(col) { return (db[col] || []).slice(); }
  function get(col, id) { return (db[col] || []).find(function (x) { return x.id === id; }) || null; }
  function upsert(col, obj) {
    if (!obj.id) { obj.id = U.uid(col.slice(0, 3)); obj.createdAt = new Date().toISOString(); }
    const arr = db[col] || (db[col] = []);
    const i = arr.findIndex(function (x) { return x.id === obj.id; });
    obj.updatedAt = new Date().toISOString();
    if (i >= 0) arr[i] = obj; else arr.unshift(obj);
    save();
    return obj;
  }
  function remove(col, id) {
    db[col] = (db[col] || []).filter(function (x) { return x.id !== id; });
    save();
  }

  function ustawienia() { return db.ustawienia; }
  function zapiszUstawienia(u) { db.ustawienia = u; save(); }

  /* ---------- Numeracja ---------- */
  function _rok() { return new Date().getFullYear(); }
  function podejrzyjNumerZlecenia() {
    const rok = _rok();
    const n = (db.liczniki.zlecenia[rok] || 0) + 1;
    return _formatNumer(db.ustawienia.zlecenie.prefix || "ZL", n, rok);
  }
  function nadajNumerZlecenia() {
    const rok = _rok();
    const n = (db.liczniki.zlecenia[rok] || 0) + 1;
    db.liczniki.zlecenia[rok] = n;
    save();
    return _formatNumer(db.ustawienia.zlecenie.prefix || "ZL", n, rok);
  }
  function podejrzyjNumerFaktury() {
    const rok = _rok();
    const n = (db.liczniki.faktury[rok] || 0) + 1;
    return _formatNumer(db.ustawienia.faktura.prefix || "FV", n, rok);
  }
  function nadajNumerFaktury() {
    const rok = _rok();
    const n = (db.liczniki.faktury[rok] || 0) + 1;
    db.liczniki.faktury[rok] = n;
    save();
    return _formatNumer(db.ustawienia.faktura.prefix || "FV", n, rok);
  }
  function _formatNumer(prefix, n, rok) {
    return prefix + "/" + String(n).padStart(4, "0") + "/" + rok;
  }

  /* ---------- Dane przykładowe ---------- */
  function seedDemo() {
    const k1 = { id: U.uid("kon"), typ: "klient", nazwa: "Alpha Logistics Sp. z o.o.", nip: "5213003700",
      ulica: "ul. Prosta 51", kod: "00-838", miasto: "Warszawa", kraj: "Polska",
      email: "zlecenia@alphalogistics.pl", telefon: "+48 22 100 20 30", osoba: "Marta Kowalska", uwagi: "", createdAt: new Date().toISOString() };
    const k2 = { id: U.uid("kon"), typ: "klient", nazwa: "BuildMax GmbH", nip: "DE812345678",
      ulica: "Industriestraße 12", kod: "10115", miasto: "Berlin", kraj: "Niemcy",
      email: "dispo@buildmax.de", telefon: "+49 30 555 12 12", osoba: "Hans Weber", uwagi: "Płatność 30 dni", createdAt: new Date().toISOString() };
    const k3 = { id: U.uid("kon"), typ: "przewoznik", nazwa: "Trans-Byk Jan Bykowski", nip: "8991234567",
      ulica: "ul. Długa 8", kod: "51-100", miasto: "Wrocław", kraj: "Polska",
      email: "biuro@transbyk.pl", telefon: "+48 601 222 333", osoba: "Jan Bykowski", uwagi: "Podwykonawca — plandeka", createdAt: new Date().toISOString() };
    db.kontrahenci.push(k1, k2, k3);

    const today = U.todayISO();
    const z1n = nadajNumerZlecenia();
    const z1 = {
      id: U.uid("zle"), numer: z1n, status: "zrealizowane",
      dataUtworzenia: U.addDays(today, -12), dataZaladunku: U.addDays(today, -10), dataRozladunku: U.addDays(today, -9),
      zleceniodawcaId: k1.id, przewoznikId: k3.id,
      zaladunek: { firma: "Magazyn Alpha", adres: "ul. Prosta 51", kod: "00-838", miasto: "Warszawa", kraj: "Polska", data: U.addDays(today, -10), godziny: "08:00-12:00" },
      rozladunek: { firma: "Sklep Centralny", adres: "ul. Piłsudskiego 5", kod: "31-110", miasto: "Kraków", kraj: "Polska", data: U.addDays(today, -9), godziny: "10:00-14:00" },
      ladunek: { opis: "Palety EUR — art. spożywcze", rodzaj: "Plandeka", waga: 12000, ilosc: 12, jednostka: "pal", ldm: 6, wymogi: "" },
      pojazd: { nrRej: "DW 12345 / DW 678", kierowca: "Piotr Zieliński", telefon: "+48 605 111 222", typ: "Ciągnik + naczepa" },
      fracht: { sprzedaz: 4200, zakup: 3100, waluta: "PLN", stawkaVat: "23" },
      warunki: { terminPlatnosci: 14, sposobPlatnosci: "Przelew", uwagi: "" },
      fakturaId: null
    };
    const z2n = nadajNumerZlecenia();
    const z2 = {
      id: U.uid("zle"), numer: z2n, status: "w_realizacji",
      dataUtworzenia: U.addDays(today, -2), dataZaladunku: today, dataRozladunku: U.addDays(today, 2),
      zleceniodawcaId: k2.id, przewoznikId: null,
      zaladunek: { firma: "Zakład BuildMax", adres: "Industriestraße 12", kod: "10115", miasto: "Berlin", kraj: "Niemcy", data: today, godziny: "07:00-15:00" },
      rozladunek: { firma: "Plac budowy A2", adres: "ul. Poznańska 100", kod: "62-020", miasto: "Swarzędz", kraj: "Polska", data: U.addDays(today, 2), godziny: "08:00-16:00" },
      ladunek: { opis: "Konstrukcje stalowe", rodzaj: "Plandeka / niskopodwoziowa", waga: 22000, ilosc: 1, jednostka: "kpl", ldm: 13.6, wymogi: "Ponadgabaryt — szerokość 3,1 m" },
      pojazd: { nrRej: "DW 99001", kierowca: "Andrzej Nowak", telefon: "+48 606 333 444", typ: "Zestaw niskopodwoziowy" },
      fracht: { sprzedaz: 1850, zakup: 0, waluta: "EUR", stawkaVat: "23" },
      warunki: { terminPlatnosci: 30, sposobPlatnosci: "Przelew", uwagi: "Odprawa celna po stronie klienta" },
      fakturaId: null
    };
    const z3n = nadajNumerZlecenia();
    const z3 = {
      id: U.uid("zle"), numer: z3n, status: "nowe",
      dataUtworzenia: today, dataZaladunku: U.addDays(today, 3), dataRozladunku: U.addDays(today, 3),
      zleceniodawcaId: k1.id, przewoznikId: null,
      zaladunek: { firma: "Magazyn Alpha", adres: "ul. Prosta 51", kod: "00-838", miasto: "Warszawa", kraj: "Polska", data: U.addDays(today, 3), godziny: "06:00-10:00" },
      rozladunek: { firma: "DC Wrocław", adres: "ul. Logistyczna 1", kod: "55-040", miasto: "Kobierzyce", kraj: "Polska", data: U.addDays(today, 3), godziny: "12:00-18:00" },
      ladunek: { opis: "Elektronika użytkowa", rodzaj: "Plandeka", waga: 8000, ilosc: 20, jednostka: "pal", ldm: 10, wymogi: "ADR: nie" },
      pojazd: { nrRej: "", kierowca: "", telefon: "", typ: "" },
      fracht: { sprzedaz: 2600, zakup: 0, waluta: "PLN", stawkaVat: "23" },
      warunki: { terminPlatnosci: 14, sposobPlatnosci: "Przelew", uwagi: "" },
      fakturaId: null
    };
    db.zlecenia.push(z1, z2, z3);

    // Faktura wystawiona ze zlecenia z1
    const fn = nadajNumerFaktury();
    const dataWyst = U.addDays(today, -9);
    const poz = [{ nazwa: "Usługa transportowa Warszawa → Kraków (" + z1n + ")", ilosc: 1, jednostka: "usługa", cenaNetto: 4200, stawkaVat: "23" }];
    const sumy = U.podsumujPozycje(poz);
    const f1 = {
      id: U.uid("fak"), numer: fn, status: "oplacona",
      dataWystawienia: dataWyst, dataSprzedazy: z1.dataRozladunku, terminPlatnosci: U.addDays(dataWyst, 14),
      miejsceWystawienia: "Wrocław",
      nabywcaId: k1.id,
      nabywca: _snapshotNabywca(k1),
      sprzedawca: _snapshotSprzedawca(),
      pozycje: poz, podsumowanie: sumy,
      sposobPlatnosci: "Przelew", numerKonta: db.ustawienia.firma.numerKonta || "",
      waluta: "PLN", uwagi: "", zlecenieId: z1.id, kwotaZaplacona: sumy.brutto
    };
    db.faktury.push(f1);
    z1.fakturaId = f1.id;
  }

  function _snapshotSprzedawca() {
    const f = db.ustawienia.firma;
    return { nazwa: f.nazwa, nip: f.nip, regon: f.regon, ulica: f.ulica, kod: f.kod, miasto: f.miasto, kraj: f.kraj,
      email: f.email, telefon: f.telefon, bank: f.bank, numerKonta: f.numerKonta };
  }
  function _snapshotNabywca(k) {
    return { nazwa: k.nazwa, nip: k.nip, ulica: k.ulica, kod: k.kod, miasto: k.miasto, kraj: k.kraj,
      email: k.email, telefon: k.telefon };
  }

  return {
    load: load, save: save, reset: reset, resetWithDemo: resetWithDemo,
    exportJSON: exportJSON, importJSON: importJSON,
    all: all, get: get, upsert: upsert, remove: remove,
    ustawienia: ustawienia, zapiszUstawienia: zapiszUstawienia,
    podejrzyjNumerZlecenia: podejrzyjNumerZlecenia, nadajNumerZlecenia: nadajNumerZlecenia,
    podejrzyjNumerFaktury: podejrzyjNumerFaktury, nadajNumerFaktury: nadajNumerFaktury,
    snapshotSprzedawca: _snapshotSprzedawca, snapshotNabywca: _snapshotNabywca
  };
})();
