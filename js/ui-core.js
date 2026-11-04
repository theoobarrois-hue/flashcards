/* Flashcards — briques d'interface : icônes, modales, menus, boîtes de dialogue */
(function () {
  'use strict';
  var FC = window.FC;
  var UI = (FC.ui = FC.ui || {});

  UI.$ = function (s, r) { return (r || document).querySelector(s); };
  UI.$$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = (UI.esc = function (s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  });

  /* ---------- Icônes ---------- */
  var P = {
    plus: '<path d="M12 5v14M5 12h14"/>',
    shuffle: '<path d="M16 3h5v5"/><path d="M4 20L21 3"/><path d="M21 16v5h-5"/><path d="M15 15l6 6"/><path d="M4 4l5 5"/>',
    chevR: '<path d="M9 5l7 7-7 7"/>',
    chevL: '<path d="M15 5l-7 7 7 7"/>',
    chevD: '<path d="M5 9l7 7 7-7"/>',
    flag: '<path d="M6 21V4M6 4h11l-2 4 2 4H6"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    grid: '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    upload: '<path d="M12 15V4M7 9l5-5 5 5M5 20h14"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    more: '<circle cx="5" cy="12" r="1.7" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.7" fill="currentColor" stroke="none"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>',
    move: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M10 13h6M13.5 10.5L16 13l-2.5 2.5"/>',
    palette: '<circle cx="12" cy="12" r="9"/><circle cx="8.5" cy="10" r="1" fill="currentColor"/><circle cx="12" cy="7.5" r="1" fill="currentColor"/><circle cx="15.5" cy="10" r="1" fill="currentColor"/>',
    cloud: '<path d="M7 18a4 4 0 0 1-.6-7.96A5.5 5.5 0 0 1 17 8.5 4.75 4.75 0 0 1 17.5 18z"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    cards: '<rect x="3" y="6" width="15" height="13" rx="3" transform="rotate(-8 10 12)"/><rect x="6" y="4" width="15" height="13" rx="3"/>',
    book: '<path d="M5 4h9a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h9"/>',
    reset: '<path d="M4 12a8 8 0 1 0 3-6.2M4 4v4h4"/>',
    flip: '<path d="M4 12a8 8 0 0 1 14-5l2-2v6h-6l2.2-2.2A5.5 5.5 0 0 0 6.5 12M20 12a8 8 0 0 1-14 5l-2 2v-6h6l-2.2 2.2A5.5 5.5 0 0 0 17.5 12"/>'
  };
  UI.ic = function (name, size, sw) {
    return '<svg class="ic" width="' + (size || 18) + '" height="' + (size || 18) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (sw || 2) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + P[name] + '</svg>';
  };

  UI.folderSVG = function (c) {
    return '<svg viewBox="0 0 200 150" width="100%" aria-hidden="true" class="fsvg">' +
      '<path d="M10 18a8 8 0 0 1 8-8h50a8 8 0 0 1 6.2 3l9 11H182a8 8 0 0 1 8 8v110a8 8 0 0 1-8 8H18a8 8 0 0 1-8-8z" fill="' + c.back + '"/>' +
      '<g transform="rotate(-3 100 70)"><rect x="22" y="22" width="152" height="96" rx="6" fill="#efe6d2"/></g>' +
      '<g transform="rotate(2.5 100 70)"><rect x="24" y="28" width="152" height="96" rx="6" fill="#fffdf8"/><rect x="40" y="44" width="64" height="4" rx="2" fill="#e3d9c5"/><rect x="40" y="56" width="92" height="4" rx="2" fill="#ece3d1"/></g>' +
      '<path d="M10 64a10 10 0 0 1 10-10h160a10 10 0 0 1 10 10v68a10 10 0 0 1-10 10H20a10 10 0 0 1-10-10z" fill="' + c.front + '"/>' +
      '<path d="M20 54h160a10 10 0 0 1 10 10v1H10v-1a10 10 0 0 1 10-10z" fill="#ffffff" opacity=".14"/></svg>';
  };
  UI.stackIcon = function (c, size) {
    size = size || 46;
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 46 46" aria-hidden="true" class="sicon"><rect width="46" height="46" rx="13" fill="' + c.soft + '"/>' +
      '<rect x="9" y="12" width="22" height="18" rx="4" transform="rotate(-8 20 21)" fill="' + c.front + '" opacity=".35"/>' +
      '<rect x="13" y="10" width="22" height="18" rx="4" fill="' + c.front + '"/><path d="M18 17h12M18 22h7" stroke="#fffdf8" stroke-width="2" stroke-linecap="round"/></svg>';
  };

  /* ---------- Toast ---------- */
  var toastTimer = null;
  UI.toast = function (msg) {
    var t = UI.$('#toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 3600);
  };

  /* ---------- Modale ---------- */
  var current = null;
  UI.modalOpen = function () { return !!current; };
  UI.closeModal = function () { if (current) current.done(null); };

  UI.modal = function (o) {
    if (current) current.done(null);
    return new Promise(function (resolve) {
      var wrap = document.createElement('div');
      wrap.className = 'modal-back';
      var btns = (o.buttons || []).map(function (b) {
        return '<button type="button" class="btn ' + (b.kind || '') + '" data-m="' + esc(b.id) + '">' + esc(b.label) + '</button>';
      }).join('');
      wrap.innerHTML = '<div class="modal' + (o.wide ? ' wide' : '') + '" role="dialog" aria-modal="true" aria-label="' + esc(o.title) + '">' +
        '<div class="modal-head"><h2>' + esc(o.title) + '</h2><button type="button" class="iconbtn" data-m="cancel" aria-label="Fermer">' + UI.ic('x', 20) + '</button></div>' +
        '<div class="modal-body">' + o.body + '</div>' +
        (btns ? '<div class="modal-foot">' + btns + '</div>' : '') + '</div>';
      var prevFocus = document.activeElement;
      function done(v) {
        if (!current || current.wrap !== wrap) return;
        current = null;
        document.removeEventListener('keydown', onKey, true);
        wrap.classList.add('out');
        setTimeout(function () { wrap.remove(); }, 120);
        try { if (prevFocus && prevFocus.focus) prevFocus.focus({ preventScroll: true }); } catch (e) { /* rien */ }
        resolve(v);
      }
      function press(id) {
        if (id === 'cancel') return done(null);
        var v = o.collect ? o.collect(wrap, id) : id;
        if (v === false) return;
        done(v);
      }
      function onKey(e) {
        if (e.key === 'Escape') { e.stopPropagation(); done(null); }
        else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
          var p = UI.$('.btn.primary', wrap);
          if (p) { e.preventDefault(); press(p.dataset.m); }
        } else if (e.key === 'Enter' && e.target && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox' && !e.target.dataset.noenter) {
          var p2 = UI.$('.btn.primary', wrap);
          if (p2) { e.preventDefault(); press(p2.dataset.m); }
        }
      }
      wrap.addEventListener('click', function (e) {
        if (e.target === wrap) return done(null);
        var b = e.target.closest('[data-m]');
        if (b) press(b.dataset.m);
      });
      document.addEventListener('keydown', onKey, true);
      current = { wrap: wrap, done: done };
      UI.$('#modal-root').appendChild(wrap);
      if (o.onOpen) o.onOpen(wrap, done);
      var f = UI.$('[data-autofocus]', wrap) || UI.$('input:not([type=checkbox]),textarea', wrap);
      if (f && !(window.matchMedia && matchMedia('(pointer:coarse)').matches && o.noMobileFocus)) { try { f.focus({ preventScroll: true }); if (f.select && o.selectAll) f.select(); } catch (e) { /* rien */ } }
    });
  };

  /* ---------- Menu d'actions ---------- */
  UI.menu = function (title, items, sub) {
    var body = (sub ? '<p class="msub">' + esc(sub) + '</p>' : '') + '<div class="menu">' + items.map(function (it) {
      return '<button type="button" class="mrow' + (it.danger ? ' danger' : '') + '" data-m="' + esc(it.id) + '">' + (it.icon ? UI.ic(it.icon, 18) : '') + '<span>' + esc(it.label) + '</span></button>';
    }).join('') + '</div>';
    return UI.modal({ title: title, body: body, sheet: true });
  };

  /* ---------- Boîtes simples ---------- */
  UI.askName = function (title, label, value, okLabel) {
    return UI.modal({
      title: title,
      body: '<label class="field"><span>' + esc(label) + '</span><input type="text" id="nm" maxlength="120" autocomplete="off" value="' + esc(value || '') + '"></label>',
      buttons: [{ id: 'cancel', label: 'Annuler' }, { id: 'ok', label: okLabel || 'Enregistrer', kind: 'primary' }],
      selectAll: true,
      collect: function (el) {
        var v = UI.$('#nm', el).value.trim();
        if (!v) { UI.$('#nm', el).focus(); return false; }
        return v;
      }
    });
  };
  UI.confirm = function (title, msg, okLabel, danger) {
    return UI.modal({
      title: title,
      body: '<p class="msg">' + esc(msg) + '</p>',
      buttons: [{ id: 'cancel', label: 'Annuler' }, { id: 'ok', label: okLabel || 'Confirmer', kind: danger ? 'danger' : 'primary' }]
    }).then(function (v) { return v === 'ok'; });
  };
  UI.pickColor = function (current) {
    var body = '<div class="swatches">' + FC.COLORS.map(function (c) {
      return '<button type="button" class="sw' + (c.id === current ? ' sel' : '') + '" data-m="' + c.id + '" style="--c:' + c.front + '" aria-label="' + esc(c.name) + '"><span>' + (c.id === current ? UI.ic('check', 18, 2.6) : '') + '</span><em>' + esc(c.name) + '</em></button>';
    }).join('') + '</div>';
    return UI.modal({ title: 'Couleur du dossier', body: body });
  };

  /* ---------- Sélecteur de dossier ---------- */
  function pickRows(parent, depth, exclude, sel, out) {
    FC.children(parent).forEach(function (f) {
      if (exclude && exclude.indexOf(f.id) >= 0) return;
      var c = FC.colorOfFolder(f.id);
      out.push('<button type="button" class="prow' + (f.id === sel ? ' sel' : '') + '" data-pick="' + f.id + '" style="padding-left:' + (12 + depth * 18) + 'px"><span class="dot" style="background:' + c.front + '"></span><span>' + esc(f.name) + '</span></button>');
      pickRows(f.id, depth + 1, exclude, sel, out);
    });
    return out;
  }
  UI.pickerHTML = function (sel, exclude, noRoot, newLabel) {
    var rows = [];
    if (!noRoot) rows.push('<button type="button" class="prow' + (!sel ? ' sel' : '') + '" data-pick=""><span class="dot none"></span><span>Aucun dossier (à la racine)</span></button>');
    pickRows(null, 0, exclude, sel, rows);
    return '<div class="picker">' + rows.join('') + '</div>' +
      '<label class="field newf"><span>' + esc(newLabel || 'Ou créer un nouveau dossier') + '</span><input type="text" id="pkNew" maxlength="120" autocomplete="off" placeholder="Nom du dossier" data-noenter="1"></label>';
  };
  UI.bindPicker = function (el) {
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-pick]');
      if (!b) return;
      UI.$$('.prow', el).forEach(function (r) { r.classList.remove('sel'); });
      b.classList.add('sel');
    });
  };
  /* retourne { id, newName } */
  UI.readPicker = function (el) {
    var s = UI.$('.prow.sel', el);
    return { id: s ? s.dataset.pick || null : null, newName: (UI.$('#pkNew', el) || { value: '' }).value.trim() };
  };
  UI.resolvePick = function (pk) {
    if (pk.newName) return FC.addFolder(pk.newName, pk.id || null).id;
    return pk.id || null;
  };
  UI.chooseFolder = function (title, selected, exclude, noRoot) {
    return UI.modal({
      title: title,
      body: UI.pickerHTML(selected, exclude, noRoot),
      buttons: [{ id: 'cancel', label: 'Annuler' }, { id: 'ok', label: 'Déplacer ici', kind: 'primary' }],
      onOpen: function (el) { UI.bindPicker(el); },
      collect: function (el) { return { pick: UI.readPicker(el) }; }
    });
  };

  /* ---------- Éditeur de carte ---------- */
  var KATEX_MACROS = FC.MACROS_JSON;
  UI.typeset = function (el) {
    if (typeof window.renderMathInElement !== 'function' || !el) return;
    try {
      window.renderMathInElement(el, {
        delimiters: [{ left: '$$', right: '$$', display: true }, { left: '$', right: '$', display: false }],
        throwOnError: false,
        macros: FC.fixMacros(JSON.parse(KATEX_MACROS))
      });
    } catch (e) { /* le LaTeX brut reste affiché */ }
  };
  UI.fmt = function (html) {
    return FC.safe(html);
  };

  /* data : { f, b, n, ch, star } ; retourne { act:'save'|'saveadd'|'delete', ... } */
  UI.cardEditor = function (set, card, defaults) {
    var isNew = !card;
    var d = card || defaults || {};
    var rc = set.chapters.filter(FC.isRecapCh)[0];
    var real = set.chapters.filter(function (c) { return !FC.isRecapCh(c); });
    var cur = d.ch === '__recap' || (rc && d.ch === rc.id) ? '__recap' : (d.ch || real[0] && real[0].id);
    var chOpts = real.map(function (c) {
      return '<option value="' + c.id + '"' + (c.id === cur ? ' selected' : '') + '>' + esc(c.title) + '</option>';
    }).join('') + '<option value="__recap"' + (cur === '__recap' ? ' selected' : '') + '>Récap seulement (hors chapitres)</option><option value="__new">+ Nouveau chapitre…</option>';
    var body = '<div class="ed">' +
      '<label class="field"><span>Recto (question)</span><textarea id="edF" rows="3" placeholder="DL en $0$ de $\\cos x$ à l\'ordre $n$ ?"></textarea></label>' +
      '<label class="field"><span>Verso (réponse)</span><textarea id="edB" rows="4" placeholder="$$\\cos x \\underset{x\\to0}{=} \\sum_{k=0}^{n}\\frac{(-1)^k x^{2k}}{(2k)!}+o(x^{2n})$$"></textarea></label>' +
      '<label class="field"><span>Note (facultative)</span><input type="text" id="edN" placeholder="Et même $o(x^{2n+1})$." autocomplete="off" data-noenter="1"></label>' +
      '<div class="two"><label class="field"><span>Chapitre</span><select id="edCh">' + chOpts + '</select></label>' +
      '<label class="field" id="edChNewWrap" hidden><span>Nom du chapitre</span><input type="text" id="edChNew" maxlength="120" autocomplete="off" data-noenter="1"></label></div>' +
      '<label class="chk"><input type="checkbox" id="edStar"><span>Ultra-important <em>(apparaît dans le Récap)</em></span></label>' +
      '<p class="hint">Formules : <code>$…$</code> dans le texte, <code>$$…$$</code> pour une formule seule. HTML simple autorisé (&lt;b&gt;, &lt;i&gt;).</p>' +
      '<div class="ed-prev"><div class="pv"><span>Aperçu recto</span><div id="pvF" class="pvbox"></div></div><div class="pv"><span>Aperçu verso</span><div id="pvB" class="pvbox"></div></div></div></div>';
    var buttons = [];
    if (!isNew) buttons.push({ id: 'delete', label: 'Supprimer', kind: 'danger left' });
    buttons.push({ id: 'cancel', label: 'Annuler' });
    if (isNew) buttons.push({ id: 'saveadd', label: 'Enregistrer et continuer' });
    buttons.push({ id: 'save', label: 'Enregistrer', kind: 'primary' });
    return UI.modal({
      title: isNew ? 'Nouvelle carte' : 'Modifier la carte',
      wide: true,
      body: body,
      buttons: buttons,
      noMobileFocus: true,
      onOpen: function (el) {
        UI.$('#edF', el).value = FC.toEditor(d.f || '');
        UI.$('#edB', el).value = FC.toEditor(d.b || '');
        UI.$('#edN', el).value = FC.toEditor(d.n || '');
        UI.$('#edStar', el).checked = !!d.star;
        var t = null;
        function prev() {
          UI.$('#pvF', el).innerHTML = UI.fmt(FC.fromEditor(UI.$('#edF', el).value)) || '<i class="ph">—</i>';
          var b = FC.fromEditor(UI.$('#edB', el).value), n = FC.fromEditor(UI.$('#edN', el).value);
          UI.$('#pvB', el).innerHTML = (b || '<i class="ph">—</i>') + (n ? '<div class="note">' + n + '</div>' : '');
          UI.typeset(UI.$('.ed-prev', el));
        }
        el.addEventListener('input', function (e) {
          if (e.target.id === 'edF' || e.target.id === 'edB' || e.target.id === 'edN') { clearTimeout(t); t = setTimeout(prev, 140); }
        });
        UI.$('#edCh', el).addEventListener('change', function (e) {
          var show = e.target.value === '__new';
          UI.$('#edChNewWrap', el).hidden = !show;
          if (show) UI.$('#edChNew', el).focus();
        });
        prev();
      },
      collect: function (el, id) {
        if (id === 'delete') return { act: 'delete' };
        var f = FC.fromEditor(UI.$('#edF', el).value), b = FC.fromEditor(UI.$('#edB', el).value);
        if (!f) { UI.$('#edF', el).focus(); UI.toast('Il manque le recto.'); return false; }
        if (!b) { UI.$('#edB', el).focus(); UI.toast('Il manque le verso.'); return false; }
        var ch = UI.$('#edCh', el).value, newCh = '';
        if (ch === '__new') {
          newCh = UI.$('#edChNew', el).value.trim();
          if (!newCh) { UI.$('#edChNew', el).focus(); UI.toast('Donne un nom au nouveau chapitre.'); return false; }
        }
        return { act: id, f: f, b: b, n: FC.fromEditor(UI.$('#edN', el).value), ch: ch, newCh: newCh, star: UI.$('#edStar', el).checked };
      }
    });
  };

  /* ---------- Dialogue d'import ---------- */
  UI.importDialog = function (parsed, defaultFolder) {
    var hasSet = parsed.some(function (p) { return p.kind === 'set'; });
    var hasLib = parsed.some(function (p) { return p.kind === 'library'; });
    var rows = parsed.map(function (p) {
      if (p.kind === 'library') {
        var d = p.data;
        return '<li><span class="ri">' + UI.ic('folder', 18) + '</span><span><b>Sauvegarde complète</b><em>' + FC.plural((d.folders || []).length, 'dossier') + ' · ' + FC.plural((d.sets || []).length, 'jeu', 'jeux') + '</em></span></li>';
      }
      var n = (p.data.cards || []).length;
      var stars = (p.data.cards || []).filter(function (c) { return c.star; }).length;
      return '<li><span class="ri">' + UI.ic('cards', 18) + '</span><span><b>' + esc(p.data.title) + '</b><em>' + FC.plural(n, 'carte') + ' · ' + FC.plural((p.data.chapters || []).length, 'chapitre') + (stars ? ' · ' + stars + ' dans le Récap' : '') + '</em></span></li>';
    }).join('');
    var body = '<ul class="imp">' + rows + '</ul>';
    if (hasSet) body += '<div class="lbl">Dossier de destination</div>' + UI.pickerHTML(defaultFolder || null, null, false, 'Ou créer un nouveau dossier (dans la sélection)');
    body += '<div class="lbl">Si un jeu du même nom existe déjà dans le dossier</div>' +
      '<div class="radios"><label><input type="radio" name="dup" value="merge" checked><span><b>Fusionner</b><em>ajoute seulement les nouvelles cartes, garde tes erreurs</em></span></label>' +
      '<label><input type="radio" name="dup" value="replace"><span><b>Remplacer</b><em>le contenu devient celui du fichier, tes erreurs sont gardées</em></span></label>' +
      '<label><input type="radio" name="dup" value="both"><span><b>Garder les deux</b><em>le nouveau jeu est ajouté à côté</em></span></label></div>';
    return UI.modal({
      title: parsed.length > 1 ? 'Importer ' + parsed.length + ' fichiers' : 'Importer',
      wide: true,
      noMobileFocus: true,
      body: body,
      buttons: [{ id: 'cancel', label: 'Annuler' }, { id: 'ok', label: 'Importer', kind: 'primary' }],
      onOpen: function (el) { if (hasSet) UI.bindPicker(el); },
      collect: function (el) {
        var r = UI.$('input[name=dup]:checked', el);
        return { pick: hasSet ? UI.readPicker(el) : { id: null, newName: '' }, mode: r ? r.value : 'merge', hasLib: hasLib };
      }
    });
  };

  /* ---------- Données ---------- */
  UI.dataDialog = function (info) {
    var t = FC.totals();
    var last = FC.get().lastExport ? new Date(FC.get().lastExport).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : 'jamais';
    var body = '<div class="stats"><div><b>' + t.cards + '</b><span>cartes</span></div><div><b>' + t.sets + '</b><span>jeux</span></div><div><b>' + t.folders + '</b><span>dossiers</span></div><div><b>' + t.errors + '</b><span>erreurs</span></div></div>' +
      '<p class="msg">Tout est enregistré sur cet appareil, dans l\'application. ' + (info.persisted ? 'Le stockage est protégé : le navigateur ne le supprimera pas tout seul.' : 'Le navigateur peut vider le stockage s\'il manque de place : fais une sauvegarde de temps en temps.') + '</p>' +
      '<div class="menu">' +
      '<button type="button" class="mrow" data-m="sync">' + UI.ic('cloud', 18) + '<span>Synchronisation entre appareils<em>' + UI.syncLabel() + '</em></span></button>' +
      '<button type="button" class="mrow" data-m="backup">' + UI.ic('download', 18) + '<span>Sauvegarde complète (un seul fichier HTML)<em>Dernière : ' + last + '</em></span></button>' +
      '<button type="button" class="mrow" data-m="import">' + UI.ic('upload', 18) + '<span>Importer un fichier HTML<em>Jeu de cartes ou sauvegarde</em></span></button>' +
      '<button type="button" class="mrow" data-m="update">' + UI.ic('flip', 18) + '<span>Mettre à jour l\'appli<em>Version ' + (FC.VERSION || '') + ' · recharge la dernière version</em></span></button>' +
      '</div>';
    return UI.modal({ title: 'Données', body: body });
  };
})();
