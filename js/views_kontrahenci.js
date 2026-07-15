/* ============================================================
   views_kontrahenci.js — Kontrahenci (klienci i przewoźnicy)
   App.views.kontrahenci
   ============================================================ */
window.App = window.App || {};
App.views = App.views || {};

App.views.kontrahenci = (function () {
  "use strict";
  const U = App.utils, ui = App.ui, store = App.store;
  let filtr = { q: "", typ: "wszyscy" };

  const TYPY = [
    { value: "klient", label: "Klient (zleceniodawca)" },
    { value: "przewoznik", label: "Przewoźnik (podwykonawca)" },
    { value: "oba", label: "Klient i przewoźnik" }
  ];
  function typLabel(t) { const f = TYPY.find(function (x) { return x.value === t; }); return f ? f.label : t; }
  function typBadge(t) {
    if (t === "przewoznik") return '<span class="badge badge-cyan">Przewoźnik</span>';
    if (t === "oba") return '<span class="badge badge-violet">Klient / Przewoźnik</span>';
    return '<span class="badge badge-blue">Klient</span>';
  }

  function render(el) {
    ui.setPage("Kontrahenci",
      '<button class="btn btn-primary" id="btnNowyKontrahent">' + ui.icons.plus + 'Nowy kontrahent</button>');

    const wszyscy = store.all("kontrahenci");
    const lista = filtruj(wszyscy);

    el.innerHTML =
      '<div class="toolbar">' +
        '<div class="search">' + ui.icons.search +
          '<input class="input" id="szukaj" placeholder="Szukaj po nazwie, NIP, mieście…" value="' + U.esc(filtr.q) + '" />' +
        '</div>' +
        '<div class="chip-group">' +
          _chip("wszyscy", "Wszyscy", wszyscy.length) +
          _chip("klient", "Klienci", wszyscy.filter(function (k) { return k.typ !== "przewoznik"; }).length) +
          _chip("przewoznik", "Przewoźnicy", wszyscy.filter(function (k) { return k.typ === "przewoznik" || k.typ === "oba"; }).length) +
        '</div>' +
      '</div>' +
      (lista.length ? _tabela(lista) :
        ui.empty({ title: wszyscy.length ? "Brak wyników" : "Brak kontrahentów",
          text: wszyscy.length ? "Zmień kryteria wyszukiwania." : "Dodaj pierwszego klienta lub przewoźnika.",
          actionHtml: wszyscy.length ? "" : '<button class="btn btn-primary" id="btnPusty">' + ui.icons.plus + 'Dodaj kontrahenta</button>' }));

    // Zdarzenia
    const btn = document.getElementById("btnNowyKontrahent");
    if (btn) btn.addEventListener("click", function () { formularz(null); });
    const btnPusty = document.getElementById("btnPusty");
    if (btnPusty) btnPusty.addEventListener("click", function () { formularz(null); });

    const szukaj = document.getElementById("szukaj");
    szukaj.addEventListener("input", U.debounce(function () { filtr.q = szukaj.value; render(el); szukaj.focus(); szukaj.setSelectionRange(szukaj.value.length, szukaj.value.length); }, 200));

    el.querySelectorAll("[data-chip]").forEach(function (c) {
      c.addEventListener("click", function () { filtr.typ = c.getAttribute("data-chip"); render(el); });
    });
    el.querySelectorAll("[data-edit]").forEach(function (b) {
      b.addEventListener("click", function (e) { e.stopPropagation(); formularz(store.get("kontrahenci", b.getAttribute("data-edit"))); });
    });
    el.querySelectorAll("[data-del]").forEach(function (b) {
      b.addEventListener("click", function (e) { e.stopPropagation(); usun(b.getAttribute("data-del"), el); });
    });
  }

  function filtruj(arr) {
    const q = filtr.q.trim().toLowerCase();
    return arr.filter(function (k) {
      if (filtr.typ === "klient" && k.typ === "przewoznik") return false;
      if (filtr.typ === "przewoznik" && !(k.typ === "przewoznik" || k.typ === "oba")) return false;
      if (!q) return true;
      return [k.nazwa, k.nip, k.miasto, k.email, k.osoba].join(" ").toLowerCase().indexOf(q) >= 0;
    });
  }

  function _chip(val, label, count) {
    return '<div class="chip ' + (filtr.typ === val ? "active" : "") + '" data-chip="' + val + '">' + U.esc(label) + ' <span class="pill-count">' + count + '</span></div>';
  }

  function _tabela(lista) {
    const rows = lista.map(function (k) {
      return '<tr>' +
        '<td><div class="t-strong">' + U.esc(k.nazwa) + '</div>' +
          (k.osoba ? '<div class="muted small">' + U.esc(k.osoba) + '</div>' : "") + '</td>' +
        '<td>' + typBadge(k.typ) + '</td>' +
        '<td class="t-mono">' + (k.nip ? U.esc(U.formatNIP(k.nip)) : '<span class="muted-2">—</span>') + '</td>' +
        '<td>' + U.esc(k.miasto || "—") + (k.kraj && k.kraj !== "Polska" ? ' <span class="muted small">' + U.esc(k.kraj) + '</span>' : "") + '</td>' +
        '<td class="muted small">' + (k.telefon ? U.esc(k.telefon) : "") + (k.email ? '<br>' + U.esc(k.email) : "") + '</td>' +
        '<td><div class="row-actions">' +
          '<button class="icon-btn btn-sm" data-edit="' + k.id + '" title="Edytuj" style="width:32px;height:32px">' + ui.icons.edit + '</button>' +
          '<button class="icon-btn btn-sm" data-del="' + k.id + '" title="Usuń" style="width:32px;height:32px">' + ui.icons.trash + '</button>' +
        '</div></td>' +
      '</tr>';
    }).join("");
    return '<div class="table-wrap"><table class="grid">' +
      '<thead><tr><th>Nazwa</th><th>Typ</th><th>NIP</th><th>Miasto</th><th>Kontakt</th><th></th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div>';
  }

  /* ---------- Formularz (modal) ---------- */
  function formularz(k) {
    const edit = !!k;
    k = k || { typ: "klient", kraj: "Polska" };
    const body =
      '<form id="formKontrahent">' +
        '<div class="form-grid">' +
          ui.field({ name: "nazwa", label: "Nazwa firmy", value: k.nazwa, required: true, span: 2, placeholder: "np. Alpha Logistics Sp. z o.o." }) +
          ui.field({ name: "typ", label: "Typ kontrahenta", value: k.typ, type: "select", options: TYPY }) +
          ui.field({ name: "nip", label: "NIP", value: k.nip, placeholder: "np. 5213003700", hint: "Dla firm z UE można podać z prefiksem kraju (np. DE...)." }) +
          ui.field({ name: "ulica", label: "Ulica i nr", value: k.ulica, span: 2 }) +
          ui.field({ name: "kod", label: "Kod pocztowy", value: k.kod, placeholder: "00-000" }) +
          ui.field({ name: "miasto", label: "Miasto", value: k.miasto }) +
          ui.field({ name: "kraj", label: "Kraj", value: k.kraj || "Polska" }) +
          ui.field({ name: "osoba", label: "Osoba kontaktowa", value: k.osoba }) +
          ui.field({ name: "telefon", label: "Telefon", value: k.telefon }) +
          ui.field({ name: "email", label: "E-mail", value: k.email, type: "email" }) +
          ui.field({ name: "uwagi", label: "Uwagi", value: k.uwagi, type: "textarea", span: 2 }) +
        '</div>' +
      '</form>';

    ui.openModal({
      title: edit ? "Edytuj kontrahenta" : "Nowy kontrahent",
      wide: true,
      body: body,
      footer: '<button class="btn btn-ghost" data-close>Anuluj</button><button class="btn btn-primary" id="zapisz">Zapisz</button>',
      onMount: function (root, close) {
        root.querySelector("#zapisz").addEventListener("click", function () {
          const form = root.querySelector("#formKontrahent");
          ui.clearErrors(form);
          const d = ui.readForm(form);
          if (!d.nazwa.trim()) { ui.markError(form, "nazwa", "Podaj nazwę firmy."); return; }
          if (d.nip) {
            // Zagraniczne NIP-y (z literami) przepuszczamy; walidujemy tylko polskie 10-cyfrowe.
            const cyfry = U.cleanNIP(d.nip);
            if (cyfry.length === 10 && !/[A-Za-z]/.test(d.nip) && !U.isValidNIP(d.nip)) {
              ui.markError(form, "nip", "Nieprawidłowy NIP (błędna suma kontrolna).");
              return;
            }
          }
          const obj = Object.assign({}, k, {
            typ: d.typ, nazwa: d.nazwa.trim(), nip: d.nip.trim(), ulica: d.ulica.trim(),
            kod: d.kod.trim(), miasto: d.miasto.trim(), kraj: (d.kraj || "Polska").trim(),
            osoba: d.osoba.trim(), telefon: d.telefon.trim(), email: d.email.trim(), uwagi: d.uwagi.trim()
          });
          store.upsert("kontrahenci", obj);
          ui.toast(edit ? "Zaktualizowano kontrahenta." : "Dodano kontrahenta.", "ok");
          close();
          App.router.reload();
        });
      }
    });
  }

  function usun(id, el) {
    const k = store.get("kontrahenci", id);
    // Sprawdź powiązania
    const uzyty = store.all("zlecenia").some(function (z) { return z.zleceniodawcaId === id || z.przewoznikId === id; });
    ui.confirm({
      title: "Usunąć kontrahenta?",
      message: (uzyty ? "Uwaga: ten kontrahent występuje w zleceniach. " : "") + "Czy na pewno usunąć „" + (k ? k.nazwa : "") + "”? Tej operacji nie można cofnąć.",
      confirm: "Usuń", danger: true
    }).then(function (ok) {
      if (!ok) return;
      store.remove("kontrahenci", id);
      ui.toast("Usunięto kontrahenta.", "ok");
      render(el);
    });
  }

  // Pozwala innym widokom szybko dodać kontrahenta i dostać jego id
  function szybkiDodaj(onSaved) {
    formularz(null);
    // Prosty wariant: po zapisaniu router.reload odświeży; onSaved obsłużone w miejscu wywołania.
    if (onSaved) onSaved();
  }

  return { render: render, formularz: formularz, TYPY: TYPY, typLabel: typLabel };
})();
