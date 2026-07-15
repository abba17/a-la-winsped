/* ============================================================
   views_faktury.js — Faktury VAT. App.views.faktury
   render (lista), formularz (nowa/edycja), szczegoly, wystawZeZlecenia
   ============================================================ */
window.App = window.App || {};
App.views = App.views || {};

App.views.faktury = (function () {
  "use strict";
  const U = App.utils, ui = App.ui, store = App.store;
  let filtr = { q: "", status: "wszystkie" };
  let _draft = null; // wersja robocza przekazywana ze zlecenia

  const STAWKI_VAT = [
    { value: "23", label: "23%" }, { value: "8", label: "8%" },
    { value: "5", label: "5%" }, { value: "0", label: "0%" },
    { value: "zw", label: "zw." }, { value: "np", label: "np." }
  ];

  function klienciOpcje() {
    return store.all("kontrahenci").filter(function (k) { return k.typ !== "przewoznik"; })
      .map(function (k) { return { value: k.id, label: k.nazwa }; });
  }

  /* ==================== LISTA ==================== */
  function render(el) {
    ui.setPage("Faktury", '<button class="btn btn-primary" id="btnNowaFaktura">' + ui.icons.plus + 'Nowa faktura</button>');

    const wszystkie = store.all("faktury");
    const lista = filtruj(wszystkie);

    // Statystyki
    let sumaBrutto = 0, naleznosci = 0;
    wszystkie.forEach(function (f) {
      if (f.status === "anulowana") return;
      sumaBrutto += f.podsumowanie ? f.podsumowanie.brutto : 0;
      if (f.status !== "oplacona") naleznosci += U.round2((f.podsumowanie ? f.podsumowanie.brutto : 0) - (f.kwotaZaplacona || 0));
    });

    const statusy = ["wszystkie", "wystawiona", "oplacona", "przeterminowana", "anulowana"];
    const chips = statusy.map(function (s) {
      let count;
      if (s === "wszystkie") count = wszystkie.length;
      else if (s === "przeterminowana") count = wszystkie.filter(function (f) { return ui.fakturaStatusEfektywny(f) === "przeterminowana"; }).length;
      else count = wszystkie.filter(function (f) { return f.status === s; }).length;
      const label = s === "wszystkie" ? "Wszystkie" : (ui.STATUSY_FAKTURY[s] ? ui.STATUSY_FAKTURY[s].label : s);
      return '<div class="chip ' + (filtr.status === s ? "active" : "") + '" data-status="' + s + '">' + U.esc(label) + ' <span class="pill-count">' + count + '</span></div>';
    }).join("");

    el.innerHTML =
      '<div class="kpi-grid" style="grid-template-columns:repeat(2,1fr);max-width:520px">' +
        '<div class="kpi kpi-green"><div class="kpi-label">Obrót (brutto)</div><div class="kpi-value">' + U.formatPLN(sumaBrutto) + '</div><div class="kpi-sub">wszystkie faktury</div></div>' +
        '<div class="kpi ' + (naleznosci > 0 ? "kpi-red" : "") + '"><div class="kpi-label">Do zapłaty</div><div class="kpi-value">' + U.formatPLN(naleznosci) + '</div><div class="kpi-sub">nieopłacone należności</div></div>' +
      '</div>' +
      '<div class="toolbar">' +
        '<div class="search">' + ui.icons.search +
          '<input class="input" id="szukaj" placeholder="Szukaj: numer, nabywca…" value="' + U.esc(filtr.q) + '" />' +
        '</div>' +
      '</div>' +
      '<div class="chip-group mb-16">' + chips + '</div>' +
      (lista.length ? _tabela(lista) :
        ui.empty({ title: wszystkie.length ? "Brak wyników" : "Brak faktur",
          text: wszystkie.length ? "Zmień filtry." : "Wystaw fakturę ze zlecenia lub utwórz nową ręcznie.",
          actionHtml: '<button class="btn btn-primary" id="btnPusta">' + ui.icons.plus + 'Nowa faktura</button>' }));

    const nb = document.getElementById("btnNowaFaktura");
    if (nb) nb.addEventListener("click", function () { _draft = null; location.hash = "#/faktury/nowa"; });
    const pb = document.getElementById("btnPusta");
    if (pb) pb.addEventListener("click", function () { _draft = null; location.hash = "#/faktury/nowa"; });

    const szukaj = document.getElementById("szukaj");
    szukaj.addEventListener("input", U.debounce(function () { filtr.q = szukaj.value; render(el); const s = document.getElementById("szukaj"); s.focus(); s.setSelectionRange(s.value.length, s.value.length); }, 200));
    el.querySelectorAll("[data-status]").forEach(function (c) {
      c.addEventListener("click", function () { filtr.status = c.getAttribute("data-status"); render(el); });
    });
    el.querySelectorAll("[data-open]").forEach(function (r) {
      r.addEventListener("click", function () { location.hash = "#/faktury/" + r.getAttribute("data-open"); });
    });
  }

  function filtruj(arr) {
    const q = filtr.q.trim().toLowerCase();
    return arr.filter(function (f) {
      if (filtr.status !== "wszystkie") {
        if (filtr.status === "przeterminowana") { if (ui.fakturaStatusEfektywny(f) !== "przeterminowana") return false; }
        else if (f.status !== filtr.status) return false;
      }
      if (!q) return true;
      return [f.numer, f.nabywca ? f.nabywca.nazwa : ""].join(" ").toLowerCase().indexOf(q) >= 0;
    });
  }

  function _tabela(lista) {
    const rows = lista.map(function (f) {
      const eff = ui.fakturaStatusEfektywny(f);
      return '<tr data-open="' + f.id + '" style="cursor:pointer">' +
        '<td class="t-strong nowrap">' + U.esc(f.numer) + '</td>' +
        '<td>' + U.esc(f.nabywca ? f.nabywca.nazwa : "—") + '</td>' +
        '<td class="nowrap muted small">' + U.formatDate(f.dataWystawienia) + '</td>' +
        '<td class="nowrap muted small">' + U.formatDate(f.terminPlatnosci) + '</td>' +
        '<td class="t-right t-mono nowrap">' + U.formatPLN(f.podsumowanie ? f.podsumowanie.netto : 0) + '</td>' +
        '<td class="t-right t-mono t-strong nowrap">' + U.formatPLN(f.podsumowanie ? f.podsumowanie.brutto : 0) + '</td>' +
        '<td>' + ui.statusFakturyBadge(eff) + '</td>' +
      '</tr>';
    }).join("");
    return '<div class="table-wrap"><table class="grid">' +
      '<thead><tr><th>Numer</th><th>Nabywca</th><th>Wystawiono</th><th>Termin</th><th class="t-right">Netto</th><th class="t-right">Brutto</th><th>Status</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div>';
  }

  /* ==================== WYSTAW ZE ZLECENIA ==================== */
  function wystawZeZlecenia(zlecenieId) {
    const z = store.get("zlecenia", zlecenieId);
    if (!z) return;
    const klient = store.get("kontrahenci", z.zleceniodawcaId);
    if (!klient) { ui.toast("Zlecenie nie ma przypisanego klienta.", "err"); return; }
    const uu = store.ustawienia();
    const trasa = ((z.zaladunek && z.zaladunek.miasto) || "") + " → " + ((z.rozladunek && z.rozladunek.miasto) || "");
    const opis = (uu.faktura.domyslnyOpis || "Usługa transportowa") + " " + trasa + " (" + z.numer + ")";
    const today = U.todayISO();
    _draft = {
      status: "wystawiona",
      dataWystawienia: today,
      dataSprzedazy: z.dataRozladunku || today,
      terminPlatnosci: U.addDays(today, (z.warunki && z.warunki.terminPlatnosci) || uu.faktura.terminPlatnosciDni || 14),
      miejsceWystawienia: uu.firma.miasto || "",
      nabywcaId: klient.id,
      nabywca: store.snapshotNabywca(klient),
      sprzedawca: store.snapshotSprzedawca(),
      pozycje: [{ nazwa: opis, ilosc: 1, jednostka: "usługa", cenaNetto: (z.fracht && z.fracht.sprzedaz) || 0, stawkaVat: (z.fracht && z.fracht.stawkaVat) || uu.faktura.domyslnaStawkaVat }],
      sposobPlatnosci: (z.warunki && z.warunki.sposobPlatnosci) || uu.faktura.sposobPlatnosci,
      numerKonta: uu.firma.numerKonta || "",
      waluta: "PLN",
      uwagi: "",
      zlecenieId: z.id,
      kwotaZaplacona: 0
    };
    if (z.fracht && z.fracht.waluta && z.fracht.waluta !== "PLN") {
      ui.toast("Zlecenie było w " + z.fracht.waluta + " — sprawdź kwotę netto i przelicz wg kursu.", "info", "Uwaga: waluta");
    }
    location.hash = "#/faktury/nowa";
  }

  /* ==================== FORMULARZ ==================== */
  function blankFaktura() {
    const uu = store.ustawienia();
    const today = U.todayISO();
    return {
      status: "wystawiona", dataWystawienia: today, dataSprzedazy: today,
      terminPlatnosci: U.addDays(today, uu.faktura.terminPlatnosciDni || 14),
      miejsceWystawienia: uu.firma.miasto || "",
      nabywcaId: "", nabywca: null, sprzedawca: store.snapshotSprzedawca(),
      pozycje: [{ nazwa: uu.faktura.domyslnyOpis || "Usługa transportowa", ilosc: 1, jednostka: uu.faktura.domyslnaJednostka || "usługa", cenaNetto: "", stawkaVat: uu.faktura.domyslnaStawkaVat || "23" }],
      sposobPlatnosci: uu.faktura.sposobPlatnosci || "Przelew",
      numerKonta: uu.firma.numerKonta || "", waluta: "PLN", uwagi: uu.faktura.uwagi || "",
      zlecenieId: null, kwotaZaplacona: 0
    };
  }

  function formularz(el, id) {
    const edit = !!id;
    let f;
    if (edit) { f = store.get("faktury", id); if (!f) { el.innerHTML = ui.empty({ title: "Nie znaleziono faktury" }); return; } f = JSON.parse(JSON.stringify(f)); }
    else { f = _draft || blankFaktura(); _draft = null; }

    ui.setPage(edit ? "Edycja faktury " + f.numer : "Nowa faktura");
    const kli = klienciOpcje();
    const brakKlientow = kli.length === 0;

    el.innerHTML =
      '<form id="formFaktura">' +
      '<div class="panel">' +
        '<div class="form-grid">' +
          '<div class="section-head">Dane faktury</div>' +
          ui.field({ name: "numer", label: "Numer faktury", value: edit ? f.numer : store.podejrzyjNumerFaktury(), hint: edit ? "" : "Zostanie nadany po zapisaniu." }) +
          ui.field({ name: "nabywcaId", label: "Nabywca", value: f.nabywcaId, type: "select", required: true,
            options: brakKlientow ? [{ value: "", label: "— brak klientów, dodaj w Kontrahentach —" }] : [{ value: "", label: "— wybierz —" }].concat(kli),
            hint: brakKlientow ? "Najpierw dodaj klienta w module Kontrahenci." : "" }) +
          ui.field({ name: "dataWystawienia", label: "Data wystawienia", value: f.dataWystawienia, type: "date", required: true }) +
          ui.field({ name: "dataSprzedazy", label: "Data sprzedaży / wykonania", value: f.dataSprzedazy, type: "date", required: true }) +
          ui.field({ name: "terminPlatnosci", label: "Termin płatności", value: f.terminPlatnosci, type: "date", required: true }) +
          ui.field({ name: "miejsceWystawienia", label: "Miejsce wystawienia", value: f.miejsceWystawienia }) +
        '</div>' +

        '<div class="section-head" style="border-top:1px solid var(--border-soft);padding-top:18px;margin-top:22px">Pozycje</div>' +
        '<div class="table-wrap" style="margin-bottom:10px">' +
          '<table class="grid" id="pozTabela">' +
            '<thead><tr>' +
              '<th style="min-width:220px">Nazwa</th><th style="width:80px">Ilość</th><th style="width:90px">J.m.</th>' +
              '<th style="width:120px">Cena netto</th><th style="width:90px">VAT</th><th class="t-right" style="width:110px">Wartość netto</th>' +
              '<th class="t-right" style="width:110px">Brutto</th><th style="width:40px"></th>' +
            '</tr></thead>' +
            '<tbody id="pozBody"></tbody>' +
          '</table>' +
        '</div>' +
        '<button class="btn btn-sm" type="button" id="dodajPoz">' + ui.icons.plus + 'Dodaj pozycję</button>' +

        '<div class="flex between mt-24" style="flex-wrap:wrap;gap:20px;align-items:flex-start">' +
          '<div style="flex:1;min-width:260px">' +
            '<div class="form-grid" style="grid-template-columns:1fr 1fr">' +
              ui.field({ name: "sposobPlatnosci", label: "Sposób płatności", value: f.sposobPlatnosci }) +
              ui.field({ name: "numerKonta", label: "Nr konta bankowego", value: f.numerKonta, placeholder: "PL.. .. ..", span: 2 }) +
              ui.field({ name: "uwagi", label: "Uwagi", value: f.uwagi, type: "textarea", span: 2 }) +
            '</div>' +
          '</div>' +
          '<div class="panel" style="min-width:260px;background:var(--surface-2)">' +
            '<div class="flex between" style="padding:4px 0"><span class="muted">Razem netto:</span><span class="t-strong t-mono" id="sumNetto">0,00 zł</span></div>' +
            '<div class="flex between" style="padding:4px 0"><span class="muted">Razem VAT:</span><span class="t-strong t-mono" id="sumVat">0,00 zł</span></div>' +
            '<div class="divider" style="margin:8px 0"></div>' +
            '<div class="flex between" style="padding:4px 0"><span class="t-strong">Razem brutto:</span><span class="t-strong t-mono" id="sumBrutto" style="font-size:18px;color:var(--accent)">0,00 zł</span></div>' +
            '<div class="muted small mt-8" id="sumSlownie"></div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="flex gap-12 mt-16">' +
        '<button class="btn btn-primary" id="zapisz" type="button">' + (edit ? "Zapisz zmiany" : "Wystaw fakturę") + '</button>' +
        '<a class="btn btn-ghost" href="' + (edit ? "#/faktury/" + f.id : "#/faktury") + '">Anuluj</a>' +
      '</div>' +
      '</form>';

    // Render pozycji
    const body = document.getElementById("pozBody");
    (f.pozycje || []).forEach(function (p) { body.appendChild(_wierszPozycji(p)); });
    if (!f.pozycje || !f.pozycje.length) body.appendChild(_wierszPozycji({}));

    document.getElementById("dodajPoz").addEventListener("click", function () {
      body.appendChild(_wierszPozycji({ jednostka: "usługa", stawkaVat: "23", ilosc: 1 }));
      przelicz();
    });
    body.addEventListener("input", przelicz);
    body.addEventListener("click", function (e) {
      const btn = e.target.closest("[data-usun-poz]");
      if (btn) { if (body.children.length > 1) { btn.closest("tr").remove(); przelicz(); } else ui.toast("Faktura musi mieć min. 1 pozycję.", "err"); }
    });

    document.getElementById("zapisz").addEventListener("click", function () { zapisz(f, edit, el); });
    przelicz();
  }

  function _wierszPozycji(p) {
    p = p || {};
    const tr = document.createElement("tr");
    tr.innerHTML =
      '<td><input class="input" data-p="nazwa" value="' + U.esc(p.nazwa || "") + '" placeholder="Nazwa usługi"></td>' +
      '<td><input class="input" data-p="ilosc" type="number" step="0.01" min="0" value="' + U.esc(p.ilosc != null ? p.ilosc : 1) + '"></td>' +
      '<td><input class="input" data-p="jednostka" value="' + U.esc(p.jednostka || "usługa") + '"></td>' +
      '<td><input class="input" data-p="cenaNetto" type="number" step="0.01" min="0" value="' + U.esc(p.cenaNetto != null ? p.cenaNetto : "") + '"></td>' +
      '<td><select class="select" data-p="stawkaVat">' + STAWKI_VAT.map(function (s) { return '<option value="' + s.value + '"' + (String(p.stawkaVat) === s.value ? " selected" : "") + '>' + s.label + '</option>'; }).join("") + '</select></td>' +
      '<td class="t-right t-mono" data-out="netto">0,00</td>' +
      '<td class="t-right t-mono" data-out="brutto">0,00</td>' +
      '<td><button class="icon-btn" type="button" data-usun-poz title="Usuń" style="width:30px;height:30px">' + ui.icons.trash + '</button></td>';
    return tr;
  }

  function _czytajPozycje() {
    const out = [];
    document.querySelectorAll("#pozBody tr").forEach(function (tr) {
      out.push({
        nazwa: tr.querySelector('[data-p="nazwa"]').value,
        ilosc: U.toNumber(tr.querySelector('[data-p="ilosc"]').value),
        jednostka: tr.querySelector('[data-p="jednostka"]').value,
        cenaNetto: U.toNumber(tr.querySelector('[data-p="cenaNetto"]').value),
        stawkaVat: tr.querySelector('[data-p="stawkaVat"]').value
      });
    });
    return out;
  }

  function przelicz() {
    document.querySelectorAll("#pozBody tr").forEach(function (tr) {
      const il = U.toNumber(tr.querySelector('[data-p="ilosc"]').value);
      const cn = U.toNumber(tr.querySelector('[data-p="cenaNetto"]').value);
      const st = tr.querySelector('[data-p="stawkaVat"]').value;
      const w = U.liczPozycja(il, cn, st);
      tr.querySelector('[data-out="netto"]').textContent = U.formatKwota(w.netto);
      tr.querySelector('[data-out="brutto"]').textContent = U.formatKwota(w.brutto);
    });
    const sumy = U.podsumujPozycje(_czytajPozycje());
    document.getElementById("sumNetto").textContent = U.formatPLN(sumy.netto);
    document.getElementById("sumVat").textContent = U.formatPLN(sumy.vat);
    document.getElementById("sumBrutto").textContent = U.formatPLN(sumy.brutto);
    document.getElementById("sumSlownie").textContent = "Słownie: " + U.kwotaSlownie(sumy.brutto);
  }

  function zapisz(f, edit, el) {
    const form = document.getElementById("formFaktura");
    ui.clearErrors(form);
    const d = ui.readForm(form);
    const pozycje = _czytajPozycje().filter(function (p) { return p.nazwa.trim() || p.cenaNetto > 0; });
    let bledy = 0;
    if (!d.nabywcaId) { ui.markError(form, "nabywcaId", "Wybierz nabywcę."); bledy++; }
    if (!d.dataWystawienia) { ui.markError(form, "dataWystawienia", "Podaj datę."); bledy++; }
    if (!pozycje.length || U.podsumujPozycje(pozycje).brutto <= 0) { ui.toast("Dodaj przynajmniej jedną pozycję z kwotą.", "err", "Brak pozycji"); bledy++; }
    if (bledy) return;

    const klient = store.get("kontrahenci", d.nabywcaId);
    const obj = Object.assign({}, f, {
      status: f.status || "wystawiona",
      dataWystawienia: d.dataWystawienia, dataSprzedazy: d.dataSprzedazy, terminPlatnosci: d.terminPlatnosci,
      miejsceWystawienia: d.miejsceWystawienia.trim(),
      nabywcaId: d.nabywcaId, nabywca: store.snapshotNabywca(klient),
      sprzedawca: f.sprzedawca || store.snapshotSprzedawca(),
      pozycje: pozycje, podsumowanie: U.podsumujPozycje(pozycje),
      sposobPlatnosci: d.sposobPlatnosci.trim(), numerKonta: d.numerKonta.trim(),
      uwagi: d.uwagi.trim(), waluta: "PLN"
    });

    const noweId = !obj.id;
    if (noweId) obj.numer = store.nadajNumerFaktury();
    const zapisana = store.upsert("faktury", obj);

    // Powiąż ze zleceniem (przy nowej fakturze)
    if (noweId && obj.zlecenieId) {
      const z = store.get("zlecenia", obj.zlecenieId);
      if (z) { z.fakturaId = zapisana.id; if (z.status !== "anulowane") z.status = "zafakturowane"; store.upsert("zlecenia", z); }
    }
    ui.toast(edit ? "Zapisano fakturę." : "Wystawiono fakturę " + zapisana.numer + ".", "ok");
    location.hash = "#/faktury/" + zapisana.id;
  }

  /* ==================== SZCZEGÓŁY ==================== */
  function szczegoly(el, id) {
    const f = store.get("faktury", id);
    if (!f) { el.innerHTML = ui.empty({ title: "Nie znaleziono faktury", actionHtml: '<a href="#/faktury" class="btn">Wróć</a>' }); ui.setPage("Faktura"); return; }
    const eff = ui.fakturaStatusEfektywny(f);
    const zlecenie = f.zlecenieId ? store.get("zlecenia", f.zlecenieId) : null;
    ui.setPage("Faktura " + f.numer);

    const akcje =
      '<div class="flex gap-8" style="flex-wrap:wrap;justify-content:flex-end">' +
        (f.status !== "oplacona" && f.status !== "anulowana" ? '<button class="btn btn-primary" id="btnOplac">✓ Oznacz opłaconą</button>' : "") +
        '<button class="btn" id="btnDrukuj">' + ui.icons.print + 'Drukuj / PDF</button>' +
        '<a class="btn" href="#/faktury/' + f.id + '/edytuj">' + ui.icons.edit + 'Edytuj</a>' +
        '<button class="btn btn-danger" id="btnUsun">' + ui.icons.trash + '</button>' +
      '</div>';

    el.innerHTML =
      '<div class="flex between items-center mb-16" style="flex-wrap:wrap;gap:12px">' +
        '<div class="flex gap-12 items-center">' + ui.statusFakturyBadge(eff) +
          (zlecenie ? ' <a href="#/zlecenia/' + zlecenie.id + '" class="badge badge-slate" style="text-decoration:none">Zlecenie: ' + U.esc(zlecenie.numer) + '</a>' : "") +
        '</div>' + akcje +
      '</div>' +
      '<div class="card card-pad" style="background:#fff">' +
        App.print.podgladHtml(App.print.faktura(f, { returnHtml: true })) +
      '</div>';

    const bo = document.getElementById("btnOplac");
    if (bo) bo.addEventListener("click", function () {
      f.status = "oplacona"; f.kwotaZaplacona = f.podsumowanie.brutto; store.upsert("faktury", f);
      ui.toast("Oznaczono jako opłaconą.", "ok"); szczegoly(el, id);
    });
    document.getElementById("btnDrukuj").addEventListener("click", function () { App.print.faktura(f); });
    document.getElementById("btnUsun").addEventListener("click", function () { usun(f, el); });
  }

  function usun(f, el) {
    ui.confirm({
      title: "Usunąć fakturę?",
      message: "Czy na pewno usunąć fakturę " + f.numer + "? Powiązane zlecenie wróci do statusu „Zrealizowane”. Tej operacji nie można cofnąć.",
      confirm: "Usuń", danger: true
    }).then(function (ok) {
      if (!ok) return;
      if (f.zlecenieId) {
        const z = store.get("zlecenia", f.zlecenieId);
        if (z && z.fakturaId === f.id) { z.fakturaId = null; if (z.status === "zafakturowane") z.status = "zrealizowane"; store.upsert("zlecenia", z); }
      }
      store.remove("faktury", f.id);
      ui.toast("Usunięto fakturę.", "ok");
      location.hash = "#/faktury";
    });
  }

  return { render: render, formularz: formularz, szczegoly: szczegoly, wystawZeZlecenia: wystawZeZlecenia };
})();
