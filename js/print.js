/* ============================================================
   print.js — szablony wydruku (faktura VAT, zlecenie transportowe)
   App.print. Renderuje HTML do #printArea i wywołuje window.print().
   ============================================================ */
window.App = window.App || {};

App.print = (function () {
  "use strict";
  const U = App.utils;

  function _ensureArea() {
    let a = document.getElementById("printArea");
    if (!a) { a = document.createElement("div"); a.id = "printArea"; document.body.appendChild(a); }
    return a;
  }

  function _slownieKwota(kwota, waluta) {
    if (!waluta || waluta === "PLN") return U.kwotaSlownie(kwota);
    const zl = Math.floor(U.round2(kwota));
    const gr = Math.round((U.round2(kwota) - zl) * 100);
    return U.liczbaSlownie(zl) + " " + waluta + " " + String(gr).padStart(2, "0") + "/100";
  }

  function _partyBlock(p) {
    if (!p) return "";
    const linie = [];
    linie.push('<p class="name">' + U.esc(p.nazwa || "") + '</p>');
    if (p.ulica) linie.push('<p>' + U.esc(p.ulica) + '</p>');
    if (p.kod || p.miasto) linie.push('<p>' + U.esc((p.kod || "") + " " + (p.miasto || "")).trim() + (p.kraj && p.kraj !== "Polska" ? ", " + U.esc(p.kraj) : "") + '</p>');
    if (p.nip) linie.push('<p><b>NIP:</b> ' + U.esc(p.nip) + '</p>');
    if (p.regon) linie.push('<p><b>REGON:</b> ' + U.esc(p.regon) + '</p>');
    return linie.join("");
  }

  /* ---------------- FAKTURA VAT ---------------- */
  function faktura(f, opcje) {
    opcje = opcje || {};
    const money = function (n) { return U.formatMoney(n, f.waluta || "PLN"); };
    const s = f.sprzedawca || {};
    const n = f.nabywca || {};
    const sumy = f.podsumowanie || U.podsumujPozycje(f.pozycje);

    const wiersze = (f.pozycje || []).map(function (p, i) {
      const w = U.liczPozycja(p.ilosc, p.cenaNetto, p.stawkaVat);
      return '<tr>' +
        '<td class="c">' + (i + 1) + '</td>' +
        '<td>' + U.esc(p.nazwa) + '</td>' +
        '<td class="c">' + U.formatKwota(p.ilosc).replace(/,00$/, "") + '</td>' +
        '<td class="c">' + U.esc(p.jednostka || "usługa") + '</td>' +
        '<td class="r">' + U.formatKwota(p.cenaNetto) + '</td>' +
        '<td class="r">' + U.formatKwota(w.netto) + '</td>' +
        '<td class="c">' + U.vatLabel(p.stawkaVat) + '</td>' +
        '<td class="r">' + U.formatKwota(w.kwotaVat) + '</td>' +
        '<td class="r">' + U.formatKwota(w.brutto) + '</td>' +
        '</tr>';
    }).join("");

    const vatRows = (sumy.byRate || []).map(function (r) {
      return '<tr><td>' + U.vatLabel(r.stawka) + '</td><td>' + U.formatKwota(r.netto) + '</td>' +
        '<td>' + U.formatKwota(r.vat) + '</td><td>' + U.formatKwota(r.brutto) + '</td></tr>';
    }).join("");

    const zaplacono = U.round2(f.kwotaZaplacona || 0);
    const doZaplaty = U.round2(sumy.brutto - zaplacono);

    const html =
      '<div class="doc">' +
        '<div class="doc-head">' +
          '<div>' +
            '<div class="seller-logo">' + U.esc(s.nazwa || "") + '</div>' +
            '<div style="font-size:11px;color:#555;margin-top:2px">' + U.esc(s.ulica || "") + ', ' + U.esc((s.kod || "") + " " + (s.miasto || "")) + '</div>' +
          '</div>' +
          '<div class="meta">' +
            '<h1>Faktura VAT</h1>' +
            '<div style="margin-top:4px"><b>Nr ' + U.esc(f.numer) + '</b></div>' +
            '<div>Data wystawienia: <b>' + U.formatDate(f.dataWystawienia) + '</b></div>' +
            '<div>Data sprzedaży: <b>' + U.formatDate(f.dataSprzedazy || f.dataWystawienia) + '</b></div>' +
            (f.miejsceWystawienia ? '<div>Miejsce: ' + U.esc(f.miejsceWystawienia) + '</div>' : "") +
          '</div>' +
        '</div>' +

        '<div class="parties">' +
          '<div class="party"><h4>Sprzedawca</h4>' + _partyBlock(s) +
            (s.email ? '<p>' + U.esc(s.email) + '</p>' : "") +
            (s.telefon ? '<p>' + U.esc(s.telefon) + '</p>' : "") + '</div>' +
          '<div class="party"><h4>Nabywca</h4>' + _partyBlock(n) + '</div>' +
        '</div>' +

        '<table class="items">' +
          '<thead><tr>' +
            '<th class="c">Lp.</th><th>Nazwa towaru / usługi</th><th class="c">Ilość</th><th class="c">J.m.</th>' +
            '<th class="r">Cena netto</th><th class="r">Wartość netto</th><th class="c">VAT</th>' +
            '<th class="r">Kwota VAT</th><th class="r">Wartość brutto</th>' +
          '</tr></thead>' +
          '<tbody>' + wiersze + '</tbody>' +
        '</table>' +

        '<div style="display:flex;justify-content:space-between;gap:24px;align-items:flex-start">' +
          '<table class="vat-break"><thead><tr><th>Stawka</th><th>Netto</th><th>VAT</th><th>Brutto</th></tr></thead>' +
            '<tbody>' + vatRows + '</tbody></table>' +
          '<div class="totals"><table>' +
            '<tr><td>Razem netto:</td><td class="r" style="text-align:right">' + money(sumy.netto) + '</td></tr>' +
            '<tr><td>Razem VAT:</td><td class="r" style="text-align:right">' + money(sumy.vat) + '</td></tr>' +
            '<tr class="sum"><td>Razem brutto:</td><td class="r" style="text-align:right">' + money(sumy.brutto) + '</td></tr>' +
          '</table></div>' +
        '</div>' +

        '<div class="slownie">Słownie: <b>' + U.esc(_slownieKwota(sumy.brutto, f.waluta)) + '</b></div>' +

        '<div class="pay-info">' +
          '<div class="box"><h4>Płatność</h4>' +
            '<p><b>Sposób:</b> ' + U.esc(f.sposobPlatnosci || "Przelew") + '</p>' +
            '<p><b>Termin:</b> ' + U.formatDate(f.terminPlatnosci) + '</p>' +
            (f.numerKonta ? '<p><b>Nr konta:</b> ' + U.esc(f.numerKonta) + '</p>' : "") +
            (s.bank ? '<p><b>Bank:</b> ' + U.esc(s.bank) + '</p>' : "") +
          '</div>' +
          '<div class="box"><h4>Rozliczenie</h4>' +
            '<p><b>Do zapłaty:</b> ' + money(doZaplaty > 0 ? doZaplaty : sumy.brutto) + '</p>' +
            (zaplacono > 0 ? '<p><b>Zapłacono:</b> ' + money(zaplacono) + '</p>' : "") +
            (f.uwagi ? '<p style="color:#555">' + U.esc(f.uwagi) + '</p>' : "") +
          '</div>' +
        '</div>' +

        '<div class="doc-foot">' +
          '<div class="sign"><div class="line"></div>Imię, nazwisko i podpis osoby uprawnionej do wystawienia</div>' +
          '<div class="sign"><div class="line"></div>Imię, nazwisko i podpis osoby uprawnionej do odbioru</div>' +
        '</div>' +

        '<div class="ksef-note">Uwaga: od 1 lutego 2026 r. faktury B2B podlegają obowiązkowi wystawiania w Krajowym Systemie e-Faktur (KSeF). ' +
          'Ten dokument jest wydrukiem pomocniczym — wysyłkę do KSeF należy wykonać w systemie księgowym.</div>' +
      '</div>';

    if (opcje.returnHtml) return html;
    _drukuj(html);
  }

  /* ---------------- ZLECENIE TRANSPORTOWE ---------------- */
  function zlecenie(z, ctx, opcje) {
    opcje = opcje || {};
    ctx = ctx || {};
    const s = App.store.snapshotSprzedawca();
    const klient = ctx.klient;      // kontrahent (zleceniodawca)
    const przew = ctx.przewoznik;   // kontrahent (przewoźnik) lub null
    const wariant = opcje.wariant || (przew ? "przewoznik" : "klient");
    const zal = z.zaladunek || {}, roz = z.rozladunek || {}, lad = z.ladunek || {}, poj = z.pojazd || {}, fr = z.fracht || {};

    const naglowek = wariant === "przewoznik" ? "Zlecenie transportowe (dla przewoźnika)" : "Zlecenie / potwierdzenie transportu";
    const odbiorca = wariant === "przewoznik" ? (przew || {}) : (klient || {});
    const kwota = wariant === "przewoznik" ? fr.zakup : fr.sprzedaz;
    const kwotaLabel = wariant === "przewoznik" ? "Ustalony fracht (przewoźnik)" : "Wartość zlecenia";

    const html =
      '<div class="doc">' +
        '<div class="doc-head">' +
          '<div><div class="seller-logo">' + U.esc(s.nazwa) + '</div>' +
            '<div style="font-size:11px;color:#555;margin-top:2px">' + U.esc(s.ulica) + ', ' + U.esc(s.kod + " " + s.miasto) + ' · NIP ' + U.esc(s.nip) + '</div></div>' +
          '<div class="meta"><h1>Zlecenie</h1>' +
            '<div style="margin-top:4px"><b>Nr ' + U.esc(z.numer) + '</b></div>' +
            '<div>Data: <b>' + U.formatDate(z.dataUtworzenia) + '</b></div>' +
            '<div>' + U.esc(naglowek) + '</div></div>' +
        '</div>' +

        '<div class="parties">' +
          '<div class="party"><h4>Zleceniodawca</h4>' + _partyBlock(klient) + '</div>' +
          '<div class="party"><h4>' + (wariant === "przewoznik" ? "Przewoźnik" : "Organizator (NT Cargo)") + '</h4>' +
            _partyBlock(wariant === "przewoznik" ? przew : { nazwa: s.nazwa, nip: s.nip, ulica: s.ulica, kod: s.kod, miasto: s.miasto }) + '</div>' +
        '</div>' +

        '<div class="route">' +
          '<div class="leg"><h4>Załadunek</h4>' +
            '<p><b>' + U.esc(zal.firma || "") + '</b></p>' +
            '<p>' + U.esc(zal.adres || "") + '</p>' +
            '<p>' + U.esc((zal.kod || "") + " " + (zal.miasto || "")) + (zal.kraj ? ", " + U.esc(zal.kraj) : "") + '</p>' +
            '<p>Data: <b>' + U.formatDate(zal.data) + '</b> ' + U.esc(zal.godziny || "") + '</p>' +
          '</div>' +
          '<div class="leg"><h4>Rozładunek</h4>' +
            '<p><b>' + U.esc(roz.firma || "") + '</b></p>' +
            '<p>' + U.esc(roz.adres || "") + '</p>' +
            '<p>' + U.esc((roz.kod || "") + " " + (roz.miasto || "")) + (roz.kraj ? ", " + U.esc(roz.kraj) : "") + '</p>' +
            '<p>Data: <b>' + U.formatDate(roz.data) + '</b> ' + U.esc(roz.godziny || "") + '</p>' +
          '</div>' +
        '</div>' +

        '<div class="kv">' +
          _kv("Ładunek", lad.opis) +
          _kv("Rodzaj / nadwozie", lad.rodzaj) +
          _kv("Waga", lad.waga ? U.formatKwota(lad.waga).replace(/,00$/, "") + " kg" : "") +
          _kv("Ilość", (lad.ilosc ? lad.ilosc + " " + (lad.jednostka || "") : "") + (lad.ldm ? " · " + lad.ldm + " ldm" : "")) +
          _kv("Wymagania", lad.wymogi) +
          _kv("Pojazd / nr rej.", (poj.typ ? poj.typ + " · " : "") + (poj.nrRej || "")) +
          _kv("Kierowca", (poj.kierowca || "") + (poj.telefon ? ", tel. " + poj.telefon : "")) +
        '</div>' +

        '<div class="pay-info">' +
          '<div class="box"><h4>Warunki</h4>' +
            '<p><b>' + U.esc(kwotaLabel) + ':</b> ' + (kwota ? U.formatMoney(kwota, fr.waluta) : "—") + '</p>' +
            '<p><b>Termin płatności:</b> ' + U.esc((z.warunki && z.warunki.terminPlatnosci) || "—") + ' dni</p>' +
            '<p><b>Sposób płatności:</b> ' + U.esc((z.warunki && z.warunki.sposobPlatnosci) || "Przelew") + '</p>' +
          '</div>' +
          '<div class="box"><h4>Uwagi</h4><p>' + U.esc((z.warunki && z.warunki.uwagi) || "—") + '</p></div>' +
        '</div>' +

        '<div class="doc-foot">' +
          '<div class="sign"><div class="line"></div>Zlecający (NT Cargo)</div>' +
          '<div class="sign"><div class="line"></div>' + (wariant === "przewoznik" ? "Przewoźnik (przyjęcie zlecenia)" : "Zleceniodawca") + '</div>' +
        '</div>' +
        '<div class="note">Przyjęcie zlecenia następuje przez jego niezwłoczne potwierdzenie. Obowiązują ogólne warunki zlecenia transportowego / spedycyjnego.</div>' +
      '</div>';

    if (opcje.returnHtml) return html;
    _drukuj(html);
  }

  function _kv(k, v) {
    if (v == null || v === "") return "";
    return '<div class="row"><div class="k">' + U.esc(k) + '</div><div class="v">' + U.esc(v) + '</div></div>';
  }

  /* ---------------- Podgląd na ekranie (w modalu) ---------------- */
  function podgladHtml(html) {
    return '<div class="doc-preview">' + html + '</div>';
  }

  function _drukuj(html) {
    const area = _ensureArea();
    area.innerHTML = html;
    window.print();
  }

  return { faktura: faktura, zlecenie: zlecenie, podgladHtml: podgladHtml };
})();
