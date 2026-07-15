/* ============================================================
   views_dashboard.js — Pulpit. App.views.dashboard
   ============================================================ */
window.App = window.App || {};
App.views = App.views || {};

App.views.dashboard = (function () {
  "use strict";
  const U = App.utils, ui = App.ui, store = App.store;

  function render(el) {
    ui.setPage("Pulpit", '<a href="#/zlecenia/nowe" class="btn btn-primary">' + ui.icons.plus + 'Nowe zlecenie</a>');

    const zlec = store.all("zlecenia");
    const fak = store.all("faktury");
    const kontr = store.all("kontrahenci");

    const aktywne = zlec.filter(function (z) { return ["nowe", "przyjete", "w_realizacji"].indexOf(z.status) >= 0; });
    const doFaktury = zlec.filter(function (z) { return z.status === "zrealizowane" && !z.fakturaId; });

    const mcNow = U.monthKey(U.todayISO());
    const przychodMc = fak.filter(function (f) { return f.status !== "anulowana" && U.monthKey(f.dataWystawienia) === mcNow; })
      .reduce(function (s, f) { return s + (f.podsumowanie ? f.podsumowanie.netto : 0); }, 0);

    let naleznosci = 0, przeterm = 0, przetermKwota = 0;
    fak.forEach(function (f) {
      if (f.status === "oplacona" || f.status === "anulowana") return;
      const doZap = U.round2((f.podsumowanie ? f.podsumowanie.brutto : 0) - (f.kwotaZaplacona || 0));
      naleznosci += doZap;
      if (f.terminPlatnosci && U.daysBetween(U.todayISO(), f.terminPlatnosci) < 0) { przeterm++; przetermKwota += doZap; }
    });

    // Wykres: przychód netto wg 6 ostatnich miesięcy
    const miesiace = _ostatnieMiesiace(6);
    const dane = miesiace.map(function (ym) {
      const suma = fak.filter(function (f) { return f.status !== "anulowana" && U.monthKey(f.dataWystawienia) === ym; })
        .reduce(function (s, f) { return s + (f.podsumowanie ? f.podsumowanie.netto : 0); }, 0);
      return { ym: ym, suma: suma };
    });
    const maxSuma = Math.max(1, ...dane.map(function (d) { return d.suma; }));

    el.innerHTML =
      '<div class="kpi-grid">' +
        _kpi("Aktywne zlecenia", aktywne.length, U.pluralPl(aktywne.length, "zlecenie w toku", "zlecenia w toku", "zleceń w toku"), "kpi-accent") +
        _kpi("Do zafakturowania", doFaktury.length, "zrealizowane, bez faktury", doFaktury.length > 0 ? "kpi-accent" : "") +
        _kpi("Przychód (ten miesiąc)", U.formatPLN(przychodMc), "netto z faktur", "kpi-green") +
        _kpi("Należności", U.formatPLN(naleznosci), przeterm > 0 ? (przeterm + " po terminie: " + U.formatPLN(przetermKwota)) : "wszystko w terminie", przeterm > 0 ? "kpi-red" : "") +
      '</div>' +

      '<div class="grid-2">' +
        '<div class="panel">' +
          '<div class="flex between items-center mb-16"><h3 class="panel-title mb-0">Przychód netto — ostatnie 6 miesięcy</h3></div>' +
          _wykres(dane, maxSuma) +
        '</div>' +
        '<div class="panel">' +
          '<h3 class="panel-title">Do zafakturowania</h3>' +
          _doFakturyList(doFaktury, kontr) +
        '</div>' +
      '</div>' +

      '<div class="grid-2 mt-16">' +
        '<div class="panel">' +
          '<div class="flex between items-center mb-16"><h3 class="panel-title mb-0">Ostatnie zlecenia</h3>' +
            '<a href="#/zlecenia" class="link-strong small">Wszystkie →</a></div>' +
          _ostatnieZlecenia(zlec, kontr) +
        '</div>' +
        '<div class="panel">' +
          '<div class="flex between items-center mb-16"><h3 class="panel-title mb-0">Ostatnie faktury</h3>' +
            '<a href="#/faktury" class="link-strong small">Wszystkie →</a></div>' +
          _ostatnieFaktury(fak) +
        '</div>' +
      '</div>';

    el.querySelectorAll("[data-fakturuj]").forEach(function (b) {
      b.addEventListener("click", function () { App.views.faktury.wystawZeZlecenia(b.getAttribute("data-fakturuj")); });
    });
  }

  function _kpi(label, value, sub, cls) {
    return '<div class="kpi ' + (cls || "") + '">' +
      '<div class="kpi-label">' + U.esc(label) + '</div>' +
      '<div class="kpi-value">' + value + '</div>' +
      '<div class="kpi-sub">' + U.esc(sub) + '</div></div>';
  }

  function _wykres(dane, maxSuma) {
    return '<div class="bars">' + dane.map(function (d) {
      const h = Math.round((d.suma / maxSuma) * 100);
      return '<div class="bar-col">' +
        '<div class="bar-val">' + (d.suma > 0 ? U.formatKwota(d.suma / 1000).replace(/,\d+$/, "") + " tys." : "") + '</div>' +
        '<div class="bar" style="height:' + Math.max(h, d.suma > 0 ? 4 : 0) + '%" title="' + U.formatPLN(d.suma) + '"></div>' +
        '<div class="bar-label">' + U.monthLabelShort(d.ym) + '</div>' +
      '</div>';
    }).join("") + '</div>';
  }

  function _doFakturyList(lista, kontr) {
    if (!lista.length) return '<div class="muted small" style="padding:14px 0">Brak zleceń oczekujących na fakturę. 👍</div>';
    return '<div class="table-wrap" style="border:none">' +
      lista.slice(0, 6).map(function (z) {
        const k = kontr.find(function (c) { return c.id === z.zleceniodawcaId; });
        return '<div class="flex between items-center" style="padding:10px 0;border-bottom:1px solid var(--border-soft)">' +
          '<div><div class="t-strong">' + U.esc(z.numer) + '</div>' +
            '<div class="muted small">' + U.esc(k ? k.nazwa : "—") + ' · ' + U.formatPLN(z.fracht ? z.fracht.sprzedaz : 0) + '</div></div>' +
          '<button class="btn btn-sm btn-primary" data-fakturuj="' + z.id + '">Wystaw fakturę</button>' +
        '</div>';
      }).join("") + '</div>';
  }

  function _ostatnieZlecenia(zlec, kontr) {
    if (!zlec.length) return ui.empty({ title: "Brak zleceń", text: "Dodaj pierwsze zlecenie transportowe." });
    const rows = zlec.slice(0, 5).map(function (z) {
      const k = kontr.find(function (c) { return c.id === z.zleceniodawcaId; });
      return '<tr onclick="location.hash=\'#/zlecenia/' + z.id + '\'" style="cursor:pointer">' +
        '<td class="t-strong">' + U.esc(z.numer) + '</td>' +
        '<td>' + U.esc(k ? k.nazwa : "—") + '</td>' +
        '<td class="muted small">' + U.esc((z.zaladunek && z.zaladunek.miasto) || "?") + ' → ' + U.esc((z.rozladunek && z.rozladunek.miasto) || "?") + '</td>' +
        '<td>' + ui.statusZleceniaBadge(z.status) + '</td>' +
      '</tr>';
    }).join("");
    return '<div class="table-wrap" style="border:none"><table class="grid"><tbody>' + rows + '</tbody></table></div>';
  }

  function _ostatnieFaktury(fak) {
    if (!fak.length) return ui.empty({ title: "Brak faktur", text: "Faktury wystawisz ze zrealizowanych zleceń." });
    const rows = fak.slice(0, 5).map(function (f) {
      return '<tr onclick="location.hash=\'#/faktury/' + f.id + '\'" style="cursor:pointer">' +
        '<td class="t-strong">' + U.esc(f.numer) + '</td>' +
        '<td>' + U.esc(f.nabywca ? f.nabywca.nazwa : "—") + '</td>' +
        '<td class="t-right t-mono">' + U.formatPLN(f.podsumowanie ? f.podsumowanie.brutto : 0) + '</td>' +
        '<td>' + ui.statusFakturyBadge(ui.fakturaStatusEfektywny(f)) + '</td>' +
      '</tr>';
    }).join("");
    return '<div class="table-wrap" style="border:none"><table class="grid"><tbody>' + rows + '</tbody></table></div>';
  }

  function _ostatnieMiesiace(n) {
    const out = [];
    const d = new Date();
    d.setDate(1);
    for (let i = n - 1; i >= 0; i--) {
      const t = new Date(d.getFullYear(), d.getMonth() - i, 1);
      out.push(t.getFullYear() + "-" + String(t.getMonth() + 1).padStart(2, "0"));
    }
    return out;
  }

  return { render: render };
})();
