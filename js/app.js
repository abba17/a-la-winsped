/* ============================================================
   app.js — router (hash) + inicjalizacja aplikacji. App.router
   ============================================================ */
window.App = window.App || {};

App.router = (function () {
  "use strict";
  const ui = App.ui;

  function view() { return document.getElementById("view"); }

  function parse() {
    let h = location.hash.replace(/^#\/?/, "");
    return h.split("/").filter(function (x) { return x !== ""; });
  }

  function route() {
    const seg = parse();
    const v = view();
    const glowna = seg[0] || "pulpit";
    setActive(glowna);
    window.scrollTo(0, 0);

    try {
      switch (glowna) {
        case "pulpit":
          App.views.dashboard.render(v); break;

        case "zlecenia":
          if (!seg[1]) App.views.zlecenia.render(v);
          else if (seg[1] === "nowe") App.views.zlecenia.formularz(v, null);
          else if (seg[2] === "edytuj") App.views.zlecenia.formularz(v, seg[1]);
          else App.views.zlecenia.szczegoly(v, seg[1]);
          break;

        case "kontrahenci":
          App.views.kontrahenci.render(v); break;

        case "faktury":
          if (!seg[1]) App.views.faktury.render(v);
          else if (seg[1] === "nowa") App.views.faktury.formularz(v, null);
          else if (seg[2] === "edytuj") App.views.faktury.formularz(v, seg[1]);
          else App.views.faktury.szczegoly(v, seg[1]);
          break;

        case "ustawienia":
          App.views.ustawienia.render(v); break;

        default:
          location.hash = "#/pulpit";
      }
    } catch (e) {
      console.error("Błąd renderowania widoku:", e);
      v.innerHTML = '<div class="panel"><h3 class="panel-title">Wystąpił błąd</h3><p class="muted">' +
        App.utils.esc(e.message) + '</p><a href="#/pulpit" class="btn mt-8">Wróć do pulpitu</a></div>';
    }
    zamknijMenuMobile();
  }

  function setActive(glowna) {
    document.querySelectorAll(".nav-item").forEach(function (a) {
      a.classList.toggle("active", a.getAttribute("data-route") === glowna);
    });
  }

  function reload() { route(); }

  /* ---------- Menu mobilne ---------- */
  function otworzMenuMobile() {
    document.getElementById("sidebar").classList.add("open");
    if (!document.querySelector(".scrim")) {
      const s = document.createElement("div"); s.className = "scrim";
      s.addEventListener("click", zamknijMenuMobile);
      document.body.appendChild(s);
    }
  }
  function zamknijMenuMobile() {
    const sb = document.getElementById("sidebar");
    if (sb) sb.classList.remove("open");
    const s = document.querySelector(".scrim"); if (s) s.remove();
  }

  function init() {
    App.store.load();

    // Nawigacja hash
    window.addEventListener("hashchange", route);
    if (!location.hash) location.hash = "#/pulpit";

    // Menu mobilne
    document.getElementById("btnMenu").addEventListener("click", otworzMenuMobile);

    // Szybka kopia zapasowa z panelu bocznego
    document.getElementById("btnBackup").addEventListener("click", function () {
      App.utils.download("ala-winsped-kopia-" + App.utils.todayISO() + ".json", App.store.exportJSON(), "application/json");
      ui.toast("Pobrano kopię zapasową.", "ok");
    });

    route();
  }

  return { init: init, reload: reload, route: route };
})();

document.addEventListener("DOMContentLoaded", App.router.init);
