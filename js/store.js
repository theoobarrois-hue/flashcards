/* Flashcards — données, persistance locale (IndexedDB), opérations sur dossiers / jeux / cartes */
(function () {
  'use strict';
  var FC = (window.FC = window.FC || {});

  /* ---------- Couleurs de dossiers ---------- */
  FC.COLORS = [
    { id: 'bordeaux', name: 'Bordeaux', back: '#6a1f35', front: '#8a2c47', soft: '#f3e4e8' },
    { id: 'bleu', name: 'Bleu', back: '#1f4468', front: '#2c5b8f', soft: '#e2ebf5' },
    { id: 'vert', name: 'Vert', back: '#285540', front: '#3a7656', soft: '#e1efe7' },
    { id: 'violet', name: 'Violet', back: '#44366e', front: '#5d4a94', soft: '#e8e3f4' },
    { id: 'ocre', name: 'Ocre', back: '#754412', front: '#9a5a1c', soft: '#f6e8d3' },
    { id: 'sarcelle', name: 'Sarcelle', back: '#1d5a5b', front: '#2a7a7b', soft: '#dcefee' },
    { id: 'ardoise', name: 'Ardoise', back: '#2e3a46', front: '#475766', soft: '#e3e8ed' },
    { id: 'rose', name: 'Rose', back: '#8a3358', front: '#b04a74', soft: '#f8e3ec' }
  ];
  FC.color = function (id) {
    for (var i = 0; i < FC.COLORS.length; i++) if (FC.COLORS[i].id === id) return FC.COLORS[i];
    return FC.COLORS[0];
  };

  /* ---------- Utilitaires ---------- */
  var ordN = 0;
  FC.ord = function () { return Date.now() * 1000 + (ordN++ % 1000); };
  FC.uid = function () {
    return Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
  };
  FC.norm = function (s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  };
  FC.stripTags = function (h) {
    return String(h || '').replace(/<[^>]*>/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
  };
  FC.plural = function (n, one, many) {
    return n + ' ' + (n > 1 ? many || one + 's' : one);
  };

  /* Nettoyage du HTML des cartes (les fichiers importés ne sont pas de confiance) */
  FC.safe = function (html) {
    var t = document.createElement('template');
    t.innerHTML = String(html == null ? '' : html);
    var bad = t.content.querySelectorAll('script,style,iframe,object,embed,link,meta,base,form,frame,frameset');
    for (var i = 0; i < bad.length; i++) bad[i].remove();
    var all = t.content.querySelectorAll('*');
    for (var j = 0; j < all.length; j++) {
      var el = all[j];
      var attrs = Array.prototype.slice.call(el.attributes);
      for (var k = 0; k < attrs.length; k++) {
        var n = attrs[k].name.toLowerCase();
        var v = String(attrs[k].value || '').replace(/[\s\u0000-\u001f]/g, '').toLowerCase();
        if (n.indexOf('on') === 0 || n === 'srcdoc' || n === 'formaction') el.removeAttribute(attrs[k].name);
        else if ((n === 'href' || n === 'src' || n === 'xlink:href' || n === 'action') && (v.indexOf('javascript:') === 0 || (v.indexOf('data:') === 0 && v.indexOf('data:image/') !== 0))) el.removeAttribute(attrs[k].name);
      }
    }
    return t.innerHTML;
  };

  /* Texte saisi à la main : retours à la ligne -> <br> hors formules, < > & protégés dans les formules */
  FC.fromEditor = function (text) {
    var s = String(text || '').replace(/\r\n?/g, '\n').trim();
    var parts = s.split(/(\$\$[\s\S]*?\$\$|\$[^$\n]+\$)/g);
    for (var i = 0; i < parts.length; i++) {
      if (i % 2 === 1) {
        parts[i] = parts[i]
          .replace(/&(?!(?:[a-zA-Z]+|#\d+|#x[0-9a-fA-F]+);)/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
      } else {
        parts[i] = parts[i].replace(/\n/g, '<br>');
      }
    }
    return FC.safe(parts.join(''));
  };
  FC.toEditor = function (html) {
    var parts = String(html || '').split(/(\$\$[\s\S]*?\$\$|\$[^$\n]+\$)/g);
    for (var i = 0; i < parts.length; i++) {
      if (i % 2 === 1) {
        parts[i] = parts[i].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
      } else {
        parts[i] = parts[i].replace(/<br\s*\/?>/gi, '\n');
      }
    }
    return parts.join('');
  };

  /* ---------- État ---------- */
  function fresh() {
    return { v: 1, folders: [], sets: [], last: null, ui: { open: {} }, seeded: false, lastExport: 0, sync: { meta: {}, cursor: 0, init: 0, uid: '' } };
  }
  var state = fresh();
  FC.get = function () { return state; };
  FC.storage = 'idb';

  var listeners = [];
  FC.on = function (fn) { listeners.push(fn); };
  function emit() { listeners.forEach(function (fn) { try { fn(); } catch (e) { console.error(e); } }); }

  /* ---------- Persistance : IndexedDB, repli localStorage ---------- */
  function idb() {
    return new Promise(function (res, rej) {
      if (!window.indexedDB) return rej(new Error('IndexedDB indisponible'));
      var r;
      try { r = indexedDB.open('flashcards', 1); } catch (e) { return rej(e); }
      r.onupgradeneeded = function () { r.result.createObjectStore('kv'); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
  }
  function kvGet(k) {
    return idb().then(function (db) {
      return new Promise(function (res, rej) {
        var q = db.transaction('kv', 'readonly').objectStore('kv').get(k);
        q.onsuccess = function () { res(q.result); };
        q.onerror = function () { rej(q.error); };
      });
    });
  }
  function kvSet(k, v) {
    return idb().then(function (db) {
      return new Promise(function (res, rej) {
        var tx = db.transaction('kv', 'readwrite');
        tx.objectStore('kv').put(v, k);
        tx.oncomplete = function () { res(); };
        tx.onerror = function () { rej(tx.error); };
        tx.onabort = function () { rej(tx.error); };
      });
    });
  }

  function migrate(s) {
    var d = fresh();
    for (var k in d) if (!(k in s)) s[k] = d[k];
    s.sets.forEach(function (x) {
      x.chapters = x.chapters || [];
      x.cards = x.cards || [];
      x.errors = x.errors || [];
      x.seen = x.seen || [];
      x.pos = x.pos || {};
      x.chapters.forEach(function (c, i) { if (typeof c.o !== 'number') c.o = i; });
      x.cards.forEach(function (c, i) { if (typeof c.o !== 'number') c.o = i; });
    });
    if (!s.sync || typeof s.sync !== 'object') s.sync = d.sync;
    s.sync.meta = s.sync.meta || {};
    return s;
  }

  FC.load = function () {
    return kvGet('state')
      .then(function (v) { if (v) { state = migrate(v); try { if (migrateRecap()) touch(true); } catch (e) { /* ignore */ } } return state; })
      .catch(function () {
        FC.storage = 'localStorage';
        try {
          var raw = localStorage.getItem('fc-state');
          if (raw) state = migrate(JSON.parse(raw));
        } catch (e) { FC.storage = 'memory'; }
        return state;
      });
  };

  var timer = null;
  function flush() {
    clearTimeout(timer);
    timer = null;
    var snap = state;
    kvSet('state', snap).then(function () { FC.saveFailed = false; }).catch(function () {
      try {
        localStorage.setItem('fc-state', JSON.stringify(snap));
        FC.storage = 'localStorage';
      } catch (e) {
        FC.saveFailed = true;
        if (FC.onSaveError) FC.onSaveError();
      }
    });
  }
  FC.flush = flush;
  function touch(silent) {
    try { migrateRecap(); } catch (e) { /* ignore */ }
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, 250);
    if (!silent) emit();
  }
  FC.touch = touch;
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden' && timer) flush(); });
  window.addEventListener('pagehide', function () { if (timer) flush(); });

  FC.requestPersist = function () {
    try {
      if (navigator.storage && navigator.storage.persist) return navigator.storage.persist();
    } catch (e) { /* rien */ }
    return Promise.resolve(false);
  };
  FC.isPersisted = function () {
    try {
      if (navigator.storage && navigator.storage.persisted) return navigator.storage.persisted();
    } catch (e) { /* rien */ }
    return Promise.resolve(false);
  };

  /* ---------- Lecture ---------- */
  FC.folder = function (id) {
    for (var i = 0; i < state.folders.length; i++) if (state.folders[i].id === id) return state.folders[i];
    return null;
  };
  FC.set = function (id) {
    for (var i = 0; i < state.sets.length; i++) if (state.sets[i].id === id) return state.sets[i];
    return null;
  };
  FC.children = function (parentId) {
    return state.folders.filter(function (f) { return (f.parent || null) === (parentId || null); })
      .sort(function (a, b) { return (a.order || 0) - (b.order || 0) || a.name.localeCompare(b.name, 'fr'); });
  };
  FC.setsIn = function (folderId) {
    return state.sets.filter(function (s) { return (s.folder || null) === (folderId || null); })
      .sort(function (a, b) { return (a.order || 0) - (b.order || 0) || a.title.localeCompare(b.title, 'fr'); });
  };
  FC.topFolder = function (id) {
    var f = FC.folder(id), guard = 0;
    while (f && f.parent && guard++ < 50) f = FC.folder(f.parent);
    return f;
  };
  FC.colorOfFolder = function (id) {
    var t = FC.topFolder(id);
    return FC.color(t ? t.color : 'bordeaux');
  };
  FC.colorOfSet = function (set) {
    return set && set.folder ? FC.colorOfFolder(set.folder) : FC.color('ardoise');
  };
  FC.path = function (folderId) {
    var out = [], f = FC.folder(folderId), guard = 0;
    while (f && guard++ < 50) { out.unshift(f); f = f.parent ? FC.folder(f.parent) : null; }
    return out;
  };
  FC.pathNames = function (folderId) {
    return FC.path(folderId).map(function (f) { return f.name; });
  };
  FC.descendants = function (id) {
    var out = [id];
    FC.children(id).forEach(function (c) { out = out.concat(FC.descendants(c.id)); });
    return out;
  };
  FC.counts = function (folderId) {
    var ids = FC.descendants(folderId);
    var r = { cards: 0, errors: 0, sets: 0, folders: ids.length - 1 };
    state.sets.forEach(function (s) {
      if (ids.indexOf(s.folder) >= 0) {
        r.sets++;
        r.cards += s.cards.length;
        r.errors += s.errors.length;
      }
    });
    return r;
  };
  FC.totals = function () {
    var r = { cards: 0, errors: 0, sets: state.sets.length, folders: state.folders.length };
    state.sets.forEach(function (s) { r.cards += s.cards.length; r.errors += s.errors.length; });
    return r;
  };
  FC.RECAP_CH = '\u00a7R\u00e9cap';
  FC.isRecapCh = function (c) { return !!c && c.title === FC.RECAP_CH; };
  FC.recapChapter = function (setId) {
    var s = FC.set(setId), ex = null;
    if (!s) return null;
    s.chapters.forEach(function (c) { if (FC.isRecapCh(c)) ex = c; });
    if (!ex) { ex = { id: 'rc-' + s.id, title: FC.RECAP_CH, o: FC.ord() }; s.chapters.push(ex); touch(); }
    return ex;
  };
  function recapIdOf(set) {
    var id = null;
    set.chapters.forEach(function (c) { if (FC.isRecapCh(c)) id = c.id; });
    return id;
  }
  /* Le Récap est indépendant : ses cartes sont des copies (chapitre caché), supprimer dans un chapitre ne touche pas le Récap.
     Les anciennes cartes « étoilées » sont converties en copies (ids déterministes → pas de doublons entre appareils). */
  function migrateRecap() {
    var changed = false;
    state.sets.forEach(function (set) {
      var rid = recapIdOf(set), have = null;
      set.cards.slice().forEach(function (c) {
        if (!c.star || (rid && c.ch === rid)) return;
        if (!rid) { rid = 'rc-' + set.id; set.chapters.push({ id: rid, title: FC.RECAP_CH, o: FC.ord() }); }
        if (!have) { have = {}; set.cards.forEach(function (x) { if (x.ch === rid) have[x.f + '\u0000' + x.b] = 1; }); }
        var k = c.f + '\u0000' + c.b;
        if (!have[k]) { set.cards.push({ id: 'r-' + c.id, ch: rid, f: c.f, b: c.b, n: c.n || '', star: true, o: FC.ord() }); have[k] = 1; }
        c.star = false;
        changed = true;
      });
    });
    return changed;
  }
  FC.migrateRecap = migrateRecap;
  FC.cardsOf = function (set, tab) {
    if (tab === 'recap') { var rid = recapIdOf(set); return set.cards.filter(function (c) { return c.ch === rid; }); }
    if (tab === 'errors') return set.cards.filter(function (c) { return set.errors.indexOf(c.id) >= 0; });
    return set.cards.filter(function (c) { return c.ch === tab; });
  };
  FC.tabsOf = function (set) {
    var tabs = [{ key: 'recap', title: set.recapTitle || 'Récap Ultra-Important', short: set.recapTitle || 'Récap' }];
    set.chapters.forEach(function (c) { if (!FC.isRecapCh(c)) tabs.push({ key: c.id, title: c.title, short: c.title }); });
    tabs.forEach(function (t) { t.n = FC.cardsOf(set, t.key).length; });
    return tabs;
  };
  FC.progress = function (set) {
    var n = set.cards.length;
    if (!n) return 0;
    var seen = 0;
    set.cards.forEach(function (c) { if (set.seen.indexOf(c.id) >= 0) seen++; });
    return Math.round((100 * seen) / n);
  };
  FC.allErrors = function () {
    var out = [];
    state.sets.forEach(function (s) {
      s.cards.forEach(function (c) { if (s.errors.indexOf(c.id) >= 0) out.push({ setId: s.id, cardId: c.id }); });
    });
    return out;
  };
  FC.findCard = function (set, id) {
    for (var i = 0; i < set.cards.length; i++) if (set.cards[i].id === id) return set.cards[i];
    return null;
  };
  FC.search = function (q) {
    var n = FC.norm(q).trim();
    if (n.length < 2) return [];
    var out = [];
    state.sets.forEach(function (s) {
      s.cards.forEach(function (c) {
        if (out.length >= 60) return;
        var hay = FC.norm(FC.stripTags(c.f + ' ' + c.b + ' ' + (c.n || '')));
        if (hay.indexOf(n) >= 0) out.push({ set: s, card: c });
      });
    });
    return out;
  };

  /* ---------- Dossiers ---------- */
  FC.addFolder = function (name, parent, colorId, fixedId) {
    var top = (parent || null) === null;
    var color = colorId || (top ? FC.COLORS[FC.children(null).length % FC.COLORS.length].id : null);
    var f = { id: fixedId || FC.uid(), name: String(name || 'Dossier').trim() || 'Dossier', parent: parent || null, color: color, order: Date.now() };
    state.folders.push(f);
    if (parent) state.ui.open[parent] = true;
    touch();
    return f;
  };
  FC.renameFolder = function (id, name) {
    var f = FC.folder(id);
    if (f && String(name).trim()) { f.name = String(name).trim(); touch(); }
  };
  FC.setFolderColor = function (id, colorId) {
    var f = FC.folder(id);
    if (f) { f.color = colorId; touch(); }
  };
  FC.moveFolder = function (id, parent) {
    var f = FC.folder(id);
    if (!f) return false;
    if (parent && FC.descendants(id).indexOf(parent) >= 0) return false;
    f.parent = parent || null;
    if (!f.parent && !f.color) f.color = FC.COLORS[FC.children(null).length % FC.COLORS.length].id;
    touch();
    return true;
  };
  FC.deleteFolder = function (id) {
    var ids = FC.descendants(id);
    state.folders = state.folders.filter(function (f) { return ids.indexOf(f.id) < 0; });
    state.sets = state.sets.filter(function (s) { return ids.indexOf(s.folder) < 0; });
    if (state.last && !FC.set(state.last.setId)) state.last = null;
    touch();
  };

  /* ---------- Jeux ---------- */
  FC.addSet = function (title, folder) {
    var s = { id: FC.uid(), folder: folder || null, title: String(title || 'Nouveau jeu').trim() || 'Nouveau jeu', sub: '', chapters: [], cards: [], errors: [], seen: [], pos: {}, tab: 'recap', order: Date.now() };
    s.chapters.push({ id: FC.uid(), title: 'Cartes', o: 0 });
    s.tab = s.chapters[0].id;
    state.sets.push(s);
    if (folder) state.ui.open[folder] = true;
    touch();
    return s;
  };
  FC.renameSet = function (id, title) {
    var s = FC.set(id);
    if (s && String(title).trim()) { s.title = String(title).trim(); touch(); }
  };
  FC.moveSet = function (id, folder) {
    var s = FC.set(id);
    if (s) { s.folder = folder || null; touch(); }
  };
  FC.deleteSet = function (id) {
    state.sets = state.sets.filter(function (s) { return s.id !== id; });
    if (state.last && state.last.setId === id) state.last = null;
    touch();
  };

  /* ---------- Chapitres ---------- */
  FC.addChapter = function (setId, title) {
    var s = FC.set(setId);
    if (!s) return null;
    var c = { id: FC.uid(), title: String(title || 'Chapitre').trim() || 'Chapitre', o: FC.ord() };
    s.chapters.push(c);
    touch();
    return c;
  };
  FC.renameChapter = function (setId, chId, title) {
    var s = FC.set(setId);
    if (!s || !String(title).trim()) return;
    s.chapters.forEach(function (c) { if (c.id === chId) c.title = String(title).trim(); });
    touch();
  };
  FC.renameRecap = function (setId, title) {
    var s = FC.set(setId);
    if (!s) return;
    s.recapTitle = String(title || '').trim();
    touch();
  };
  FC.deleteChapter = function (setId, chId) {
    var s = FC.set(setId);
    if (!s) return;
    var gone = s.cards.filter(function (c) { return c.ch === chId; }).map(function (c) { return c.id; });
    s.cards = s.cards.filter(function (c) { return c.ch !== chId; });
    s.errors = s.errors.filter(function (id) { return gone.indexOf(id) < 0; });
    s.chapters = s.chapters.filter(function (c) { return c.id !== chId; });
    if (s.tab === chId) s.tab = 'recap';
    touch();
  };

  /* ---------- Cartes ---------- */
  FC.addRecapCopy = function (setId, data) {
    var s = FC.set(setId);
    if (!s) return null;
    var rc = FC.recapChapter(setId), k = data.f + '\u0000' + data.b, dup = null;
    s.cards.forEach(function (x) { if (x.ch === rc.id && x.f + '\u0000' + x.b === k) dup = x; });
    if (dup) return dup;
    var c = { id: FC.uid(), ch: rc.id, f: data.f || '', b: data.b || '', n: data.n || '', star: true, o: FC.ord() };
    s.cards.push(c);
    touch();
    return c;
  };
  FC.addCard = function (setId, data) {
    var s = FC.set(setId);
    if (!s) return null;
    if (!s.chapters.length) s.chapters.push({ id: FC.uid(), title: 'Cartes', o: FC.ord() });
    var ch = data.ch && s.chapters.some(function (c) { return c.id === data.ch; }) ? data.ch : s.chapters[0].id;
    var c = { id: FC.uid(), ch: ch, f: data.f || '', b: data.b || '', n: data.n || '', star: !!data.star, o: FC.ord() };
    s.cards.push(c);
    touch();
    return c;
  };
  FC.updateCard = function (setId, cardId, data) {
    var s = FC.set(setId), c = s && FC.findCard(s, cardId);
    if (!c) return;
    ['f', 'b', 'n', 'star', 'ch'].forEach(function (k) { if (k in data) c[k] = data[k]; });
    touch();
  };
  FC.deleteCard = function (setId, cardId) {
    var s = FC.set(setId);
    if (!s) return;
    s.cards = s.cards.filter(function (c) { return c.id !== cardId; });
    s.errors = s.errors.filter(function (id) { return id !== cardId; });
    s.seen = s.seen.filter(function (id) { return id !== cardId; });
    touch();
  };
  FC.toggleError = function (setId, cardId) {
    var s = FC.set(setId);
    if (!s) return false;
    var i = s.errors.indexOf(cardId);
    if (i >= 0) s.errors.splice(i, 1); else s.errors.push(cardId);
    touch();
    return i < 0;
  };
  FC.setError = function (setId, cardId, on) {
    var s = FC.set(setId);
    if (!s) return;
    var i = s.errors.indexOf(cardId);
    if (on && i < 0) { s.errors.push(cardId); touch(); }
    else if (!on && i >= 0) { s.errors.splice(i, 1); touch(); }
  };
  FC.markSeen = function (setId, cardId) {
    var s = FC.set(setId);
    if (s && s.seen.indexOf(cardId) < 0) { s.seen.push(cardId); touch(true); }
  };
  FC.resetProgress = function (setId) {
    var s = FC.set(setId);
    if (s) { s.seen = []; touch(); }
  };
  FC.remember = function (setId, tab, idx) {
    var s = FC.set(setId);
    if (!s) return;
    s.tab = tab;
    s.pos[tab] = idx;
    state.last = { setId: setId, tab: tab };
    touch(true);
  };
  FC.setOpen = function (id, open) {
    state.ui.open[id] = !!open;
    touch();
  };

  /* ---------- Format portable (échange HTML) ---------- */
  FC.toPortable = function (set) {
    var chIndex = {};
    set.chapters.forEach(function (c, i) { chIndex[c.id] = i; });
    var cardIndex = {};
    set.cards.forEach(function (c, i) { cardIndex[c.id] = i; });
    return {
      kind: 'set', v: 1, title: set.title, sub: set.sub || '',
      chapters: set.chapters.map(function (c) { return { title: c.title }; }),
      cards: set.cards.map(function (c) { return { ch: chIndex[c.ch] || 0, f: c.f, b: c.b, n: c.n || '', star: !!c.star }; }),
      errors: set.errors.filter(function (id) { return id in cardIndex; }).map(function (id) { return cardIndex[id]; })
    };
  };
  FC.toPortableLibrary = function () {
    return {
      kind: 'library', v: 1, exportedAt: new Date().toISOString(),
      folders: state.folders.map(function (f) { return { id: f.id, name: f.name, parent: f.parent, color: f.color }; }),
      sets: state.sets.map(function (s) { var p = FC.toPortable(s); p.folder = s.folder; return p; })
    };
  };
  function cleanPortable(p) {
    var out = { kind: 'set', title: String(p.title || 'Jeu importé').slice(0, 200), sub: String(p.sub || '').slice(0, 300), chapters: [], cards: [], errors: [] };
    (Array.isArray(p.chapters) ? p.chapters : []).forEach(function (c) { out.chapters.push({ title: String((c && c.title) || 'Cartes').slice(0, 200) }); });
    if (!out.chapters.length) out.chapters.push({ title: 'Cartes' });
    (Array.isArray(p.cards) ? p.cards : []).forEach(function (c) {
      if (!c) return;
      var ch = Math.max(0, Math.min(out.chapters.length - 1, parseInt(c.ch, 10) || 0));
      out.cards.push({ ch: ch, f: FC.safe(c.f), b: FC.safe(c.b), n: FC.safe(c.n), star: !!c.star });
    });
    (Array.isArray(p.errors) ? p.errors : []).forEach(function (i) {
      i = parseInt(i, 10);
      if (i >= 0 && i < out.cards.length && out.errors.indexOf(i) < 0) out.errors.push(i);
    });
    return out;
  }
  FC.cleanPortable = cleanPortable;

  function key(c) { return c.f + '\u0000' + c.b; }

  FC.createSetFromPortable = function (p, folder, fixedId) {
    p = cleanPortable(p);
    var s = { id: fixedId || FC.uid(), folder: folder || null, title: p.title, sub: p.sub, chapters: [], cards: [], errors: [], seen: [], pos: {}, tab: 'recap', order: Date.now() };
    p.chapters.forEach(function (c, i) { s.chapters.push({ id: fixedId ? fixedId + '-h' + i : FC.uid(), title: c.title, o: i }); });
    p.cards.forEach(function (c, i) { s.cards.push({ id: fixedId ? fixedId + '-c' + i : FC.uid(), ch: s.chapters[c.ch].id, f: c.f, b: c.b, n: c.n, star: c.star, o: i }); });
    p.errors.forEach(function (i) { s.errors.push(s.cards[i].id); });
    s.tab = s.chapters[0].id;
    state.sets.push(s);
    if (folder) state.ui.open[folder] = true;
    touch();
    return s;
  };
  /* mode : 'replace' | 'merge' */
  FC.updateSetFromPortable = function (set, p, mode) {
    p = cleanPortable(p);
    var added = 0, skipped = 0;
    if (mode === 'replace') {
      var oldErr = {};
      set.cards.forEach(function (c) { if (set.errors.indexOf(c.id) >= 0) oldErr[key(c)] = true; });
      set.title = p.title; set.sub = p.sub;
      set.chapters = p.chapters.map(function (c) { return { id: FC.uid(), title: c.title, o: FC.ord() }; });
      set.cards = p.cards.map(function (c) { added++; return { id: FC.uid(), ch: set.chapters[c.ch].id, f: c.f, b: c.b, n: c.n, star: c.star, o: FC.ord() }; });
      set.errors = set.cards.filter(function (c) { return oldErr[key(c)]; }).map(function (c) { return c.id; });
      p.errors.forEach(function (i) { var id = set.cards[i].id; if (set.errors.indexOf(id) < 0) set.errors.push(id); });
      set.seen = []; set.pos = {}; set.tab = set.chapters[0].id;
    } else {
      var have = {}, rid0 = recapIdOf(set);
      function kk(c, rc) { return (rc ? 'R\u0001' : '') + key(c); }
      set.cards.forEach(function (c) { have[kk(c, rid0 && c.ch === rid0)] = c; });
      var chMap = p.chapters.map(function (pc) {
        if (FC.isRecapCh(pc)) return FC.recapChapter(set.id).id;
        var ex = null;
        set.chapters.forEach(function (c) { if (!ex && FC.norm(c.title) === FC.norm(pc.title)) ex = c; });
        if (!ex) { ex = { id: FC.uid(), title: pc.title, o: FC.ord() }; set.chapters.push(ex); }
        return ex.id;
      });
      /* Nouvelles cartes insérées à leur place (après la carte qui les précède dans le fichier) ;
         les cartes du Récap restent dans le Récap (indépendant des chapitres). */
      var prev = null;
      p.cards.forEach(function (c) {
        var isRc = FC.isRecapCh(p.chapters[c.ch]);
        var k = kk(c, isRc);
        if (have[k]) { skipped++; if (!isRc) { prev = have[k]; if (c.star) have[k].star = true; } return; }
        var chId = isRc ? FC.recapChapter(set.id).id : chMap[c.ch];
        var nc = { id: FC.uid(), ch: chId, f: c.f, b: c.b, n: c.n, star: isRc || !!c.star, o: FC.ord() };
        var at = (!isRc && prev) ? set.cards.indexOf(prev) : -1;
        if (!isRc && prev && prev.ch === chId && at >= 0) set.cards.splice(at + 1, 0, nc);
        else set.cards.push(nc);
        have[k] = nc; added++; if (!isRc) prev = nc;
      });
      p.errors.forEach(function (i) {
        var ex = have[kk(p.cards[i], FC.isRecapCh(p.chapters[p.cards[i].ch]))];
        if (ex && set.errors.indexOf(ex.id) < 0) set.errors.push(ex.id);
      });
    }
    touch();
    return { added: added, skipped: skipped };
  };

  /* Restauration d'une sauvegarde complète : retrouve ou crée les dossiers par nom */
  FC.restoreLibrary = function (p, dupMode) {
    var map = {}, created = 0, merged = 0, sets = 0;
    var byId = {};
    (p.folders || []).forEach(function (f) { byId[f.id] = f; });
    function resolve(id) {
      if (!id) return null;
      if (map[id] !== undefined) return map[id];
      var src = byId[id];
      if (!src) return null;
      var parent = resolve(src.parent);
      var name = String(src.name || 'Dossier');
      var ex = FC.children(parent).filter(function (f) { return FC.norm(f.name) === FC.norm(name); })[0];
      if (!ex) {
        ex = { id: FC.uid(), name: name, parent: parent, color: parent ? null : src.color || FC.COLORS[FC.children(null).length % FC.COLORS.length].id, order: Date.now() + created };
        state.folders.push(ex);
        created++;
      }
      map[id] = ex.id;
      return ex.id;
    }
    (p.folders || []).forEach(function (f) { resolve(f.id); });
    (p.sets || []).forEach(function (ps) {
      var folder = resolve(ps.folder);
      var ex = FC.setsIn(folder).filter(function (s) { return FC.norm(s.title) === FC.norm(ps.title); })[0];
      if (ex && dupMode === 'skip') return;
      if (ex && (dupMode === 'merge' || dupMode === 'replace')) { FC.updateSetFromPortable(ex, ps, dupMode); merged++; }
      else { FC.createSetFromPortable(ps, folder); sets++; }
    });
    touch();
    return { folders: created, sets: sets, merged: merged };
  };

  FC.findDuplicate = function (title, folder) {
    return FC.setsIn(folder).filter(function (s) { return FC.norm(s.title) === FC.norm(title); })[0] || null;
  };

  /* Nettoyage unique : retire les jeux « fournis » ajoutés par une version précédente (ids seed-…),
     puis les dossiers seed-fr / seed-en / seed-en-cours s'ils sont vides. Ne touche à rien d'autre. */
  FC.seedExtras = function () {
    if (state.cleanedExtras) return false;
    state.cleanedExtras = true;
    var ids = { 'seed-m-parcoeur': 1, 'seed-arcanes': 1 }, n = 0;
    state.sets = state.sets.filter(function (s) {
      var drop = ids[s.id] || /^seed-en-\d+$/.test(s.id);
      if (drop) n++;
      return !drop;
    });
    ['seed-en-cours', 'seed-en', 'seed-fr'].forEach(function (id) {
      if (FC.folder(id) && !FC.children(id).length && !FC.setsIn(id).length) {
        state.folders = state.folders.filter(function (f) { return f.id !== id; });
        n++;
      }
    });
    if (state.last && !FC.set(state.last.setId)) state.last = null;
    touch(n === 0);
    return n > 0;
  };

  /* Dossiers vides proposés au départ (une seule fois, tant que la synchro n'a jamais tourné sur cet appareil ; ids fixes). */
  FC.seedFolders = function () {
    if (state.foldersSeeded || (state.sync && state.sync.init)) return false;
    state.foldersSeeded = true;
    var base = Date.now(), made = 0;
    [['seed-physique', 'Physique', 'bleu'], ['seed-chimie', 'Chimie', 'vert'], ['seed-fr', 'Français', 'ocre'], ['seed-en', 'Anglais', 'sarcelle']].forEach(function (d, i) {
      if (FC.folder(d[0])) return;
      var f = FC.addFolder(d[1], null, d[2], d[0]);
      f.order = base + 1 + i;
      made++;
    });
    touch(made === 0);
    return made > 0;
  };

  /* ---------- Premier lancement : jeu de départ ---------- */
  FC.seedIfNeeded = function () {
    if (state.seeded) return false;
    state.seeded = true;
    if (state.sets.length || state.folders.length || !window.FC_SEED) { touch(true); return false; }
    var maths = FC.addFolder('Maths', null, 'bordeaux', 'seed-maths');
    var analyse = FC.addFolder('Analyse', maths.id, null, 'seed-analyse');
    var s = FC.createSetFromPortable(window.FC_SEED, analyse.id, 'seed-dl');
    state.ui.open[maths.id] = true;
    state.ui.open[analyse.id] = true;
    touch();
    return s;
  };
})();
