/* ============================================================
   gus.js — automatyczne pobieranie danych firmy po NIP. App.gus
   Źródło: Wykaz podatników VAT (Biała lista) Ministerstwa Finansów.
   Darmowe, bez klucza API, wspiera CORS (działa z przeglądarki).
   Dokumentacja: https://wl-api.mf.gov.pl/
   ============================================================ */
window.App = window.App || {};

App.gus = (function () {
  "use strict";
  const U = App.utils;
  const ENDPOINT = "https://wl-api.mf.gov.pl/api/search/nip/";

  // "ŻYCZLIWA 23/2, 53-030 WROCŁAW" -> { ulica, kod, miasto }
  function parseAdres(addr) {
    const out = { ulica: "", kod: "", miasto: "" };
    if (!addr) return out;
    const parts = String(addr).split(",");
    out.ulica = tytulPl((parts[0] || "").trim());
    const reszta = parts.slice(1).join(",").trim();
    const m = reszta.match(/(\d{2}-\d{3})\s*(.*)/);
    if (m) { out.kod = m[1]; out.miasto = tytulPl(m[2].trim()); }
    else { out.miasto = tytulPl(reszta); }
    return out;
  }

  // Delikatne ładne wielkości liter dla ulic/miast (rejestr zwraca WERSALIKI)
  function tytulPl(s) {
    return String(s || "").toLowerCase().replace(/(^|[\s\-\/.])([a-ząćęłńóśźż])/g,
      function (m, p1, p2) { return p1 + p2.toUpperCase(); });
  }

  // Skrócenie formy prawnej w nazwie ("SPÓŁKA Z OGRANICZONĄ..." -> "Sp. z o.o.")
  function skrocForme(n) {
    return String(n || "")
      .replace(/SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ/gi, "Sp. z o.o.")
      .replace(/SPÓŁKA KOMANDYTOWO-AKCYJNA/gi, "S.K.A.")
      .replace(/SPÓŁKA AKCYJNA/gi, "S.A.")
      .replace(/SPÓŁKA KOMANDYTOWA/gi, "sp.k.")
      .replace(/SPÓŁKA JAWNA/gi, "sp.j.")
      .replace(/SPÓŁKA PARTNERSKA/gi, "sp.p.")
      .replace(/SPÓŁKA CYWILNA/gi, "s.c.")
      .replace(/\s+/g, " ").trim();
  }

  // 26 cyfr -> "NN NNNN NNNN NNNN NNNN NNNN NNNN"
  function formatKonto(raw) {
    const d = String(raw || "").replace(/\D/g, "");
    if (d.length !== 26) return raw || "";
    return (d.slice(0, 2) + " " + d.slice(2).replace(/(.{4})/g, "$1 ")).trim();
  }

  // Zwraca Promise z obiektem danych firmy albo odrzuca z czytelnym komunikatem
  function pobierzPoNip(nip) {
    const d = U.cleanNIP(nip);
    if (d.length !== 10 || /[A-Za-z]/.test(String(nip))) {
      return Promise.reject(new Error("Auto-pobieranie działa dla polskich, 10-cyfrowych numerów NIP."));
    }
    if (!U.isValidNIP(d)) {
      return Promise.reject(new Error("NIP ma błędną sumę kontrolną — sprawdź numer."));
    }
    const url = ENDPOINT + d + "?date=" + U.todayISO();
    return fetch(url)
      .then(function (r) {
        if (r.status === 400) throw new Error("Rejestr odrzucił zapytanie (sprawdź NIP).");
        if (!r.ok) throw new Error("Usługa rejestru chwilowo niedostępna (HTTP " + r.status + ").");
        return r.json();
      })
      .then(function (j) {
        const s = j && j.result && j.result.subject;
        if (!s) throw new Error("Nie znaleziono firmy o tym NIP w rejestrze VAT.");
        const adr = parseAdres(s.workingAddress || s.residenceAddress || "");
        const konta = s.accountNumbers || [];
        return {
          nazwa: skrocForme(s.name || ""),
          nazwaPelna: s.name || "",
          nip: s.nip || d,
          regon: s.regon || "",
          krs: s.krs || "",
          ulica: adr.ulica, kod: adr.kod, miasto: adr.miasto, kraj: "Polska",
          statusVat: s.statusVat || "",
          konta: konta,
          kontoGlowne: konta.length ? formatKonto(konta[0]) : ""
        };
      })
      .catch(function (e) {
        // Rozróżnienie błędu sieci/CORS od błędów logicznych
        if (e instanceof TypeError) throw new Error("Brak połączenia z rejestrem (sprawdź internet). Możesz wpisać dane ręcznie.");
        throw e;
      });
  }

  return { pobierzPoNip: pobierzPoNip, formatKonto: formatKonto };
})();
