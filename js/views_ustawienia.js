/* ============================================================
   views_ustawienia.js — Ustawienia. App.views.ustawienia
   Dane firmy (sprzedawca), numeracja, domyślne, kopia zapasowa
   ============================================================ */
window.App = window.App || {};
App.views = App.views || {};

App.views.ustawienia = (function () {
  "use strict";
  const U = App.utils, ui = App.ui, store = App.store;

  const STAWKI_VAT = [
    { value: "23", label: "23%" }, { value: "8", label: "8%" },
    { value: "5", label: "5%" }, { value: "0", label: "0%" }, { value: "zw", label: "zw." }
  ];

  function render(el) {
    ui.setPage("Ustawienia");
    const u = store.ustawienia();
    const fi = u.firma, fa = u.faktura, zl = u.zlecenie;

    el.innerHTML =
      '<form id="formUst">' +
      '<div class="panel mb-16">' +
        '<h3 class="panel-title">Dane firmy (sprzedawca na fakturach)</h3>' +
        '<div class="form-grid">' +
          ui.field({ name: "nazwa", label: "Nazwa", value: fi.nazwa, required: true, span: 2 }) +
          ui.field({ name: "nip", label: "NIP", value: fi.nip, hint: "Weryfikowany sumą kontrolną." }) +
          ui.field({ name: "regon", label: "REGON", value: fi.regon }) +
          ui.field({ name: "krs", label: "KRS", value: fi.krs }) +
          ui.field({ name: "www", label: "Strona WWW", value: fi.www }) +
          ui.field({ name: "ulica", label: "Ulica i nr", value: fi.ulica, span: 2 }) +
          ui.field({ name: "kod", label: "Kod pocztowy", value: fi.kod }) +
          ui.field({ name: "miasto", label: "Miasto", value: fi.miasto }) +
          ui.field({ name: "kraj", label: "Kraj", value: fi.kraj || "Polska" }) +
          ui.field({ name: "email", label: "E-mail", value: fi.email, type: "email" }) +
          ui.field({ name: "telefon", label: "Telefon", value: fi.telefon }) +
          ui.field({ name: "bank", label: "Bank", value: fi.bank, placeholder: "np. mBank" }) +
          ui.field({ name: "numerKonta", label: "Numer konta", value: fi.numerKonta, span: 2, placeholder: "PL00 0000 0000 0000 0000 0000 0000" }) +
        '</div>' +
      '</div>' +

      '<div class="grid-2">' +
        '<div class="panel">' +
          '<h3 class="panel-title">Faktury — domyślne</h3>' +
          '<div class="form-grid" style="grid-template-columns:1fr 1fr">' +
            ui.field({ name: "fa_prefix", label: "Prefiks numeru", value: fa.prefix, hint: "np. FV → FV/0001/" + new Date().getFullYear() }) +
            ui.field({ name: "fa_stawka", label: "Domyślna stawka VAT", value: fa.domyslnaStawkaVat, type: "select", options: STAWKI_VAT }) +
            ui.field({ name: "fa_termin", label: "Termin płatności (dni)", value: fa.terminPlatnosciDni, type: "number", min: 0 }) +
            ui.field({ name: "fa_sposob", label: "Sposób płatności", value: fa.sposobPlatnosci }) +
            ui.field({ name: "fa_jednostka", label: "Domyślna jednostka", value: fa.domyslnaJednostka }) +
            ui.field({ name: "fa_opis", label: "Domyślny opis usługi", value: fa.domyslnyOpis }) +
            ui.field({ name: "fa_uwagi", label: "Domyślne uwagi na fakturze", value: fa.uwagi, type: "textarea", span: 2 }) +
          '</div>' +
        '</div>' +
        '<div class="panel">' +
          '<h3 class="panel-title">Zlecenia — domyślne</h3>' +
          '<div class="form-grid" style="grid-template-columns:1fr 1fr">' +
            ui.field({ name: "zl_prefix", label: "Prefiks numeru", value: zl.prefix, hint: "np. ZL → ZL/0001/" + new Date().getFullYear() }) +
            ui.field({ name: "zl_waluta", label: "Domyślna waluta", value: zl.domyslnaWaluta, type: "select", options: ["PLN", "EUR"] }) +
          '</div>' +
          '<div class="field-hint mt-16">Numeracja jest ciągła w obrębie roku i resetuje się 1 stycznia.</div>' +
        '</div>' +
      '</div>' +

      '<div class="flex gap-12 mt-16">' +
        '<button class="btn btn-primary" id="zapiszUst" type="button">Zapisz ustawienia</button>' +
      '</div>' +
      '</form>' +

      '<div class="panel mt-24">' +
        '<h3 class="panel-title">Dane i kopia zapasowa</h3>' +
        '<p class="muted small mt-0">Wszystkie dane (zlecenia, faktury, kontrahenci) są przechowywane wyłącznie w tej przeglądarce. ' +
          'Regularnie rób kopię zapasową — plik możesz wczytać na innym komputerze.</p>' +
        '<div class="flex gap-12" style="flex-wrap:wrap">' +
          '<button class="btn" id="btnEksport">' + ui.icons.copy + 'Pobierz kopię (JSON)</button>' +
          '<button class="btn" id="btnImport">Wczytaj kopię z pliku</button>' +
          '<input type="file" id="plikImport" accept="application/json,.json" style="display:none" />' +
          '<button class="btn btn-danger" id="btnResetDemo">Załaduj dane przykładowe</button>' +
          '<button class="btn btn-danger" id="btnResetPusty">Wyczyść wszystkie dane</button>' +
        '</div>' +
      '</div>';

    document.getElementById("zapiszUst").addEventListener("click", function () { zapisz(el); });
    document.getElementById("btnEksport").addEventListener("click", eksport);
    document.getElementById("btnImport").addEventListener("click", function () { document.getElementById("plikImport").click(); });
    document.getElementById("plikImport").addEventListener("change", importuj);
    document.getElementById("btnResetDemo").addEventListener("click", function () { resetDane(true); });
    document.getElementById("btnResetPusty").addEventListener("click", function () { resetDane(false); });
  }

  function zapisz(el) {
    const form = document.getElementById("formUst");
    ui.clearErrors(form);
    const d = ui.readForm(form);
    if (!d.nazwa.trim()) { ui.markError(form, "nazwa", "Podaj nazwę firmy."); return; }
    if (d.nip && U.cleanNIP(d.nip).length === 10 && !/[A-Za-z]/.test(d.nip) && !U.isValidNIP(d.nip)) {
      ui.markError(form, "nip", "Nieprawidłowy NIP (suma kontrolna)."); return;
    }
    const u = store.ustawienia();
    u.firma = {
      nazwa: d.nazwa.trim(), nip: d.nip.trim(), regon: d.regon.trim(), krs: d.krs.trim(),
      ulica: d.ulica.trim(), kod: d.kod.trim(), miasto: d.miasto.trim(), kraj: (d.kraj || "Polska").trim(),
      email: d.email.trim(), telefon: d.telefon.trim(), www: d.www.trim(),
      bank: d.bank.trim(), numerKonta: d.numerKonta.trim()
    };
    u.faktura = {
      prefix: d.fa_prefix.trim() || "FV", domyslnaStawkaVat: d.fa_stawka,
      terminPlatnosciDni: U.toNumber(d.fa_termin), sposobPlatnosci: d.fa_sposob.trim() || "Przelew",
      domyslnaJednostka: d.fa_jednostka.trim() || "usługa", domyslnyOpis: d.fa_opis.trim() || "Usługa transportowa",
      uwagi: d.fa_uwagi.trim()
    };
    u.zlecenie = { prefix: d.zl_prefix.trim() || "ZL", domyslnaWaluta: d.zl_waluta };
    store.zapiszUstawienia(u);
    ui.toast("Zapisano ustawienia.", "ok");
    render(el);
  }

  function eksport() {
    const data = store.exportJSON();
    const stamp = U.todayISO();
    U.download("ala-winsped-kopia-" + stamp + ".json", data, "application/json");
    ui.toast("Pobrano kopię zapasową.", "ok");
  }

  function importuj(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function () {
      ui.confirm({
        title: "Wczytać dane z pliku?",
        message: "To zastąpi WSZYSTKIE bieżące dane danymi z pliku „" + file.name + "”. Kontynuować?",
        confirm: "Wczytaj", danger: true
      }).then(function (ok) {
        e.target.value = "";
        if (!ok) return;
        try {
          store.importJSON(reader.result);
          ui.toast("Wczytano dane z kopii.", "ok");
          App.router.reload();
        } catch (err) {
          ui.toast("Nie udało się wczytać pliku: " + err.message, "err", "Błąd importu");
        }
      });
    };
    reader.readAsText(file);
  }

  function resetDane(zDemo) {
    ui.confirm({
      title: zDemo ? "Załadować dane przykładowe?" : "Wyczyścić wszystkie dane?",
      message: (zDemo ? "To USUNIE bieżące dane i wstawi przykładowe zlecenia, faktury i kontrahentów. "
                      : "To trwale USUNIE wszystkie zlecenia, faktury i kontrahentów. Dane firmy zostaną domyślne. ") +
               "Zrób najpierw kopię zapasową, jeśli chcesz zachować dane.",
      confirm: zDemo ? "Załaduj przykłady" : "Wyczyść wszystko", danger: true
    }).then(function (ok) {
      if (!ok) return;
      if (zDemo) store.resetWithDemo(); else store.reset();
      ui.toast(zDemo ? "Załadowano dane przykładowe." : "Wyczyszczono dane.", "ok");
      location.hash = "#/pulpit";
      App.router.reload();
    });
  }

  return { render: render };
})();
