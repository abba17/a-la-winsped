/* ============================================================
   ui.js — wspólne komponenty interfejsu. App.ui
   Toast, modal, confirm, statusy, ikonki, pomocnicze rendery.
   ============================================================ */
window.App = window.App || {};

App.ui = (function () {
  "use strict";
  const U = App.utils;

  /* ---------- Powiadomienia (toast) ---------- */
  function toast(msg, typ, tytul) {
    const root = document.getElementById("toastRoot");
    const el = document.createElement("div");
    el.className = "toast " + (typ || "ok");
    el.innerHTML = (tytul ? "<strong>" + U.esc(tytul) + "</strong>" : "") + U.esc(msg);
    root.appendChild(el);
    setTimeout(function () {
      el.style.transition = "opacity .3s, transform .3s";
      el.style.opacity = "0"; el.style.transform = "translateX(20px)";
      setTimeout(function () { el.remove(); }, 300);
    }, 3200);
  }

  /* ---------- Modal ---------- */
  // openModal({title, subtitle, body(HTMLString), wide, footer(HTMLString), onMount(rootEl, close)})
  function openModal(opts) {
    const root = document.getElementById("modalRoot");
    const back = document.createElement("div");
    back.className = "modal-back";
    back.innerHTML =
      '<div class="modal ' + (opts.wide ? "wide" : "") + '" role="dialog" aria-modal="true">' +
        '<div class="modal-head">' +
          '<div><h2>' + U.esc(opts.title || "") + '</h2>' +
          (opts.subtitle ? '<div class="sub">' + U.esc(opts.subtitle) + '</div>' : "") + '</div>' +
          '<button class="icon-btn close" data-close aria-label="Zamknij">' +
            '<svg viewBox="0 0 24 24" class="ico"><path d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7 4.3 4.3l6.3 6.3 6.3-6.3z"/></svg>' +
          '</button>' +
        '</div>' +
        '<div class="modal-body">' + (opts.body || "") + '</div>' +
        (opts.footer ? '<div class="modal-foot">' + opts.footer + '</div>' : "") +
      '</div>';
    root.appendChild(back);

    function close() {
      back.style.animation = "none";
      back.style.opacity = "0";
      setTimeout(function () { back.remove(); }, 120);
      document.removeEventListener("keydown", onKey);
    }
    function onKey(e) { if (e.key === "Escape") close(); }
    document.addEventListener("keydown", onKey);
    back.addEventListener("mousedown", function (e) { if (e.target === back) close(); });
    back.querySelectorAll("[data-close]").forEach(function (b) { b.addEventListener("click", close); });

    if (typeof opts.onMount === "function") opts.onMount(back, close);
    return { el: back, close: close };
  }

  // Potwierdzenie akcji. Zwraca Promise<boolean>
  function confirm(opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      const m = openModal({
        title: opts.title || "Potwierdź",
        body: '<p style="margin:0;color:var(--text)">' + U.esc(opts.message || "Czy na pewno?") + '</p>',
        footer:
          '<button class="btn btn-ghost" data-no>' + U.esc(opts.cancel || "Anuluj") + '</button>' +
          '<button class="btn ' + (opts.danger ? "btn-danger" : "btn-primary") + '" data-yes>' + U.esc(opts.confirm || "Potwierdź") + '</button>',
        onMount: function (root, close) {
          root.querySelector("[data-yes]").addEventListener("click", function () { close(); resolve(true); });
          root.querySelector("[data-no]").addEventListener("click", function () { close(); resolve(false); });
        }
      });
    });
  }

  /* ---------- Statusy zleceń ---------- */
  const STATUSY_ZLECENIA = {
    nowe:          { label: "Nowe",           badge: "badge-slate" },
    przyjete:      { label: "Przyjęte",       badge: "badge-blue" },
    w_realizacji:  { label: "W realizacji",   badge: "badge-amber" },
    zrealizowane:  { label: "Zrealizowane",   badge: "badge-green" },
    zafakturowane: { label: "Zafakturowane",  badge: "badge-violet" },
    anulowane:     { label: "Anulowane",      badge: "badge-red" }
  };
  function statusZleceniaBadge(status) {
    const s = STATUSY_ZLECENIA[status] || { label: status, badge: "badge-slate" };
    return '<span class="badge ' + s.badge + '">' + U.esc(s.label) + '</span>';
  }

  const STATUSY_FAKTURY = {
    wystawiona:  { label: "Wystawiona",  badge: "badge-blue" },
    oplacona:    { label: "Opłacona",    badge: "badge-green" },
    czesciowa:   { label: "Częściowa",   badge: "badge-amber" },
    przeterminowana: { label: "Po terminie", badge: "badge-red" },
    anulowana:   { label: "Anulowana",   badge: "badge-slate" }
  };
  function statusFakturyBadge(status) {
    const s = STATUSY_FAKTURY[status] || { label: status, badge: "badge-slate" };
    return '<span class="badge ' + s.badge + '">' + U.esc(s.label) + '</span>';
  }
  // Efektywny status faktury (uwzględnia przeterminowanie)
  function fakturaStatusEfektywny(f) {
    if (f.status === "oplacona" || f.status === "anulowana" || f.status === "czesciowa") return f.status;
    if (f.terminPlatnosci && U.daysBetween(U.todayISO(), f.terminPlatnosci) < 0) return "przeterminowana";
    return f.status || "wystawiona";
  }

  /* ---------- Puste stany ---------- */
  function empty(opts) {
    return '<div class="empty">' +
      '<svg viewBox="0 0 24 24"><path d="M4 4h16v4H4V4Zm0 6h16v10H4V10Zm3 3v2h10v-2H7Z"/></svg>' +
      '<h3>' + U.esc(opts.title || "Brak danych") + '</h3>' +
      '<p>' + U.esc(opts.text || "") + '</p>' +
      (opts.actionHtml || "") + '</div>';
  }

  /* ---------- Budowanie pól formularza ---------- */
  function field(o) {
    // o: {name, label, value, type, required, placeholder, hint, span, options[], rows}
    const id = "f_" + o.name;
    const req = o.required ? ' <span class="req">*</span>' : "";
    const span = o.span === 2 ? " col-span-2" : "";
    let control;
    const val = o.value == null ? "" : o.value;
    if (o.type === "select") {
      control = '<select class="select" id="' + id + '" name="' + o.name + '"' + (o.required ? " required" : "") + '>' +
        (o.options || []).map(function (opt) {
          const v = typeof opt === "object" ? opt.value : opt;
          const l = typeof opt === "object" ? opt.label : opt;
          return '<option value="' + U.esc(v) + '"' + (String(v) === String(val) ? " selected" : "") + '>' + U.esc(l) + '</option>';
        }).join("") + '</select>';
    } else if (o.type === "textarea") {
      control = '<textarea class="input" id="' + id + '" name="' + o.name + '" rows="' + (o.rows || 3) + '" placeholder="' + U.esc(o.placeholder || "") + '">' + U.esc(val) + '</textarea>';
    } else {
      control = '<input class="input" id="' + id + '" name="' + o.name + '" type="' + (o.type || "text") + '" value="' + U.esc(val) + '" placeholder="' + U.esc(o.placeholder || "") + '"' +
        (o.required ? " required" : "") + (o.step ? ' step="' + o.step + '"' : "") + (o.min != null ? ' min="' + o.min + '"' : "") + ' />';
    }
    return '<div class="field' + span + '">' +
      '<label for="' + id + '">' + U.esc(o.label) + req + '</label>' +
      control +
      (o.hint ? '<div class="field-hint">' + U.esc(o.hint) + '</div>' : "") +
      '<div class="field-err" data-err-for="' + o.name + '"></div>' +
      '</div>';
  }

  // Zbiera wartości formularza jako obiekt
  function readForm(formEl) {
    const data = {};
    formEl.querySelectorAll("input, select, textarea").forEach(function (el) {
      if (!el.name) return;
      data[el.name] = el.value;
    });
    return data;
  }
  function markError(formEl, name, msg) {
    const el = formEl.querySelector('[name="' + name + '"]');
    if (el) el.classList.add("err");
    const errBox = formEl.querySelector('[data-err-for="' + name + '"]');
    if (errBox) errBox.textContent = msg || "";
  }
  function clearErrors(formEl) {
    formEl.querySelectorAll(".err").forEach(function (e) { e.classList.remove("err"); });
    formEl.querySelectorAll(".field-err").forEach(function (e) { e.textContent = ""; });
  }

  /* ---------- Ustawienie tytułu i akcji strony ---------- */
  function setPage(title, actionsHtml) {
    document.getElementById("pageTitle").textContent = title;
    document.getElementById("pageActions").innerHTML = actionsHtml || "";
  }

  /* ---------- Ikony (inline SVG) ---------- */
  const icons = {
    plus: '<svg viewBox="0 0 24 24" class="ico"><path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5Z"/></svg>',
    edit: '<svg viewBox="0 0 24 24" class="ico"><path d="M3 17.25V21h3.75L17.8 9.94l-3.75-3.75L3 17.25ZM20.7 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83Z"/></svg>',
    trash: '<svg viewBox="0 0 24 24" class="ico"><path d="M6 7h12v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7Zm3-3h6l1 2h4v2H4V6h4l1-2Z"/></svg>',
    print: '<svg viewBox="0 0 24 24" class="ico"><path d="M6 9V3h12v6h2a1 1 0 0 1 1 1v7h-4v3H7v-3H3v-7a1 1 0 0 1 1-1h2Zm2 0h8V5H8v4Zm0 8h8v-4H8v4Z"/></svg>',
    invoice: '<svg viewBox="0 0 24 24" class="ico"><path d="M6 2h9l5 5v15H6V2Zm2 8h8v1.5H8V10Zm0 3.5h8V15H8v-1.5Z"/></svg>',
    eye: '<svg viewBox="0 0 24 24" class="ico"><path d="M12 5c-5 0-9 4.5-10 7 1 2.5 5 7 10 7s9-4.5 10-7c-1-2.5-5-7-10-7Zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8Z"/></svg>',
    search: '<svg viewBox="0 0 24 24" class="ico"><path d="m21 20-5.6-5.6a7 7 0 1 0-1.4 1.4L20 21l1-1ZM5 10a5 5 0 1 1 10 0 5 5 0 0 1-10 0Z"/></svg>',
    copy: '<svg viewBox="0 0 24 24" class="ico"><path d="M8 8V4h12v12h-4v4H4V8h4Zm2 0h6v6h2V6h-8v2Zm-4 2v8h8v-8H6Z"/></svg>'
  };

  return {
    toast: toast, openModal: openModal, confirm: confirm,
    statusZleceniaBadge: statusZleceniaBadge, STATUSY_ZLECENIA: STATUSY_ZLECENIA,
    statusFakturyBadge: statusFakturyBadge, STATUSY_FAKTURY: STATUSY_FAKTURY, fakturaStatusEfektywny: fakturaStatusEfektywny,
    empty: empty, field: field, readForm: readForm, markError: markError, clearErrors: clearErrors,
    setPage: setPage, icons: icons
  };
})();
