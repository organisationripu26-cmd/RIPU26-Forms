/*!
 * RIPU26 — moteur de formulaire multi-étapes (arrival.html, excursion.html)
 * Même modèle de données que index.html : chaque champ est décrit par
 *   { k, l, t, r, o, i, c, h, ph, ac, max }
 *   k  clé envoyée à l'API            t  text|email|tel|time|select|radio|multi|check|area
 *   l  libellé                        r  obligatoire (1)
 *   o  options [[valeur, libellé]]    h  aide sous le champ        ph placeholder
 *   i  condition ["clé", valeur|[valeurs]]    c  condition fonctionnelle (d)=>bool
 *   ac attribut autocomplete
 * La validation est refaite côté serveur : ce code n'est qu'un confort d'utilisation.
 */
(function (global) {
  'use strict';

  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var PHONE = /^\+?[0-9][0-9 ().-]{6,18}$/;
  var FLIGHT = /^[A-Za-z0-9]{2}\s?\d{1,4}[A-Za-z]?$/;

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function uuid() {
    if (global.crypto && crypto.randomUUID) return crypto.randomUUID();
    var b = new Uint8Array(16); (global.crypto || {}).getRandomValues ? crypto.getRandomValues(b) : b.forEach(function (_, i) { b[i] = Math.random() * 256; });
    b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    var h = Array.prototype.map.call(b, function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  }

  function mount(cfg) {
    var L = Object.assign({
      next: 'Continuer', back: 'Retour', send: 'Envoyer', sending: 'Envoi en cours…', retry: 'Réessayer',
      required: 'Ce champ est obligatoire.', choose: 'Choisir…',
      fail: "L'envoi a échoué. Vérifiez votre connexion puis réessayez : vos réponses sont conservées.",
      stepOf: function (n, t) { return 'Étape ' + n + ' sur ' + t; }
    }, cfg.labels || {});
    var card = document.querySelector(cfg.card || '#card');
    var steps = cfg.steps, D = {}, cur = 0, busy = false, key = uuid();
    var qs = new URLSearchParams(location.search);
    ['email', 'prenom', 'nom'].forEach(function (k) { var v = (qs.get(k) || '').trim().slice(0, 120); if (v) D[k] = v; });

    // ---- visibilité ---------------------------------------------------
    function vis(f) {
      if (f.c) return !!f.c(D);
      if (!f.i) return true;
      var v = D[f.i[0]], w = [].concat(f.i[1]);
      return Array.isArray(v) ? v.some(function (x) { return w.indexOf(x) > -1; }) : w.indexOf(v) > -1;
    }
    function stepVisible(s) { return s.f.some(vis); }
    function nextIdx(from, dir) { for (var i = from + dir; i >= 0 && i < steps.length; i += dir) if (stepVisible(steps[i])) return i; return -1; }

    // ---- champs -------------------------------------------------------
    function field(f) {
      var w = el('div', 'f'); w.dataset.k = f.k;
      var errId = 'e_' + f.k, c;
      if (f.t === 'radio' || f.t === 'multi' || f.t === 'check') {
        c = el('fieldset');
        if (f.t !== 'check') c.append(el('legend', '', f.l + (f.r ? '' : '')));
        (f.t === 'check' ? [[1, f.l]] : f.o).forEach(function (op) {
          var v = op[0], l = op[1], b = el('label', 'o'), i = el('input');
          i.type = f.t === 'radio' ? 'radio' : 'checkbox'; i.name = f.k; i.value = v;
          i.setAttribute('aria-describedby', errId);
          i.onchange = function () {
            D[f.k] = f.t === 'radio' ? v : f.t === 'check' ? i.checked :
              Array.prototype.map.call(c.querySelectorAll('input:checked'), function (x) { return x.value; });
            refresh();
          };
          b.append(i, el('span', '', l)); c.append(b);
        });
      } else {
        c = el('div');
        var lab = el('label', 'q', f.l); lab.htmlFor = 'i_' + f.k; c.append(lab);
        var i = f.t === 'select' ? el('select') : f.t === 'area' ? el('textarea') : el('input');
        i.id = 'i_' + f.k; i.name = f.k; i.setAttribute('aria-describedby', errId);
        if (f.r) i.setAttribute('aria-required', 'true');
        if (f.t === 'select') {
          i.append(new Option(L.choose, ''));
          f.o.forEach(function (op) { i.append(new Option(op[1], op[0])); });
        } else if (f.t !== 'area') {
          i.type = f.t;
          if (f.t === 'email') { i.inputMode = 'email'; i.autocomplete = f.ac || 'email'; }
          if (f.t === 'tel') { i.inputMode = 'tel'; i.autocomplete = f.ac || 'tel'; }
          if (f.t === 'text' && f.ac) i.autocomplete = f.ac;
          if (f.k === 'vol') { i.autocapitalize = 'characters'; i.autocomplete = 'off'; }
        }
        if (f.ph) i.placeholder = f.ph;
        i.maxLength = f.max || 500;
        i.oninput = i.onchange = function () { D[f.k] = i.value.trim(); refresh(); };
        c.append(i);
      }
      if (f.h) c.append(el('div', 'hint', f.h));
      var err = el('div', 'err'); err.id = errId; err.setAttribute('role', 'alert'); c.append(err);
      w.append(c); return w;
    }
    function restore(s) {
      s.f.forEach(function (f) {
        var v = D[f.k]; if (v == null) return;
        var w = card.querySelector('[data-k="' + f.k + '"]'); if (!w) return;
        w.querySelectorAll('input,select,textarea').forEach(function (i) {
          if (i.type === 'checkbox' || i.type === 'radio') i.checked = Array.isArray(v) ? v.indexOf(i.value) > -1 : (v === i.value || v === true);
          else i.value = v;
        });
      });
    }
    function refresh() {
      steps[cur].f.forEach(function (f) {
        var w = card.querySelector('[data-k="' + f.k + '"]'); if (w) w.hidden = !vis(f);
      });
      var last = nextIdx(cur, 1) < 0, b = card.querySelector('.pri');
      if (b && !busy) b.textContent = last ? L.send : L.next;
      if (cfg.onChange) cfg.onChange(D, { step: cur });
    }

    // ---- validation ---------------------------------------------------
    function check(f) {
      var v = D[f.k], empty = v == null || v === '' || v === false || (Array.isArray(v) && !v.length);
      if (f.r && empty) return L.required;
      if (empty) return '';
      if (f.t === 'email' && !EMAIL.test(v)) return 'Adresse e-mail invalide.';
      if (f.t === 'tel' && !PHONE.test(v)) return 'Numéro invalide. Exemple : +216 55 595 234';
      if (f.k === 'vol' && !FLIGHT.test(v)) return 'Numéro de vol invalide. Exemple : TU 718';
      return '';
    }
    function setErr(k, msg) {
      var w = card.querySelector('[data-k="' + k + '"]'); if (!w) return null;
      w.classList.toggle('bad', !!msg);
      w.querySelector('.err').textContent = msg || '';
      w.querySelectorAll('input,select,textarea').forEach(function (i) { msg ? i.setAttribute('aria-invalid', 'true') : i.removeAttribute('aria-invalid'); });
      return w;
    }
    function validate() {
      var ok = true, first = null;
      steps[cur].f.forEach(function (f) {
        var m = vis(f) ? check(f) : '', w = setErr(f.k, m);
        if (m && ok) { ok = false; first = w; }
      });
      if (first) {
        first.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
        var i = first.querySelector('input,select,textarea'); if (i) i.focus({ preventScroll: true });
      }
      return ok;
    }

    // ---- rendu d'une étape -------------------------------------------
    function show(n, dir) {
      cur = n; card.replaceChildren();
      var s = steps[n], st = el('div', 'step'); if (dir < 0) st.classList.add('back');
      var vs = steps.filter(stepVisible), pos = vs.indexOf(s) + 1;
      var dots = el('div', 'dots'); dots.setAttribute('role', 'img'); dots.setAttribute('aria-label', L.stepOf(pos, vs.length));
      vs.forEach(function (_, i) { dots.append(el('i', i < pos ? 'on' : '')); });
      var h = el('h2', '', s.t); h.tabIndex = -1; h.id = 'step_title';
      st.append(dots, h);
      if (s.h) st.append(el('p', 'hint', s.h));
      s.f.forEach(function (f) { st.append(field(f)); });
      var hp = el('input', 'hp'); hp.tabIndex = -1; hp.autocomplete = 'off'; hp.name = 'website'; hp.setAttribute('aria-hidden', 'true'); st.append(hp);
      var nav = el('div', 'nav');
      if (nextIdx(n, -1) >= 0) { var b = el('button', 'sec', L.back); b.type = 'button'; b.onclick = function () { show(nextIdx(cur, -1), -1); }; nav.append(b); }
      var nx = el('button', 'pri', L.next); nx.type = 'button';
      nx.onclick = function () { if (!validate()) return; var n2 = nextIdx(cur, 1); n2 >= 0 ? show(n2, 1) : send(nx, hp); };
      nav.append(nx); st.append(nav); card.append(st);
      restore(s); refresh();
      if (cfg.onStep) cfg.onStep(n, D);
      if (n > 0 || dir) { h.focus({ preventScroll: true }); card.scrollIntoView({ behavior: 'auto', block: 'start' }); }
    }

    // ---- envoi --------------------------------------------------------
    function payload() {
      var data = {};
      steps.forEach(function (s) { s.f.forEach(function (f) { if (vis(f) && D[f.k] != null && D[f.k] !== '') data[f.k] = D[f.k]; }); });
      return data;
    }
    function warn(msg) {
      var old = card.querySelector('.warn'); if (old) old.remove();
      var w = el('div', 'warn', msg); w.setAttribute('role', 'alert');
      card.querySelector('.nav').before(w);
    }
    function send(btn, hp) {
      if (busy) return; busy = true; btn.disabled = true; btn.textContent = L.sending;
      var data = payload();
      fetch(cfg.endpoint || '/api/submit', {
        method: 'POST', headers: { 'content-type': 'application/json' }, redirect: 'follow',
        body: JSON.stringify({ form: cfg.form, key: key, hp: hp.value, data: data })
      }).then(function (r) { return r.json().then(function (j) { return { s: r.status, j: j }; }); })
        .then(function (x) {
          if (x.j && x.j.ok) { busy = false; done(data, x.j); return; }
          busy = false; btn.disabled = false;
          if (x.s === 400 && x.j.errors) {
            // Le serveur a refusé une valeur : on retourne à l'étape concernée.
            var keys = Object.keys(x.j.errors), target = -1;
            steps.forEach(function (s, i) { if (target < 0 && s.f.some(function (f) { return keys.indexOf(f.k) > -1; })) target = i; });
            if (target >= 0) { show(target, -1); keys.forEach(function (k) { setErr(k, x.j.errors[k]); }); return; }
          }
          btn.textContent = L.retry; warn((x.j && x.j.error) || L.fail);
        })
        .catch(function () { busy = false; btn.disabled = false; btn.textContent = L.retry; warn(L.fail); });
    }
    function done(data, res) {
      card.replaceChildren();
      var node = cfg.done(data, res, D);
      card.append(node); card.classList.add('is-done');
      var h = node.querySelector('h2'); if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); }
      card.scrollIntoView({ block: 'start' });
    }

    show(0, 0);
    return { data: D, show: show };
  }

  global.RIPU = { mount: mount, el: el };
})(window);
