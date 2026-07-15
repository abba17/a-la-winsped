/* ============================================================
   views_zlecenia.js — Zlecenia transportowe. App.views.zlecenia
   Funkcje: render (lista), formularz (nowe/edycja), szczegoly
   ============================================================ */
window.App = window.App || {};
App.views = App.views || {};

App.views.zlecenia = (function () {
  "use strict";
  const U = App.utils, ui = App.ui, store = App.store;
  let filtr = { q: "", status: "wszystkie" };

  const WALUTY = ["PLN", "EUR"];
  const STAWKI_VAT = [
    { value: "23", label: "23%" }, { value: "8", label: "8%" },
    { value: "5", label: "5%" }, { value: "0", label: "0%" }, { value: "zw", label: "zw." }
  ];

  function klienciOpcje() {
    return store.all("kontrahenci").filter(function (k) { return k.typ !== "przewoznik"; })
      .map(function (k) { return { value: k.id, label: k.nazwa }; });
  }
  function przewoznicyOpcje() {
    return [{ value: "", label: "— brak / transport własny —" }].concat(
      store.all("kontrahenci").filter(function (k) { return k.typ === "przewoznik" || k.typ === "oba"; })
        .map(function (k) { return { value: k.id, label: k.nazwa }; }));
  }

  /* ==================== LISTA ==================== */
  function render(el) {
    ui.setPage("Zlecenia", '<a href="#/zlecenia/nowe" class="btn btn-primary">' + ui.icons.plus + 'Nowe zlecenie</a>');

    const wszystkie = store.all("zlecenia");
    const lista = filtruj(wszystkie);
    const kontr = store.all("kontrahenci");

    const statusy = ["wszystkie"].concat(Object.keys(ui.STATUSY_ZLECENIA));
    const chips = statusy.map(function (s) {
      const label = s === "wszystkie" ? "Wszystkie" : ui.STATUSY_ZLECENIA[s].label;
      const count = s === "wszystkie" ? wszystkie.length : wszystkie.filter(function (z) { return z.status === s; }).length;
      return '<div class="chip ' + (filtr.status === s ? "active" : "") + '" data-status="' + s + '">' + U.esc(label) + ' <span class="pill-count">' + count + '</span></div>';
    }).join("");

    el.innerHTML =
      '<div class="toolbar">' +
        '<div class="search">' + ui.icons.search +
          '<input class="input" id="szukaj" placeholder="Szukaj: numer, klient, miasto, ładunek…" value="' + U.esc(filtr.q) + '" />' +
        '</div>' +
      '</div>' +
      '<div class="chip-group mb-16">' + chips + '</div>' +
      (lista.length ? _tabela(lista, kontr) :
        ui.empty({ title: wszystkie.length ? "Brak wyników" : "Brak zleceń",
          text: wszystkie.length ? "Zmień filtry lub wyszukiwanie." : "Utwórz pierwsze zlecenie transportowe.",
          actionHtml: '<a href="#/zlecenia/nowe" class="btn btn-primary">' + ui.icons.plus + 'Nowe zlecenie</a>' }));

    const szukaj = document.getElementById("szukaj");
    szukaj.addEventListener("input", U.debounce(function () { filtr.q = szukaj.value; render(el); const s = document.getElementById("szukaj"); s.focus(); s.setSelectionRange(s.value.length, s.value.length); }, 200));
    el.querySelectorAll("[data-status]").forEach(function (c) {
      c.addEventListener("click", function () { filtr.status = c.getAttribute("data-status"); render(el); });
    });
    el.querySelectorAll("[data-open]").forEach(function (r) {
      r.addEventListener("click", function () { location.hash = "#/zlecenia/" + r.getAttribute("data-open"); });
    });
  }

  function filtruj(arr) {
    const q = filtr.q.trim().toLowerCase();
    return arr.filter(function (z) {
      if (filtr.status !== "wszystkie" && z.status !== filtr.status) return false;
      if (!q) return true;
      const k = store.get("kontrahenci", z.zleceniodawcaId);
      const hay = [z.numer, k ? k.nazwa : "", z.zaladunek && z.zaladunek.miasto, z.rozladunek && z.rozladunek.miasto,
        z.ladunek && z.ladunek.opis, z.pojazd && z.pojazd.nrRej].join(" ").toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }

  function _tabela(lista, kontr) {
    const rows = lista.map(function (z) {
      const k = kontr.find(function (c) { return c.id === z.zleceniodawcaId; });
      const trasa = ((z.zaladunek && z.zaladunek.miasto) || "?") + " → " + ((z.rozladunek && z.rozladunek.miasto) || "?");
      return '<tr data-open="' + z.id + '" style="cursor:pointer">' +
        '<td class="t-strong nowrap">' + U.esc(z.numer) + '</td>' +
        '<td>' + U.esc(k ? k.nazwa : "—") + '</td>' +
        '<td class="nowrap">' + U.esc(trasa) + '</td>' +
        '<td class="nowrap muted small">' + U.formatDate(z.dataZaladunku) + '</td>' +
        '<td class="t-right t-mono nowrap">' + U.formatMoney(z.fracht ? z.fracht.sprzedaz : 0, z.fracht ? z.fracht.waluta : "PLN") + '</td>' +
        '<td>' + ui.statusZleceniaBadge(z.status) + (z.fakturaId ? ' <span class="badge badge-violet" title="Zafakturowane">FV</span>' : "") + '</td>' +
      '</tr>';
    }).join("");
    return '<div class="table-wrap"><table class="grid">' +
      '<thead><tr><th>Numer</th><th>Zleceniodawca</th><th>Trasa</th><th>Załadunek</th><th class="t-right">Fracht</th><th>Status</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div>';
  }

  /* ==================== FORMULARZ ==================== */
  function formularz(el, id) {
    const edit = !!id;
    const z = edit ? store.get("zlecenia", id) : nowyPusty();
    if (edit && !z) { el.innerHTML = ui.empty({ title: "Nie znaleziono zlecenia" }); return; }
    ui.setPage(edit ? "Edycja zlecenia " + z.numer : "Nowe zlecenie");

    const kli = klienciOpcje();
    const przew = przewoznicyOpcje();
    const zal = z.zaladunek, roz = z.rozladunek, lad = z.ladunek, poj = z.pojazd, fr = z.fracht, w = z.warunki;

    const brakKlientow = kli.length === 0;

    el.innerHTML =
      '<form id="formZlecenie">' +
      '<div class="panel">' +
        '<div class="form-grid">' +
          '<div class="section-head">Zlecenie</div>' +
          ui.field({ name: "numer", label: "Numer", value: edit ? z.numer : store.podejrzyjNumerZlecenia(), hint: edit ? "" : "Zostanie nadany po zapisaniu.", span: 1 }) +
          ui.field({ name: "status", label: "Status", value: z.status, type: "select", options: Object.keys(ui.STATUSY_ZLECENIA).map(function (k) { return { value: k, label: ui.STATUSY_ZLECENIA[k].label }; }) }) +
          ui.field({ name: "zleceniodawcaId", label: "Zleceniodawca (klient)", value: z.zleceniodawcaId, type: "select", required: true,
            options: brakKlientow ? [{ value: "", label: "— brak klientów, dodaj w zakładce Kontrahenci —" }] : kli,
            hint: brakKlientow ? "Najpierw dodaj klienta w module Kontrahenci." : "" }) +
          ui.field({ name: "przewoznikId", label: "Przewoźnik (podwykonawca)", value: z.przewoznikId || "", type: "select", options: przew }) +

          '<div class="section-head">Załadunek</div>' +
          ui.field({ name: "zal_firma", label: "Miejsce / firma", value: zal.firma, span: 2 }) +
          ui.field({ name: "zal_adres", label: "Adres", value: zal.adres, span: 2 }) +
          ui.field({ name: "zal_kod", label: "Kod pocztowy", value: zal.kod }) +
          ui.field({ name: "zal_miasto", label: "Miasto", value: zal.miasto, required: true }) +
          ui.field({ name: "zal_kraj", label: "Kraj", value: zal.kraj || "Polska" }) +
          ui.field({ name: "zal_data", label: "Data załadunku", value: zal.data, type: "date" }) +
          ui.field({ name: "zal_godziny", label: "Godziny (okno)", value: zal.godziny, placeholder: "np. 08:00-12:00" }) +

          '<div class="section-head">Rozładunek</div>' +
          ui.field({ name: "roz_firma", label: "Miejsce / firma", value: roz.firma, span: 2 }) +
          ui.field({ name: "roz_adres", label: "Adres", value: roz.adres, span: 2 }) +
          ui.field({ name: "roz_kod", label: "Kod pocztowy", value: roz.kod }) +
          ui.field({ name: "roz_miasto", label: "Miasto", value: roz.miasto, required: true }) +
          ui.field({ name: "roz_kraj", label: "Kraj", value: roz.kraj || "Polska" }) +
          ui.field({ name: "roz_data", label: "Data rozładunku", value: roz.data, type: "date" }) +
          ui.field({ name: "roz_godziny", label: "Godziny (okno)", value: roz.godziny, placeholder: "np. 10:00-14:00" }) +

          '<div class="section-head">Ładunek</div>' +
          ui.field({ name: "lad_opis", label: "Opis ładunku", value: lad.opis, span: 2, placeholder: "np. Palety EUR — art. spożywcze" }) +
          ui.field({ name: "lad_rodzaj", label: "Rodzaj / nadwozie", value: lad.rodzaj, placeholder: "np. Plandeka, chłodnia" }) +
          ui.field({ name: "lad_waga", label: "Waga (kg)", value: lad.waga, type: "number", step: "1", min: 0 }) +
          ui.field({ name: "lad_ilosc", label: "Ilość", value: lad.ilosc, type: "number", step: "1", min: 0 }) +
          ui.field({ name: "lad_jednostka", label: "Jednostka", value: lad.jednostka || "pal", placeholder: "pal / szt / kpl" }) +
          ui.field({ name: "lad_ldm", label: "LDM (m)", value: lad.ldm, type: "number", step: "0.1", min: 0 }) +
          ui.field({ name: "lad_wymogi", label: "Wymagania", value: lad.wymogi, placeholder: "np. ADR, temperatura, ponadgabaryt" }) +

          '<div class="section-head">Pojazd i kierowca</div>' +
          ui.field({ name: "poj_typ", label: "Typ pojazdu", value: poj.typ, placeholder: "np. Ciągnik + naczepa" }) +
          ui.field({ name: "poj_nrRej", label: "Nr rejestracyjny", value: poj.nrRej }) +
          ui.field({ name: "poj_kierowca", label: "Kierowca", value: poj.kierowca }) +
          ui.field({ name: "poj_telefon", label: "Telefon do kierowcy", value: poj.telefon }) +

          '<div class="section-head">Fracht i warunki</div>' +
          ui.field({ name: "fr_sprzedaz", label: "Fracht — sprzedaż (od klienta)", value: fr.sprzedaz, type: "number", step: "0.01", min: 0, required: true }) +
          ui.field({ name: "fr_zakup", label: "Fracht — zakup (przewoźnik)", value: fr.zakup, type: "number", step: "0.01", min: 0, hint: "Zostaw 0 przy transporcie własnym." }) +
          ui.field({ name: "fr_waluta", label: "Waluta", value: fr.waluta || "PLN", type: "select", options: WALUTY }) +
          ui.field({ name: "fr_stawkaVat", label: "Stawka VAT (do faktury)", value: fr.stawkaVat || "23", type: "select", options: STAWKI_VAT }) +
          ui.field({ name: "w_termin", label: "Termin płatności (dni)", value: w.terminPlatnosci, type: "number", step: "1", min: 0 }) +
          ui.field({ name: "w_sposob", label: "Sposób płatności", value: w.sposobPlatnosci || "Przelew" }) +
          ui.field({ name: "w_uwagi", label: "Uwagi", value: w.uwagi, type: "textarea", span: 2 }) +
        '</div>' +
      '</div>' +
      '<div class="flex gap-12 mt-16">' +
        '<button class="btn btn-primary" id="zapisz" type="button">' + (edit ? "Zapisz zmiany" : "Utwórz zlecenie") + '</button>' +
        '<a class="btn btn-ghost" href="' + (edit ? "#/zlecenia/" + z.id : "#/zlecenia") + '">Anuluj</a>' +
      '</div>' +
      '</form>';

    document.getElementById("zapisz").addEventListener("click", function () {
      zapisz(z, edit, el);
    });
  }

  function nowyPusty() {
    const today = U.todayISO();
    const uu = store.ustawienia();
    return {
      status: "nowe", zleceniodawcaId: "", przewoznikId: "",
      dataUtworzenia: today, dataZaladunku: today, dataRozladunku: U.addDays(today, 1),
      zaladunek: { firma: "", adres: "", kod: "", miasto: "", kraj: "Polska", data: today, godziny: "" },
      rozladunek: { firma: "", adres: "", kod: "", miasto: "", kraj: "Polska", data: U.addDays(today, 1), godziny: "" },
      ladunek: { opis: "", rodzaj: "", waga: "", ilosc: "", jednostka: "pal", ldm: "", wymogi: "" },
      pojazd: { typ: "", nrRej: "", kierowca: "", telefon: "" },
      fracht: { sprzedaz: "", zakup: "", waluta: (uu.zlecenie && uu.zlecenie.domyslnaWaluta) || "PLN", stawkaVat: (uu.faktura && uu.faktura.domyslnaStawkaVat) || "23" },
      warunki: { terminPlatnosci: (uu.faktura && uu.faktura.terminPlatnosciDni) || 14, sposobPlatnosci: (uu.faktura && uu.faktura.sposobPlatnosci) || "Przelew", uwagi: "" },
      fakturaId: null
    };
  }

  function zapisz(z, edit, el) {
    const form = document.getElementById("formZlecenie");
    ui.clearErrors(form);
    const d = ui.readForm(form);
    let bledy = 0;
    if (!d.zleceniodawcaId) { ui.markError(form, "zleceniodawcaId", "Wybierz zleceniodawcę."); bledy++; }
    if (!d.zal_miasto.trim()) { ui.markError(form, "zal_miasto", "Podaj miasto załadunku."); bledy++; }
    if (!d.roz_miasto.trim()) { ui.markError(form, "roz_miasto", "Podaj miasto rozładunku."); bledy++; }
    if (U.toNumber(d.fr_sprzedaz) <= 0) { ui.markError(form, "fr_sprzedaz", "Podaj kwotę frachtu (sprzedaż)."); bledy++; }
    if (bledy) { ui.toast("Uzupełnij zaznaczone pola.", "err", "Braki w formularzu"); return; }

    const obj = Object.assign({}, z, {
      status: d.status,
      zleceniodawcaId: d.zleceniodawcaId,
      przewoznikId: d.przewoznikId || null,
      dataZaladunku: d.zal_data,
      dataRozladunku: d.roz_data,
      zaladunek: { firma: d.zal_firma.trim(), adres: d.zal_adres.trim(), kod: d.zal_kod.trim(), miasto: d.zal_miasto.trim(), kraj: d.zal_kraj.trim() || "Polska", data: d.zal_data, godziny: d.zal_godziny.trim() },
      rozladunek: { firma: d.roz_firma.trim(), adres: d.roz_adres.trim(), kod: d.roz_kod.trim(), miasto: d.roz_miasto.trim(), kraj: d.roz_kraj.trim() || "Polska", data: d.roz_data, godziny: d.roz_godziny.trim() },
      ladunek: { opis: d.lad_opis.trim(), rodzaj: d.lad_rodzaj.trim(), waga: U.toNumber(d.lad_waga), ilosc: U.toNumber(d.lad_ilosc), jednostka: d.lad_jednostka.trim(), ldm: U.toNumber(d.lad_ldm), wymogi: d.lad_wymogi.trim() },
      pojazd: { typ: d.poj_typ.trim(), nrRej: d.poj_nrRej.trim(), kierowca: d.poj_kierowca.trim(), telefon: d.poj_telefon.trim() },
      fracht: { sprzedaz: U.toNumber(d.fr_sprzedaz), zakup: U.toNumber(d.fr_zakup), waluta: d.fr_waluta, stawkaVat: d.fr_stawkaVat },
      warunki: { terminPlatnosci: U.toNumber(d.w_termin), sposobPlatnosci: d.w_sposob.trim(), uwagi: d.w_uwagi.trim() }
    });

    if (!edit) obj.numer = store.nadajNumerZlecenia();
    const zapisane = store.upsert("zlecenia", obj);
    ui.toast(edit ? "Zapisano zmiany w zleceniu." : "Utworzono zlecenie " + zapisane.numer + ".", "ok");
    location.hash = "#/zlecenia/" + zapisane.id;
  }

  /* ==================== SZCZEGÓŁY ==================== */
  function szczegoly(el, id) {
    const z = store.get("zlecenia", id);
    if (!z) { el.innerHTML = ui.empty({ title: "Nie znaleziono zlecenia", actionHtml: '<a href="#/zlecenia" class="btn">Wróć do listy</a>' }); ui.setPage("Zlecenie"); return; }
    const klient = store.get("kontrahenci", z.zleceniodawcaId);
    const przew = z.przewoznikId ? store.get("kontrahenci", z.przewoznikId) : null;
    const faktura = z.fakturaId ? store.get("faktury", z.fakturaId) : null;
    const fr = z.fracht || {};
    const marza = U.round2((fr.sprzedaz || 0) - (fr.zakup || 0));

    ui.setPage("Zlecenie " + z.numer);

    const akcje =
      '<div class="flex gap-8 items-center" style="flex-wrap:wrap;justify-content:flex-end">' +
        '<select class="select" id="statusSel" style="width:auto">' +
          Object.keys(ui.STATUSY_ZLECENIA).map(function (k) { return '<option value="' + k + '"' + (z.status === k ? " selected" : "") + '>' + ui.STATUSY_ZLECENIA[k].label + '</option>'; }).join("") +
        '</select>' +
        '<a class="btn" href="#/zlecenia/' + z.id + '/edytuj">' + ui.icons.edit + 'Edytuj</a>' +
        '<button class="btn" id="btnDrukuj">' + ui.icons.print + 'Drukuj zlecenie</button>' +
        (faktura ?
          '<a class="btn btn-primary" href="#/faktury/' + faktura.id + '">' + ui.icons.invoice + 'Pokaż fakturę</a>' :
          '<button class="btn btn-primary" id="btnFaktura">' + ui.icons.invoice + 'Wystaw fakturę</button>') +
        '<button class="btn btn-danger" id="btnUsun">' + ui.icons.trash + '</button>' +
      '</div>';

    el.innerHTML =
      '<div class="flex between items-center mb-16" style="flex-wrap:wrap;gap:12px">' +
        '<div class="flex gap-12 items-center">' + ui.statusZleceniaBadge(z.status) +
          (faktura ? ' <span class="badge badge-violet">Faktura: ' + U.esc(faktura.numer) + '</span>' : "") +
          '<span class="muted small">Utworzono: ' + U.formatDate(z.dataUtworzenia) + '</span>' +
        '</div>' + akcje +
      '</div>' +

      '<div class="grid-2">' +
        '<div class="panel">' +
          '<h3 class="panel-title">Trasa</h3>' +
          '<div class="two-col-print" style="grid-template-columns:1fr 1fr;gap:16px">' +
            _legBox("Załadunek", z.zaladunek) +
            _legBox("Rozładunek", z.rozladunek) +
          '</div>' +
          '<div class="divider"></div>' +
          '<h3 class="panel-title">Ładunek</h3>' +
          _kvBlock([
            ["Opis", z.ladunek.opis],
            ["Rodzaj / nadwozie", z.ladunek.rodzaj],
            ["Waga", z.ladunek.waga ? U.formatKwota(z.ladunek.waga).replace(/,00$/, "") + " kg" : ""],
            ["Ilość", z.ladunek.ilosc ? z.ladunek.ilosc + " " + (z.ladunek.jednostka || "") : ""],
            ["LDM", z.ladunek.ldm ? z.ladunek.ldm + " m" : ""],
            ["Wymagania", z.ladunek.wymogi]
          ]) +
          '<div class="divider"></div>' +
          '<h3 class="panel-title">Pojazd i kierowca</h3>' +
          _kvBlock([
            ["Typ pojazdu", z.pojazd.typ],
            ["Nr rejestracyjny", z.pojazd.nrRej],
            ["Kierowca", z.pojazd.kierowca],
            ["Telefon", z.pojazd.telefon]
          ]) +
        '</div>' +

        '<div>' +
          '<div class="panel mb-16">' +
            '<h3 class="panel-title">Kontrahenci</h3>' +
            '<div class="mb-16"><div class="muted small">Zleceniodawca</div>' +
              '<div class="t-strong">' + U.esc(klient ? klient.nazwa : "—") + '</div>' +
              (klient ? '<div class="muted small">' + U.esc([klient.miasto, klient.nip ? "NIP " + U.formatNIP(klient.nip) : ""].filter(Boolean).join(" · ")) + '</div>' : "") +
            '</div>' +
            '<div><div class="muted small">Przewoźnik</div>' +
              '<div class="t-strong">' + U.esc(przew ? przew.nazwa : "Transport własny") + '</div>' +
              (przew ? '<div class="muted small">' + U.esc([przew.telefon, przew.nip ? "NIP " + U.formatNIP(przew.nip) : ""].filter(Boolean).join(" · ")) + '</div>' : "") +
            '</div>' +
          '</div>' +
          '<div class="panel mb-16">' +
            '<h3 class="panel-title">Fracht</h3>' +
            '<div class="stat-inline">' +
              '<div><div class="s-lbl">Sprzedaż</div><div class="s-val">' + U.formatMoney(fr.sprzedaz || 0, fr.waluta) + '</div></div>' +
              '<div><div class="s-lbl">Zakup</div><div class="s-val">' + U.formatMoney(fr.zakup || 0, fr.waluta) + '</div></div>' +
              '<div><div class="s-lbl">Marża</div><div class="s-val" style="color:' + (marza >= 0 ? "var(--green)" : "var(--red)") + '">' + U.formatMoney(marza, fr.waluta) + '</div></div>' +
            '</div>' +
            '<div class="divider"></div>' +
            _kvBlock([
              ["Stawka VAT", U.vatLabel(fr.stawkaVat)],
              ["Termin płatności", (z.warunki.terminPlatnosci || 0) + " dni"],
              ["Sposób płatności", z.warunki.sposobPlatnosci]
            ]) +
          '</div>' +
          (z.warunki.uwagi ? '<div class="panel"><h3 class="panel-title">Uwagi</h3><div>' + U.esc(z.warunki.uwagi) + '</div></div>' : "") +
        '</div>' +
      '</div>';

    // Zdarzenia
    document.getElementById("statusSel").addEventListener("change", function (e) {
      z.status = e.target.value;
      store.upsert("zlecenia", z);
      ui.toast("Zmieniono status na: " + ui.STATUSY_ZLECENIA[z.status].label, "ok");
      szczegoly(el, id);
    });
    document.getElementById("btnDrukuj").addEventListener("click", function () { drukujMenu(z, klient, przew); });
    document.getElementById("btnUsun").addEventListener("click", function () { usun(z, el); });
    const bf = document.getElementById("btnFaktura");
    if (bf) bf.addEventListener("click", function () { App.views.faktury.wystawZeZlecenia(z.id); });
  }

  function _legBox(tytul, leg) {
    leg = leg || {};
    return '<div style="border:1px solid var(--border);border-radius:10px;padding:12px">' +
      '<div class="s-lbl" style="color:var(--accent);font-weight:700;margin-bottom:6px">' + U.esc(tytul) + '</div>' +
      '<div class="t-strong">' + U.esc(leg.firma || leg.miasto || "—") + '</div>' +
      (leg.adres ? '<div class="muted small">' + U.esc(leg.adres) + '</div>' : "") +
      '<div class="muted small">' + U.esc([(leg.kod || "") + " " + (leg.miasto || ""), leg.kraj].filter(function (x) { return x && x.trim(); }).join(", ")) + '</div>' +
      '<div class="small mt-8">📅 ' + U.formatDate(leg.data) + (leg.godziny ? " · " + U.esc(leg.godziny) : "") + '</div>' +
    '</div>';
  }

  function _kvBlock(pary) {
    const rows = pary.filter(function (p) { return p[1] != null && String(p[1]).trim() !== "" && String(p[1]).trim() !== "—"; })
      .map(function (p) {
        return '<div class="flex between" style="padding:5px 0;border-bottom:1px dashed var(--border-soft)">' +
          '<span class="muted small">' + U.esc(p[0]) + '</span>' +
          '<span class="t-strong small" style="text-align:right">' + U.esc(p[1]) + '</span></div>';
      }).join("");
    return rows || '<div class="muted small">Brak danych.</div>';
  }

  function drukujMenu(z, klient, przew) {
    ui.openModal({
      title: "Drukuj zlecenie " + z.numer,
      body: '<p class="muted" style="margin-top:0">Wybierz wariant wydruku:</p>' +
        '<div class="flex gap-12" style="flex-wrap:wrap">' +
          '<button class="btn btn-primary" data-w="klient">Potwierdzenie dla klienta</button>' +
          (przew ? '<button class="btn btn-primary" data-w="przewoznik">Zlecenie dla przewoźnika</button>' : "") +
        '</div>' +
        (!przew ? '<div class="field-hint mt-8">Aby wydrukować zlecenie dla przewoźnika, przypisz przewoźnika w edycji zlecenia.</div>' : ""),
      onMount: function (root, close) {
        root.querySelectorAll("[data-w]").forEach(function (b) {
          b.addEventListener("click", function () {
            close();
            App.print.zlecenie(z, { klient: klient, przewoznik: przew }, { wariant: b.getAttribute("data-w") });
          });
        });
      }
    });
  }

  function usun(z, el) {
    ui.confirm({
      title: "Usunąć zlecenie?",
      message: "Czy na pewno usunąć zlecenie " + z.numer + "? " + (z.fakturaId ? "Powiązana faktura NIE zostanie usunięta." : "") + " Tej operacji nie można cofnąć.",
      confirm: "Usuń", danger: true
    }).then(function (ok) {
      if (!ok) return;
      store.remove("zlecenia", z.id);
      ui.toast("Usunięto zlecenie.", "ok");
      location.hash = "#/zlecenia";
    });
  }

  return { render: render, formularz: formularz, szczegoly: szczegoly };
})();
