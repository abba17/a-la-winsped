/* ============================================================
   utils.js — funkcje pomocnicze (formatowanie, VAT, walidacja, słownie)
   Wszystko pod globalnym App.utils
   ============================================================ */
window.App = window.App || {};

App.utils = (function () {
  "use strict";

  /* ---------- Identyfikatory ---------- */
  function uid(prefix) {
    return (prefix || "id") + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /* ---------- Liczby / zaokrąglanie ---------- */
  function round2(n) {
    // Zaokrąglenie do 2 miejsc, odporne na błędy zmiennoprzecinkowe
    return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  }
  function toNumber(v) {
    if (typeof v === "number") return isFinite(v) ? v : 0;
    if (v == null) return 0;
    const s = String(v).replace(/\s/g, "").replace(",", ".").replace(/[^0-9.\-]/g, "");
    const n = parseFloat(s);
    return isFinite(n) ? n : 0;
  }

  /* ---------- Formatowanie kwot ---------- */
  const _plnFmt = new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function formatKwota(n) { return _plnFmt.format(round2(n)); }         // 1 234,56
  function formatPLN(n) { return formatKwota(n) + " zł"; }             // 1 234,56 zł
  function formatMoney(n, waluta) {
    waluta = waluta || "PLN";
    if (waluta === "PLN") return formatPLN(n);
    return formatKwota(n) + " " + waluta;
  }

  /* ---------- Daty (przechowywane jako 'YYYY-MM-DD') ---------- */
  function todayISO() {
    const d = new Date();
    return isoFromDate(d);
  }
  function isoFromDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }
  function formatDate(iso) {
    if (!iso) return "—";
    const p = String(iso).split("-");
    if (p.length !== 3) return iso;
    return p[2] + "." + p[1] + "." + p[0]; // DD.MM.YYYY
  }
  function addDays(iso, days) {
    const d = iso ? new Date(iso + "T00:00:00") : new Date();
    d.setDate(d.getDate() + Number(days || 0));
    return isoFromDate(d);
  }
  function daysBetween(isoA, isoB) {
    if (!isoA || !isoB) return 0;
    const a = new Date(isoA + "T00:00:00"), b = new Date(isoB + "T00:00:00");
    return Math.round((b - a) / 86400000);
  }
  function monthKey(iso) { return iso ? iso.slice(0, 7) : ""; }        // YYYY-MM
  function monthLabelShort(ym) {
    const names = ["sty","lut","mar","kwi","maj","cze","lip","sie","wrz","paź","lis","gru"];
    const p = String(ym).split("-");
    if (p.length < 2) return ym;
    return names[parseInt(p[1], 10) - 1] + " " + p[0].slice(2);
  }

  /* ---------- Walidacja NIP (suma kontrolna) ---------- */
  function cleanNIP(nip) { return String(nip || "").replace(/[^0-9]/g, ""); }
  function isValidNIP(nip) {
    const d = cleanNIP(nip);
    if (d.length !== 10) return false;
    const w = [6, 5, 7, 2, 3, 4, 5, 6, 7];
    let s = 0;
    for (let i = 0; i < 9; i++) s += parseInt(d[i], 10) * w[i];
    const c = s % 11;
    if (c === 10) return false;
    return c === parseInt(d[9], 10);
  }
  function formatNIP(nip) {
    const d = cleanNIP(nip);
    if (d.length !== 10) return nip || "";
    return d.slice(0, 3) + "-" + d.slice(3, 6) + "-" + d.slice(6, 8) + "-" + d.slice(8);
  }

  /* ---------- Bezpieczne wstawianie tekstu do HTML ---------- */
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  /* ---------- VAT ---------- */
  // stawka jako liczba (23, 8, 5, 0) albo 'zw' (zwolniona) / 'np' (nie podlega)
  function vatRate(stawka) {
    if (stawka === "zw" || stawka === "np" || stawka === "oo") return 0;
    const n = toNumber(stawka);
    return isFinite(n) ? n : 0;
  }
  function vatLabel(stawka) {
    if (stawka === "zw") return "zw.";
    if (stawka === "np") return "np.";
    if (stawka === "oo") return "o.o."; // odwrotne obciążenie
    return vatRate(stawka) + "%";
  }
  // Pozycja: ilosc * cenaNetto => netto; vat; brutto
  function liczPozycja(ilosc, cenaNetto, stawka) {
    const netto = round2(toNumber(ilosc) * toNumber(cenaNetto));
    const kwotaVat = round2(netto * vatRate(stawka) / 100);
    const brutto = round2(netto + kwotaVat);
    return { netto: netto, kwotaVat: kwotaVat, brutto: brutto };
  }
  // Podsumowanie faktury + rozbicie na stawki VAT
  function podsumujPozycje(pozycje) {
    const byRate = {};
    let netto = 0, vat = 0, brutto = 0;
    (pozycje || []).forEach(function (p) {
      const w = liczPozycja(p.ilosc, p.cenaNetto, p.stawkaVat);
      netto = round2(netto + w.netto);
      vat = round2(vat + w.kwotaVat);
      brutto = round2(brutto + w.brutto);
      const key = String(p.stawkaVat);
      if (!byRate[key]) byRate[key] = { stawka: p.stawkaVat, netto: 0, vat: 0, brutto: 0 };
      byRate[key].netto = round2(byRate[key].netto + w.netto);
      byRate[key].vat = round2(byRate[key].vat + w.kwotaVat);
      byRate[key].brutto = round2(byRate[key].brutto + w.brutto);
    });
    return { netto: netto, vat: vat, brutto: brutto, byRate: Object.values(byRate) };
  }

  /* ---------- Kwota słownie (PLN) ---------- */
  const _jed = ["zero","jeden","dwa","trzy","cztery","pięć","sześć","siedem","osiem","dziewięć"];
  const _nast = ["dziesięć","jedenaście","dwanaście","trzynaście","czternaście","piętnaście","szesnaście","siedemnaście","osiemnaście","dziewiętnaście"];
  const _dzie = ["","","dwadzieścia","trzydzieści","czterdzieści","pięćdziesiąt","sześćdziesiąt","siedemdziesiąt","osiemdziesiąt","dziewięćdziesiąt"];
  const _set = ["","sto","dwieście","trzysta","czterysta","pięćset","sześćset","siedemset","osiemset","dziewięćset"];
  const _grupy = [
    ["", "", ""],
    ["tysiąc", "tysiące", "tysięcy"],
    ["milion", "miliony", "milionów"],
    ["miliard", "miliardy", "miliardów"]
  ];
  function _triada(n) { // 0..999 -> słowa
    const out = [];
    const s = Math.floor(n / 100);
    const d = Math.floor((n % 100) / 10);
    const j = n % 10;
    if (s > 0) out.push(_set[s]);
    if (d === 1) { out.push(_nast[j]); }
    else {
      if (d > 1) out.push(_dzie[d]);
      if (j > 0) out.push(_jed[j]);
    }
    return out.join(" ");
  }
  function _formaGrupy(n, formy) {
    if (n === 1) return formy[0];
    const d = n % 100;
    const j = n % 10;
    if (j >= 2 && j <= 4 && !(d >= 12 && d <= 14)) return formy[1];
    return formy[2];
  }
  function liczbaSlownie(num) {
    num = Math.floor(Math.abs(Number(num) || 0));
    if (num === 0) return "zero";
    const triady = [];
    let n = num;
    while (n > 0) { triady.push(n % 1000); n = Math.floor(n / 1000); }
    const parts = [];
    for (let i = triady.length - 1; i >= 0; i--) {
      const t = triady[i];
      if (t === 0) continue;
      const slowa = _triada(t);
      const nazwa = _grupy[i] ? _formaGrupy(t, _grupy[i]) : "";
      // "jeden tysiąc" -> "tysiąc"
      if (i > 0 && t === 1) parts.push(nazwa);
      else parts.push((slowa + (nazwa ? " " + nazwa : "")).trim());
    }
    return parts.join(" ").replace(/\s+/g, " ").trim();
  }
  function kwotaSlownie(kwota) {
    const zl = Math.floor(round2(kwota));
    const gr = Math.round((round2(kwota) - zl) * 100);
    const zlSlowo = _formaGrupy(zl, ["złoty", "złote", "złotych"]);
    return liczbaSlownie(zl) + " " + zlSlowo + " " + String(gr).padStart(2, "0") + "/100";
  }

  /* ---------- Różne ---------- */
  function debounce(fn, ms) {
    let t; return function () { const a = arguments, c = this; clearTimeout(t); t = setTimeout(function () { fn.apply(c, a); }, ms || 200); };
  }
  function download(filename, text, mime) {
    const blob = new Blob([text], { type: mime || "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
  }
  function pluralPl(n, f1, f2, f5) {
    n = Math.abs(n);
    if (n === 1) return f1;
    const d = n % 100, j = n % 10;
    if (j >= 2 && j <= 4 && !(d >= 12 && d <= 14)) return f2;
    return f5;
  }

  return {
    uid: uid, round2: round2, toNumber: toNumber,
    formatKwota: formatKwota, formatPLN: formatPLN, formatMoney: formatMoney,
    todayISO: todayISO, isoFromDate: isoFromDate, formatDate: formatDate, addDays: addDays,
    daysBetween: daysBetween, monthKey: monthKey, monthLabelShort: monthLabelShort,
    cleanNIP: cleanNIP, isValidNIP: isValidNIP, formatNIP: formatNIP,
    esc: esc, vatRate: vatRate, vatLabel: vatLabel, liczPozycja: liczPozycja, podsumujPozycje: podsumujPozycje,
    liczbaSlownie: liczbaSlownie, kwotaSlownie: kwotaSlownie,
    debounce: debounce, download: download, pluralPl: pluralPl
  };
})();
