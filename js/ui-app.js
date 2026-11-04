/* Flashcards — écrans, navigation, actions */
(function () {
  'use strict';
  var FC = window.FC, UI = FC.ui;
  var $ = UI.$, $$ = UI.$$, esc = UI.esc, ic = UI.ic;

  var route = { v: 'lib' };
  var Q = '';
  var R = null;
  var pickDefaultFolder = null, pickTargetSet = null;
  var deferredInstall = null;

  /* ---------- Routage ---------- */
  function parseRoute() {
    var p = (location.hash || '').replace(/^#/, '').split('/').filter(Boolean);
    if (!p.length) return { v: 'lib' };
    if (p[0] === 'f' && p[1]) return { v: 'folder', id: p[1] };
    if (p[0] === 's' && p[1]) return { v: 'set', id: p[1], tab: p[2] || null };
    return { v: 'lib' };
  }
  function go(hash) {
    if (location.hash === hash || (hash === '#/' && !location.hash)) onRoute();
    else location.hash = hash;
  }
  var SHUF = { on: false, rank: {} };
  function order(list) {
    if (!SHUF.on) return list;
    list.forEach(function (e) { if (SHUF.rank[e.cardId] === undefined) SHUF.rank[e.cardId] = Math.random(); });
    return list.slice().sort(function (a, b) { return SHUF.rank[a.cardId] - SHUF.rank[b.cardId]; });
  }
  function entries(set, tab) {
    return order(FC.cardsOf(set, tab).map(function (c) { return { setId: set.id, cardId: c.id }; }));
  }
  function defaultTab(s) {
    var tabs = FC.tabsOf(s), valid = {};
    tabs.forEach(function (t) { valid[t.key] = t; });
    var want = route.tab || s.tab;
    if (want && valid[want] && (want !== 'recap' || valid[want].n || route.tab)) return want;
    return s.chapters.length ? s.chapters[0].id : 'recap';
  }
  function buildSession() {
    if (route.v === 'errors') {
      R = { kind: 'errors', tab: 'errors', list: order(FC.allErrors()), idx: 0, flipped: false, sig: '' };
    } else {
      var s = FC.set(route.id), tab = defaultTab(s);
      var list = entries(s, tab);
      R = { kind: 'set', setId: s.id, tab: tab, list: list, idx: SHUF.on ? 0 : Math.min(Math.max(s.pos[tab] || 0, 0), Math.max(0, list.length - 1)), flipped: false, sig: '' };
    }
  }
  function onRoute() {
    route = parseRoute();
    if (route.v === 'folder' && !FC.folder(route.id)) { route = { v: 'lib' }; history.replaceState(null, '', '#/'); }
    if (route.v === 'set' && !FC.set(route.id)) { route = { v: 'lib' }; history.replaceState(null, '', '#/'); }
    R = null;
    if (route.v === 'set' || route.v === 'errors') buildSession();
    if (route.v !== 'lib') Q = '';
    var openNow = activeFolders();
    for (var fid in openNow) FC.get().ui.open[fid] = true;
    renderAll();
    var m = $('#main');
    if (m) m.scrollTop = 0;
  }

  /* ---------- Rendu général ---------- */
  function renderAll() {
    document.body.dataset.view = route.v;
    renderSide();
    renderMain();
    renderTabbar();
  }

  function logo() {
    return '<svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true"><rect x="3" y="7" width="20" height="16" rx="4" transform="rotate(-8 13 15)" fill="#d9ccb2"/><rect x="6" y="5" width="20" height="16" rx="4" fill="#8a2c47"/><path d="M11 11h10M11 15h6" stroke="#fffdf8" stroke-width="1.8" stroke-linecap="round"/></svg>';
  }

  function activeFolders() {
    var open = {};
    var id = null;
    if (route.v === 'folder') id = route.id;
    else if (route.v === 'set') id = (FC.set(route.id) || {}).folder;
    FC.path(id).forEach(function (f) { open[f.id] = true; });
    return open;
  }

  function treeHTML(parent, depth, forceOpen) {
    var out = '';
    var st = FC.get();
    FC.children(parent).forEach(function (f) {
      var kids = FC.children(f.id), sets = FC.setsIn(f.id);
      var open = !!st.ui.open[f.id] || !!forceOpen[f.id];
      var on = route.v === 'folder' && route.id === f.id;
      var c = FC.colorOfFolder(f.id);
      var n = FC.counts(f.id).cards;
      out += '<div class="trow' + (on ? ' on' : '') + '" style="padding-left:' + (6 + depth * 16) + 'px">' +
        '<button type="button" class="tgl" data-act="toggle" data-id="' + f.id + '" aria-label="' + (open ? 'Replier' : 'Déplier') + ' ' + esc(f.name) + '" aria-expanded="' + open + '"' + (kids.length || sets.length ? '' : ' style="visibility:hidden"') + '><span class="chv' + (open ? ' open' : '') + '">' + ic('chevR', 12, 3) + '</span></button>' +
        '<button type="button" class="tname" data-act="openFolder" data-id="' + f.id + '"><span class="dot" style="background:' + c.front + '"></span><span class="tl">' + esc(f.name) + '</span><span class="tc">' + n + '</span></button></div>';
      if (open) {
        out += treeHTML(f.id, depth + 1, forceOpen);
        sets.forEach(function (s) {
          var son = route.v === 'set' && route.id === s.id;
          out += '<button type="button" class="trow tset' + (son ? ' on' : '') + '" style="padding-left:' + (26 + (depth + 1) * 16) + 'px" data-act="openSet" data-id="' + s.id + '"><svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="15" height="13" rx="3" transform="rotate(-8 10 12)" fill="' + c.front + '" opacity=".35"/><rect x="6" y="4" width="15" height="13" rx="3" fill="' + c.front + '"/></svg><span class="tl">' + esc(s.title) + '</span><span class="tc">' + s.cards.length + '</span></button>';
        });
      }
    });
    return out;
  }

  function renderSide() {
    var t = FC.totals();
    var h = '<div class="side-in"><div class="brand">' + logo() + '<span>Flashcards</span></div>' +
      '<button type="button" class="nav' + (route.v === 'lib' ? ' on' : '') + '" data-act="lib">' + ic('grid', 18) + '<span>Bibliothèque</span></button>' +
      '<div class="side-h"><span>Dossiers</span><button type="button" class="iconbtn sm" data-act="newFolder" aria-label="Nouveau dossier">' + ic('plus', 16, 2.2) + '</button></div>' +
      '<div class="tree">' + (FC.children(null).length ? treeHTML(null, 0, activeFolders()) : '<p class="side-empty">Aucun dossier pour l’instant.</p>') +
      FC.setsIn(null).map(function (s) {
        return '<button type="button" class="trow tset' + (route.v === 'set' && route.id === s.id ? ' on' : '') + '" style="padding-left:12px" data-act="openSet" data-id="' + s.id + '">' + ic('cards', 15) + '<span class="tl">' + esc(s.title) + '</span><span class="tc">' + s.cards.length + '</span></button>';
      }).join('') + '</div>' +
      '<div class="side-foot">' +
      (deferredInstall ? '<button type="button" class="btn block primary" data-act="install">Installer l’application</button>' : '') +
      '<button type="button" class="dashed" data-act="import" data-folder="">' + ic('download', 16) + 'Importer un HTML</button>' +
      '<button type="button" class="ghostrow" data-act="data">' + ic('gear', 16) + 'Données et sauvegarde</button>' +
      '<button type="button" class="syncrow" data-act="sync"><i class="sd ' + FC.sync.status.state + '"></i>' + UI.syncLabel() + '</button><div style="font-size:10px;opacity:.45;text-align:center;padding:6px 0 0">' + FC.VERSION + '</div></div></div>';
    $('#side').innerHTML = h;
  }

  function renderTabbar() {
    var t = FC.totals();
    $('#tabbar').innerHTML =
      '<button type="button" class="tb' + (route.v === 'lib' || route.v === 'folder' || route.v === 'set' ? ' on' : '') + '" data-act="lib">' + ic('grid', 24, 1.9) + '<span>Bibliothèque</span></button>' +
      '<button type="button" class="tb" data-act="import" data-folder="">' + ic('download', 24, 1.9) + '<span>Importer</span></button>';
  }

  function renderMain() {
    var m = $('#main'), h = '';
    if (route.v === 'lib') h = libraryView();
    else if (route.v === 'folder') h = folderView(FC.folder(route.id));
    else h = reviewView();
    m.innerHTML = h;
    if (route.v === 'lib') paintLibBody();
    if (route.v === 'set' || route.v === 'errors') { R.sig = ''; paintCard(); }
    UI.typeset(m);
  }

  /* ---------- Bibliothèque ---------- */
  function libraryView() {
    var t = FC.totals();
    return '<div class="page"><header class="page-head"><div><h1>Bibliothèque</h1><div class="sub">' +
      (t.cards ? FC.plural(t.cards, 'carte') + ' · ' + FC.plural(t.folders, 'dossier') + ' · ' + FC.plural(t.sets, 'jeu', 'jeux') : 'Commence par créer un dossier ou importer un fichier HTML') + '</div></div>' +
      '<div class="head-actions"><div class="search">' + ic('search', 16, 2.2) + '<input type="search" id="q" aria-label="Rechercher une carte" placeholder="Rechercher une carte" autocomplete="off" value="' + esc(Q) + '"></div>' +
      '<button type="button" class="btn dark" data-act="newFolder">' + ic('plus', 15, 2.4) + '<span class="lbl">Nouveau dossier</span></button>' +
      '<button type="button" class="iconbtn only-m" data-act="data" aria-label="Données et sauvegarde">' + ic('gear', 20) + '</button></div></header>' +
      '<div id="libBody"></div></div>';
  }

  function needsBackup() {
    var st = FC.get();
    if (!st.sets.length) return false;
    var oldest = Infinity;
    st.sets.forEach(function (s) { if (s.order && s.order < oldest) oldest = s.order; });
    if (!st.lastExport) return Date.now() - oldest > 3 * 86400000;
    return Date.now() - st.lastExport > 30 * 86400000;
  }

  function folderTile(f) {
    var c = FC.color(FC.topFolder(f.id).color), n = FC.counts(f.id);
    var meta = n.sets || n.folders ? FC.plural(n.cards, 'carte') + ' · ' + FC.plural(n.sets, 'jeu', 'jeux') : 'Vide';
    return '<div class="ftile"><button type="button" class="ftile-btn" data-act="openFolder" data-id="' + f.id + '" data-ctx="folderMenu" aria-label="Ouvrir ' + esc(f.name) + '">' +
      UI.folderSVG(c) + '<span class="ftxt"><span class="fname">' + esc(f.name) + '</span><span class="fmeta">' + meta + '</span></span>' +
      '</button>' +
      '<button type="button" class="kebab" data-act="folderMenu" data-id="' + f.id + '" aria-label="Actions du dossier ' + esc(f.name) + '">' + ic('more', 18) + '</button></div>';
  }

  function setRow(s, withPath) {
    var c = FC.colorOfSet(s), nerr = s.errors.length, pct = FC.progress(s);
    var meta = [];
    if (withPath && s.folder) meta.push(FC.pathNames(s.folder).join(' › '));
    meta.push(FC.plural(s.cards.length, 'carte'));
    return '<div class="srow"><button type="button" class="srow-main" data-act="openSet" data-id="' + s.id + '" data-ctx="setMenu">' + UI.stackIcon(c) +
      '<span class="stxt"><span class="stitle">' + esc(s.title) + '</span><span class="smeta">' + esc(meta.join(' · ')) + '</span>' +
      '<svg class="pbar" width="100%" height="5" viewBox="0 0 100 5" preserveAspectRatio="none" aria-hidden="true"><rect width="100" height="5" rx="2.5" fill="#e9dfcb"/><rect width="' + pct + '" height="5" rx="2.5" fill="' + c.front + '"/></svg></span>' +
      '<span class="schev">' + ic('chevR', 16, 2.6) + '</span></button>' +
      '<button type="button" class="kebab flat" data-act="setMenu" data-id="' + s.id + '" aria-label="Actions du jeu ' + esc(s.title) + '">' + ic('more', 18) + '</button></div>';
  }

  function paintLibBody() {
    var el = $('#libBody');
    if (!el) return;
    var st = FC.get();
    if (Q.trim().length >= 2) {
      var res = FC.search(Q);
      if (!res.length) { el.innerHTML = '<div class="empty-note">Aucune carte ne correspond à « ' + esc(Q) + ' ».</div>'; return; }
      el.innerHTML = '<div class="sec-h"><h3>' + FC.plural(res.length, 'résultat') + (res.length >= 60 ? ' (60 premiers)' : '') + '</h3></div><div class="results">' + res.map(function (r) {
        var meta = (r.set.folder ? FC.pathNames(r.set.folder).join(' › ') + ' › ' : '') + r.set.title;
        return '<button type="button" class="res" data-act="searchResult" data-set="' + r.set.id + '" data-card="' + r.card.id + '"><span class="rtxt">' + FC.safe(r.card.f) + '</span><span class="rmeta">' + esc(meta) + '</span></button>';
      }).join('') + '</div>';
      UI.typeset(el);
      return;
    }
    var t = FC.totals(), h = '';
    if (!st.sets.length && !st.folders.length) {
      el.innerHTML = '<div class="welcome"><svg width="72" height="72" viewBox="0 0 30 30" aria-hidden="true"><rect x="3" y="7" width="20" height="16" rx="4" transform="rotate(-8 13 15)" fill="#d9ccb2"/><rect x="6" y="5" width="20" height="16" rx="4" fill="#8a2c47"/><path d="M11 11h10M11 15h6" stroke="#fffdf8" stroke-width="1.8" stroke-linecap="round"/></svg>' +
        '<h2>Ta bibliothèque est vide</h2><p>Crée un dossier pour ranger tes jeux, puis importe un fichier HTML de flashcards ou ajoute des cartes à la main.</p>' +
        '<div class="row-btns"><button type="button" class="btn primary" data-act="newFolder">Créer un dossier</button><button type="button" class="btn" data-act="import" data-folder="">Importer un HTML</button></div></div>';
      return;
    }
    var last = st.last && FC.set(st.last.setId) ? st.last : null;
    h += '<div class="hero">';
    if (last) {
      var ls = FC.set(last.setId), lt = FC.cardsOf(ls, last.tab), li = Math.min((ls.pos[last.tab] || 0) + 1, Math.max(lt.length, 1));
      var lc = FC.colorOfSet(ls);
      h += '<div class="hcard resume">' + UI.stackIcon(lc, 58) + '<div class="hmain"><div class="eyebrow">Reprendre</div><div class="htitle">' + esc(ls.title) + '</div><div class="hmeta"><svg width="100%" height="5" viewBox="0 0 100 5" preserveAspectRatio="none" aria-hidden="true"><rect width="100" height="5" rx="2.5" fill="#e6dcc8"/><rect width="' + (lt.length ? Math.round(100 * li / lt.length) : 0) + '" height="5" rx="2.5" fill="' + lc.front + '"/></svg><span>' + esc(ls.folder ? FC.pathNames(ls.folder).join(' › ') + ' · ' : '') + 'carte ' + li + ' / ' + lt.length + '</span></div></div>' +
        '<button type="button" class="btn dark" data-act="resume">Reprendre</button></div>';
    }
    if (needsBackup()) h += '<div class="nag"><span>Tes données sont uniquement sur cet appareil. Pense à faire une sauvegarde.</span><button type="button" class="link" data-act="backup">Sauvegarder</button></div>';
    var top = FC.children(null);
    if (top.length) h += '<div class="sec-h"><h3>Mes dossiers</h3></div><div class="fgrid">' + top.map(folderTile).join('') + '</div>';
    var loose = FC.setsIn(null);
    if (loose.length) h += '<div class="sec-h"><h3>Jeux sans dossier</h3></div><div class="slist">' + loose.map(function (s) { return setRow(s); }).join('') + '</div>';
    el.innerHTML = h;
  }

  /* ---------- Dossier ---------- */
  function folderView(f) {
    var c = FC.colorOfFolder(f.id), n = FC.counts(f.id);
    var crumbs = '<nav class="crumbs" aria-label="Chemin"><button type="button" data-act="lib">Bibliothèque</button>' +
      FC.path(f.id).slice(0, -1).map(function (p) { return '<span aria-hidden="true">›</span><button type="button" data-act="openFolder" data-id="' + p.id + '">' + esc(p.name) + '</button>'; }).join('') + '</nav>';
    var up = f.parent ? f.parent : null;
    var h = '<div class="page">' +
      '<div class="mback"><button type="button" class="backbtn" data-act="' + (up ? 'openFolder' : 'lib') + '"' + (up ? ' data-id="' + up + '"' : '') + '>' + ic('chevL', 20, 2.6) + '<span>' + esc(up ? FC.folder(up).name : 'Bibliothèque') + '</span></button><button type="button" class="iconbtn" data-act="folderMenu" data-id="' + f.id + '" aria-label="Actions du dossier">' + ic('more', 22) + '</button></div>' +
      crumbs +
      '<header class="fhead"><div class="fmini">' + UI.folderSVG(c) + '</div><div class="fhead-t"><h1>' + esc(f.name) + '</h1><div class="sub">' + FC.plural(n.cards, 'carte') + ' · ' + FC.plural(n.sets, 'jeu', 'jeux') + '</div>' +
      '</div>' +
      '<button type="button" class="iconbtn only-d" data-act="folderMenu" data-id="' + f.id + '" aria-label="Actions du dossier">' + ic('more', 22) + '</button></header>';
    var kids = FC.children(f.id);
    h += '<div class="sec-h"><h3>Sous-dossiers</h3></div><div class="fgrid">' + kids.map(folderTile).join('') +
      '<button type="button" class="addtile" data-act="newFolder" data-parent="' + f.id + '">' + ic('plus', 20, 2.2) + '<span>Sous-dossier</span></button></div>';
    var sets = FC.setsIn(f.id);
    h += '<div class="sec-h"><h3>Jeux de cartes</h3><button type="button" class="link" data-act="import" data-folder="' + f.id + '">Importer un HTML</button></div>';
    h += '<div class="slist">' + sets.map(function (s) { return setRow(s); }).join('') +
      '<button type="button" class="addrow" data-act="newSet" data-folder="' + f.id + '">' + ic('plus', 16, 2.2) + 'Ajouter un jeu</button></div>';
    return h + '</div>';
  }

  /* ---------- Révision ---------- */
  function tabsHTML(s) {
    return FC.tabsOf(s).map(function (t) {
      var long = esc(t.title), short = esc(t.short || t.title);
      return '<button type="button" class="seg' + (t.key === R.tab ? ' on' : '') + '" data-act="tab" data-tab="' + t.key + '" role="tab" aria-selected="' + (t.key === R.tab) + '"><span class="lg">' + long + '</span><span class="sh">' + short + '</span>' + (t.key === 'errors' && t.n ? '<i class="badge">' + t.n + '</i>' : '') + '</button>';
    }).join('');
  }

  function reviewView() {
    var set = R.kind === 'set' ? FC.set(R.setId) : null;
    var backAct = set ? (set.folder ? 'openFolder' : 'lib') : 'lib';
    var backId = set && set.folder ? ' data-id="' + set.folder + '"' : '';
    var backLabel = set ? (set.folder ? FC.folder(set.folder).name : 'Bibliothèque') : 'Bibliothèque';
    var crumb = set ? (set.folder ? FC.pathNames(set.folder).join(' › ') : 'Sans dossier') : 'Toutes les cartes marquées';
    var title = set ? set.title : 'Mes erreurs';
    return '<div class="page rv" id="rv"><div class="rv-top"><button type="button" class="backbtn" data-act="' + backAct + '"' + backId + '>' + ic('chevL', 20, 2.6) + '<span>' + esc(backLabel) + '</span></button>' +
      '<div class="rv-crumb" id="rvSub">' + esc(crumb) + '</div>' +
      '<div class="rv-actions"><button type="button" class="btn sm" data-act="edit" aria-label="Modifier la carte">' + ic('edit', 15, 2) + '<span class="lbl">Modifier la carte</span></button>' +
      (set ? '<button type="button" class="btn sm" data-act="addCard" aria-label="Ajouter une carte">' + ic('plus', 14, 2.6) + '<span>Carte</span></button><button type="button" class="iconbtn" data-act="setMenu" data-id="' + set.id + '" aria-label="Actions du jeu">' + ic('more', 20) + '</button>' : '') + '</div></div>' +
      (set ? '<div class="segwrap"><div class="segs" id="rvTabs" role="tablist">' + tabsHTML(set) + '</div></div>' : '') +
      '<div class="rv-body"><div class="rv-title"><h1 id="rvTitle">' + esc(title) + '</h1><span class="rv-r"><button type="button" class="shufbtn' + (SHUF.on ? ' on' : '') + '" data-act="shuffle" id="shufBtn" aria-pressed="' + SHUF.on + '">' + ic('shuffle', 15, 2.2) + '<span>Mélanger</span></button><span id="counter" aria-live="polite"></span></span></div>' +
      '<div id="cardHost"></div>' +
      '<div class="controls"><button type="button" class="cbtn" data-act="prev" id="btnPrev" aria-label="Carte précédente">' + ic('chevL', 18, 2.4) + '<span>Précédente</span></button>' +
      '<button type="button" class="cbtn no" data-act="swNo" id="btnNo" aria-label="Erreur">' + ic('x', 20, 2.6) + '<span>Erreur</span></button>' +
      '<button type="button" class="cbtn dark" data-act="flip">' + ic('flip', 18, 2) + '<span>Retourner</span><kbd>Espace</kbd></button>' +
      '<button type="button" class="cbtn ok" data-act="swOk" id="btnOk" aria-label="Je connais">' + ic('check', 20, 2.6) + '<span>Je connais</span></button></div>' +
      '<p class="swhelp">Glisse la carte : <b>à droite</b> = je connais · <b>à gauche</b> = erreur</p>' +
      '<div id="segInfo"></div></div></div>';
  }

  function cur() {
    var e = R && R.list[R.idx];
    if (!e) return null;
    var s = FC.set(e.setId), c = s && FC.findCard(s, e.cardId);
    return c ? { set: s, card: c } : null;
  }

  function cardHTML(c, set) {
    var note = c.n ? '<div class="note">' + FC.safe(c.n) + '</div>' : '';
    var nxt = '', ne = R && R.list[R.idx + 1];
    if (ne) {
      var ns = FC.set(ne.setId), nc = ns && FC.findCard(ns, ne.cardId);
      if (nc) nxt = '<div class="card nxt" aria-hidden="true"><div class="inner"><div class="face front"><span class="tag q"><i></i>Question</span><div class="content">' + FC.safe(nc.f) + '</div></div></div></div>';
    }
    return '<div class="stack s2" aria-hidden="true"></div><div class="stack s1" aria-hidden="true"></div>' + nxt +
      '<div class="card' + (R.flipped ? ' flipped' : '') + '" id="card" data-act="flip" tabindex="0" role="button" aria-label="Retourner la carte"><div class="inner">' +
      '<div class="face front"><span class="tag q"><i></i>Question</span><div class="content">' + FC.safe(c.f) + '</div></div>' +
      '<div class="face back"><span class="tag a"><i></i>Réponse</span><div class="content">' + FC.safe(c.b) + note + '</div></div></div>' +
      '<div class="tint"></div><div class="swipe-hint ok">Je connais</div><div class="swipe-hint no">Erreur</div></div>';
  }

  function segsHTML(set) {
    var n = R.list.length;
    if (n < 2) return '';
    var W = 752, seenN = 0, errN = 0, parts = [];
    var gap = n > 40 ? 1 : 4, w = (W - gap * (n - 1)) / n;
    R.list.forEach(function (e, i) {
      var s = FC.set(e.setId);
      var isErr = s && s.errors.indexOf(e.cardId) >= 0, isSeen = s && s.seen.indexOf(e.cardId) >= 0;
      if (isSeen) seenN++;
      if (isErr) errN++;
      var fill = i === R.idx ? '#231f1b' : isErr ? '#c4553f' : isSeen ? '#8a2c47' : '#dcd2bd';
      parts.push('<rect x="' + (i * (w + gap)).toFixed(2) + '" y="0" width="' + w.toFixed(2) + '" height="6" rx="' + Math.min(3, w / 2).toFixed(1) + '" fill="' + fill + '"/>');
    });
    return '<svg viewBox="0 0 ' + W + ' 6" width="100%" height="6" preserveAspectRatio="none" aria-hidden="true" class="segsvg">' + parts.join('') + '</svg>' +
      '<div class="seginfo"><span>' + FC.plural(seenN, 'vue') + (errN ? ' · ' + errN + ' à revoir' : '') + '</span><span>' + FC.plural(Math.max(n - seenN, 0), 'restante') + '</span></div>';
  }

  function paintCard() {
    var host = $('#cardHost');
    if (!host || !R) return;
    var n = R.list.length;
    R.idx = Math.min(Math.max(R.idx, 0), Math.max(0, n - 1));
    var cc = cur();
    while (n && !cc) { R.list.splice(R.idx, 1); n = R.list.length; R.idx = Math.min(R.idx, Math.max(0, n - 1)); cc = cur(); }
    var set = R.kind === 'set' ? FC.set(R.setId) : null;
    if (R.done && n) {
      host.innerHTML = '<div class="empty-card done"><h2>Tour terminé</h2><p><b class="okn">' + FC.plural(R.okN || 0, 'carte connue', 'cartes connues') + '</b> · <b class="non">' + FC.plural(R.noN || 0, 'erreur') + '</b></p><button type="button" class="btn primary" data-act="restart">Recommencer</button></div>';
      R.sig = '';
      $('#counter').textContent = n + ' cartes';
      $('#segInfo').innerHTML = set ? segsHTML(set) : '';
      ['btnNo', 'btnOk'].forEach(function (id) { var b = $('#' + id); if (b) b.disabled = true; });
      $$('.controls .cbtn.dark').forEach(function (b) { b.disabled = true; });
      var pv = $('#btnPrev'); if (pv) pv.disabled = false;
      return;
    }
    if (!cc) {
      var msg, cta = '';
      if (R.tab === 'errors') msg = '<h2>Aucune erreur dans ce jeu</h2><p>Glisse une carte vers la gauche pendant la révision pour la retrouver ici.</p>';
      else if (R.tab === 'recap') msg = '<h2>Le Récap est vide</h2><p>Coche « Ultra-important » dans une carte pour la placer ici.</p>';
      else { msg = '<h2>Ce chapitre est vide</h2><p>Ajoute ta première carte.</p>'; cta = '<button type="button" class="btn primary" data-act="addCard">' + ic('plus', 15, 2.4) + 'Ajouter une carte</button>'; }
      host.innerHTML = '<div class="empty-card">' + msg + cta + '</div>';
      R.sig = '';
      $('#counter').textContent = '';
      $('#segInfo').innerHTML = '';
      ['btnPrev', 'btnNo', 'btnOk'].forEach(function (id) { var b = $('#' + id); if (b) b.disabled = true; });
      $$('.controls .cbtn.dark').forEach(function (b) { b.disabled = true; });
      return;
    }
    $$('.controls .cbtn').forEach(function (b) { b.disabled = false; });
    var c = cc.card, s = cc.set;
    var sig = c.id + '|' + c.f + '|' + c.b + '|' + c.n + '|' + (R.list[R.idx + 1] ? R.list[R.idx + 1].cardId : '');
    if (R.sig !== sig) {
      host.innerHTML = cardHTML(c, s);
      UI.typeset(host);
      R.sig = sig;
      if (R.anim) { var ce = $('#card'); if (ce) { ce.classList.add('enter'); ce.addEventListener('animationend', function () { ce.classList.remove('enter'); }, { once: true }); } }
    }
    R.anim = false;
    $('#counter').textContent = 'Carte ' + (R.idx + 1) + ' sur ' + n;
    $('#btnPrev').disabled = R.idx === 0;
    FC.markSeen(s.id, c.id);
    $('#segInfo').innerHTML = segsHTML(s);
    if (R.kind === 'set') FC.remember(s.id, R.tab, R.idx);
  }

  function refreshReview() {
    if (!R) return;
    var curId = R.list[R.idx] && R.list[R.idx].cardId;
    if (R.kind === 'set') {
      var s = FC.set(R.setId);
      if (!s) { go('#/'); return; }
      R.list = entries(s, R.tab);
      var tabs = $('#rvTabs');
      if (tabs) tabs.innerHTML = tabsHTML(s);
      var tt = $('#rvTitle');
      if (tt) tt.textContent = s.title;
    } else {
      R.list = order(FC.allErrors());
    }
    var i = -1;
    R.list.forEach(function (e, k) { if (e.cardId === curId) i = k; });
    if (i < 0) R.flipped = false;
    R.idx = i >= 0 ? i : Math.min(R.idx, Math.max(0, R.list.length - 1));
    paintCard();
  }

  function toggleShuffle() {
    if (!R) return;
    SHUF.on = !SHUF.on;
    SHUF.rank = {};
    var curId = R.list[R.idx] && R.list[R.idx].cardId;
    if (R.kind === 'set') R.list = entries(FC.set(R.setId), R.tab); else R.list = order(FC.allErrors());
    var i = -1;
    R.list.forEach(function (e, k) { if (e.cardId === curId) i = k; });
    if (SHUF.on) { R.idx = 0; R.flipped = false; } else { R.idx = i >= 0 ? i : 0; }
    var b = $('#shufBtn');
    if (b) { b.classList.toggle('on', SHUF.on); b.setAttribute('aria-pressed', SHUF.on ? 'true' : 'false'); }
    paintCard();
    if (UI.toast) UI.toast(SHUF.on ? 'Cartes mélangées' : 'Ordre d’origine');
  }

  function nav(d) {
    if (!R) return;
    var i = R.idx + d;
    if (i < 0 || i > R.list.length - 1) return;
    R.idx = i;
    R.flipped = false;
    R.done = false;
    R.anim = true;
    R.sig = '';
    paintCard();
  }
  function restart() {
    if (!R) return;
    R.done = false; R.okN = 0; R.noN = 0; R.idx = 0; R.flipped = false; R.anim = true; R.sig = '';
    paintCard();
  }

  /* ---------- Glisser : droite = je connais, gauche = erreur ---------- */
  var busy = false, D = null, noClick = false;
  function hints(card, p) {
    var ok = $('.swipe-hint.ok', card), no = $('.swipe-hint.no', card), t = $('.tint', card);
    if (ok) ok.style.opacity = p > 0 ? Math.min(1, p * 1.2) : 0;
    if (no) no.style.opacity = p < 0 ? Math.min(1, -p * 1.2) : 0;
    if (t) t.style.background = p > 0 ? 'rgba(47,125,79,' + (0.2 * Math.min(1, p)).toFixed(3) + ')' : p < 0 ? 'rgba(196,85,63,' + (0.2 * Math.min(1, -p)).toFixed(3) + ')' : 'transparent';
  }
  function nextLayer(p) {
    var nx = $('#cardHost .card.nxt');
    if (!nx) return;
    p = Math.max(0, Math.min(1, p));
    nx.style.transform = 'scale(' + (0.955 + 0.045 * p).toFixed(4) + ') translateY(' + (10 * (1 - p)).toFixed(2) + 'px)';
  }
  function place(card, dx, dy) {
    card.style.transform = 'translate3d(' + dx + 'px,' + dy + 'px,0) rotate(' + (dx / 16).toFixed(2) + 'deg)';
  }
  function commit(kind, dx0, dy0, vy) {
    if (!R || busy || R.done) return;
    var cc = cur(), card = $('#card');
    if (!cc || !card) return;
    busy = true;
    var dir = kind === 'ok' ? 1 : -1, w = Math.max(window.innerWidth, 600) * 1.15;
    var hasNext = !!$('#cardHost .card.nxt');
    card.classList.remove('dragging');
    card.classList.add('leaving');
    hints(card, dir);
    nextLayer(1);
    var nx = $('#cardHost .card.nxt');
    if (nx) nx.style.transition = 'transform .26s ease-out';
    var ty = (dy0 || 0) + (vy || 0) * 200;
    card.style.transform = 'translate3d(' + (dir * w) + 'px,' + ty.toFixed(0) + 'px,0) rotate(' + (dir * 26) + 'deg)';
    card.style.opacity = '0';
    setTimeout(function () {
      busy = false;
      if (!R || !FC.findCard(cc.set, cc.card.id)) return;
      FC.setError(cc.set.id, cc.card.id, kind === 'no');
      if (kind === 'ok') R.okN = (R.okN || 0) + 1; else R.noN = (R.noN || 0) + 1;
      R.flipped = false; R.anim = !hasNext; R.sig = '';
      if (R.idx >= R.list.length - 1) R.done = true; else R.idx++;
      paintCard();
    }, 260);
  }
  function dragBind() {
    document.addEventListener('click', function (e) {
      if (noClick) { e.stopPropagation(); e.preventDefault(); }
    }, true);
    var raf = 0;
    function frame() {
      raf = 0;
      if (!D || !D.drag) return;
      place(D.card, D.dx, D.dy);
      var p = Math.max(-1, Math.min(1, D.dx / 110));
      hints(D.card, p);
      nextLayer(Math.hypot(D.dx, D.dy) / 150);
    }
    document.addEventListener('pointerdown', function (e) {
      if (!R || busy || R.done) return;
      var card = e.target.closest && e.target.closest('#card');
      if (!card || e.target.closest('a,button')) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      D = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, dy: 0, drag: false, card: card, lx: e.clientX, ly: e.clientY, lt: performance.now(), vx: 0, vy: 0 };
    });
    document.addEventListener('pointermove', function (e) {
      if (!D || e.pointerId !== D.id) return;
      var dx = e.clientX - D.x, dy = e.clientY - D.y;
      if (!D.drag) {
        if (Math.hypot(dx, dy) < 6) return;
        D.drag = true;
        D.card.classList.add('dragging');
        var nx = $('#cardHost .card.nxt'); if (nx) nx.style.transition = 'none';
        try { D.card.setPointerCapture(e.pointerId); } catch (x) { /* ok */ }
      }
      var now = performance.now(), dt = now - D.lt;
      if (dt > 0) { D.vx = 0.7 * D.vx + 0.3 * ((e.clientX - D.lx) / dt); D.vy = 0.7 * D.vy + 0.3 * ((e.clientY - D.ly) / dt); }
      D.lx = e.clientX; D.ly = e.clientY; D.lt = now; D.dx = dx; D.dy = dy;
      if (!raf) raf = requestAnimationFrame(frame);
      if (e.cancelable) e.preventDefault();
    });
    function end(e) {
      if (!D || e.pointerId !== D.id) return;
      var d = D; D = null;
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      if (!d.drag) return;
      noClick = true; setTimeout(function () { noClick = false; }, 120);
      var fling = Math.abs(d.vx) > 0.55 && Math.abs(d.dx) > 40 && (d.vx > 0) === (d.dx > 0);
      if (Math.abs(d.dx) > 100 || fling) commit(d.dx > 0 ? 'ok' : 'no', d.dx, d.dy, d.vy);
      else {
        d.card.classList.remove('dragging');
        d.card.style.transform = '';
        hints(d.card, 0);
        var nx = $('#cardHost .card.nxt');
        if (nx) { nx.style.transition = ''; nx.style.transform = ''; }
      }
    }
    document.addEventListener('pointerup', end);
    document.addEventListener('pointercancel', end);
  }
  function flip() {
    if (!R || !R.list.length) return;
    R.flipped = !R.flipped;
    var c = $('#card');
    if (c) c.classList.toggle('flipped', R.flipped);
  }
  /* ---------- Actions : dossiers, jeux, cartes ---------- */
  function createFolder(parent) {
    UI.askName(parent ? 'Nouveau sous-dossier' : 'Nouveau dossier', 'Nom', '', 'Créer').then(function (name) {
      if (!name) return;
      var f = FC.addFolder(name, parent || null);
      go('#/f/' + f.id);
    });
  }
  function createSet(folder) {
    UI.askName('Nouveau jeu de cartes', 'Nom du jeu', '', 'Créer').then(function (name) {
      if (!name) return;
      var s = FC.addSet(name, folder || null);
      go('#/s/' + s.id);
    });
  }

  function exportSet(id) {
    var s = FC.set(id);
    if (!s) return;
    FC.download(FC.slug(s.title) + '.html', FC.buildSetHTML(s));
    UI.toast('Fichier HTML enregistré.');
  }
  function exportFolder(id) {
    var ids = FC.descendants(id);
    var sets = FC.get().sets.filter(function (s) { return ids.indexOf(s.folder) >= 0; });
    if (!sets.length) { UI.toast('Ce dossier ne contient aucun jeu.'); return; }
    sets.forEach(function (s, i) { setTimeout(function () { FC.download(FC.slug(s.title) + '.html', FC.buildSetHTML(s)); }, i * 450); });
    UI.toast(sets.length > 1 ? sets.length + ' fichiers HTML enregistrés.' : 'Fichier HTML enregistré.');
  }
  function backup() {
    var d = new Date(), pad = function (n) { return (n < 10 ? '0' : '') + n; };
    FC.download('flashcards-sauvegarde-' + d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + '.html', FC.buildLibraryHTML());
    FC.get().lastExport = Date.now();
    FC.touch();
    UI.toast('Sauvegarde enregistrée.');
  }

  function folderMenu(id) {
    var f = FC.folder(id);
    if (!f) return;
    var items = [
      { id: 'rename', label: 'Renommer', icon: 'edit' },
      { id: 'sub', label: 'Nouveau sous-dossier', icon: 'plus' },
      { id: 'set', label: 'Ajouter un jeu', icon: 'cards' },
      { id: 'import', label: 'Importer un HTML ici', icon: 'upload' }
    ];
    if (!f.parent) items.push({ id: 'color', label: 'Changer la couleur', icon: 'palette' });
    items.push({ id: 'move', label: 'Déplacer', icon: 'move' }, { id: 'export', label: 'Exporter en HTML', icon: 'download' }, { id: 'delete', label: 'Supprimer', icon: 'trash', danger: true });
    UI.menu(f.name, items).then(function (a) {
      if (!a) return;
      if (a === 'rename') UI.askName('Renommer le dossier', 'Nom', f.name).then(function (n) { if (n) FC.renameFolder(id, n); });
      else if (a === 'sub') createFolder(id);
      else if (a === 'set') createSet(id);
      else if (a === 'import') pickFiles(id);
      else if (a === 'color') UI.pickColor(f.color).then(function (c) { if (c) FC.setFolderColor(id, c); });
      else if (a === 'move') UI.chooseFolder('Déplacer « ' + f.name + ' »', f.parent, FC.descendants(id)).then(function (r) {
        if (!r) return;
        var dest = UI.resolvePick(r.pick);
        if (!FC.moveFolder(id, dest)) UI.toast('Déplacement impossible.');
      });
      else if (a === 'export') exportFolder(id);
      else if (a === 'delete') {
        var n = FC.counts(id);
        UI.confirm('Supprimer « ' + f.name + ' » ?', 'Il contient ' + FC.plural(n.sets, 'jeu', 'jeux') + ' et ' + FC.plural(n.cards, 'carte') + '. Cette action est définitive. Pense à exporter avant si besoin.', 'Supprimer', true).then(function (ok) {
          if (!ok) return;
          var parent = f.parent;
          FC.deleteFolder(id);
          if (route.v === 'folder') go(parent ? '#/f/' + parent : '#/');
          else if (route.v === 'set' && !FC.set(route.id)) go('#/');
        });
      }
    });
  }

  function chaptersDialog(setId) {
    var s = FC.set(setId);
    if (!s) return;
    var body = '<div class="menu">' + s.chapters.filter(function (c) { return !FC.isRecapCh(c); }).map(function (c) {
      var n = s.cards.filter(function (x) { return x.ch === c.id; }).length;
      return '<div class="chrow"><span>' + esc(c.title) + '<em>' + FC.plural(n, 'carte') + '</em></span><button type="button" class="iconbtn" data-m="ren:' + c.id + '" aria-label="Renommer ' + esc(c.title) + '">' + ic('edit', 18) + '</button><button type="button" class="iconbtn" data-m="del:' + c.id + '" aria-label="Supprimer ' + esc(c.title) + '">' + ic('trash', 18) + '</button></div>';
    }).join('') + '<button type="button" class="mrow" data-m="add">' + ic('plus', 18) + '<span>Ajouter un chapitre</span></button></div>';
    UI.modal({ title: 'Chapitres de « ' + s.title + ' »', body: body, buttons: [{ id: 'cancel', label: 'Fermer' }] }).then(function (a) {
      if (!a) return;
      var p = String(a).split(':'), act = p[0], cid = p[1];
      if (act === 'add') UI.askName('Nouveau chapitre', 'Nom', '', 'Créer').then(function (n) { if (n) FC.addChapter(setId, n); chaptersDialog(setId); });
      else if (act === 'ren') {
        var ch = s.chapters.filter(function (c) { return c.id === cid; })[0];
        UI.askName('Renommer le chapitre', 'Nom', ch ? ch.title : '').then(function (n) { if (n) FC.renameChapter(setId, cid, n); chaptersDialog(setId); });
      } else if (act === 'del') {
        var ch2 = s.chapters.filter(function (c) { return c.id === cid; })[0];
        var cnt = s.cards.filter(function (x) { return x.ch === cid; }).length;
        UI.confirm('Supprimer le chapitre ?', '« ' + (ch2 ? ch2.title : '') + ' » et ses ' + FC.plural(cnt, 'carte') + ' seront supprimés.', 'Supprimer', true).then(function (ok) {
          if (ok) {
            FC.deleteChapter(setId, cid);
            if (R && R.kind === 'set' && R.tab === cid) go('#/s/' + setId);
          }
          chaptersDialog(setId);
        });
      }
    });
  }

  function setMenu(id) {
    var s = FC.set(id);
    if (!s) return;
    UI.menu(s.title, [
      { id: 'rename', label: 'Renommer', icon: 'edit' },
      { id: 'addin', label: 'Importer des cartes dans ce jeu', icon: 'upload' },
      { id: 'chapters', label: 'Gérer les chapitres', icon: 'book' },
      { id: 'move', label: 'Déplacer', icon: 'move' },
      { id: 'export', label: 'Exporter en HTML', icon: 'download' },
      { id: 'reset', label: 'Remettre la progression à zéro', icon: 'reset' },
      { id: 'delete', label: 'Supprimer', icon: 'trash', danger: true }
    ]).then(function (a) {
      if (!a) return;
      if (a === 'rename') UI.askName('Renommer le jeu', 'Nom', s.title).then(function (n) { if (n) FC.renameSet(id, n); });
      else if (a === 'addin') { pickFiles(s.folder); pickTargetSet = id; }
      else if (a === 'chapters') chaptersDialog(id);
      else if (a === 'move') UI.chooseFolder('Déplacer « ' + s.title + ' »', s.folder, null).then(function (r) { if (r) FC.moveSet(id, UI.resolvePick(r.pick)); });
      else if (a === 'export') exportSet(id);
      else if (a === 'reset') { FC.resetProgress(id); UI.toast('Progression remise à zéro.'); }
      else if (a === 'delete') {
        UI.confirm('Supprimer « ' + s.title + ' » ?', 'Les ' + FC.plural(s.cards.length, 'carte') + ' de ce jeu seront supprimées. Cette action est définitive. Pense à exporter avant si besoin.', 'Supprimer', true).then(function (ok) {
          if (!ok) return;
          var folder = s.folder;
          FC.deleteSet(id);
          if (route.v === 'set' && route.id === id) go(folder ? '#/f/' + folder : '#/');
        });
      }
    });
  }

  function editCard(setId, card, defaults) {
    var s = FC.set(setId);
    if (!s) return;
    UI.cardEditor(s, card, defaults).then(function (r) {
      if (!r) return;
      if (r.act === 'delete') {
        UI.confirm('Supprimer cette carte ?', 'Cette action est définitive.', 'Supprimer', true).then(function (ok) { if (ok) FC.deleteCard(setId, card.id); else editCard(setId, card, defaults); });
        return;
      }
      var ch = r.ch;
      if (r.ch === '__new') ch = FC.addChapter(setId, r.newCh).id;
      var star = false, rcid = FC.recapChapter(setId).id;
      if (r.ch === '__recap') ch = rcid;
      var inRecap = ch === rcid;
      var data = { f: r.f, b: r.b, n: r.n, star: inRecap, ch: ch };
      if (card) { FC.updateCard(setId, card.id, data); UI.toast('Carte modifiée.'); if (r.star && !inRecap) FC.addRecapCopy(setId, data); }
      else {
        var nc = FC.addCard(setId, data);
        if (r.star && !inRecap) FC.addRecapCopy(setId, data);
        UI.toast('Carte ajoutée.');
        if (r.act === 'saveadd') { editCard(setId, null, { ch: inRecap ? '__recap' : ch, star: false }); return; }
        if (R && R.kind === 'set' && R.setId === setId) {
          // se placer sur la carte créée si elle est dans l'onglet courant
          var i = -1;
          entries(FC.set(setId), R.tab).forEach(function (e, k) { if (e.cardId === nc.id) i = k; });
          if (i >= 0) { R.idx = i; R.flipped = false; paintCard(); }
        }
      }
    });
  }

  /* ---------- Import ---------- */
  function pickFiles(folder) {
    pickDefaultFolder = folder || null;
    pickTargetSet = null;
    var inp = $('#file');
    inp.value = '';
    inp.click();
  }
  function doImport(files, defFolder) {
    var target = pickTargetSet; pickTargetSet = null;
    files = Array.prototype.slice.call(files).filter(function (f) { return /\.html?$/i.test(f.name) || /html/.test(f.type); });
    if (!files.length) { UI.toast('Choisis un fichier .html.'); return; }
    var parsed = [], errs = [];
    var chain = Promise.resolve();
    files.forEach(function (f) {
      chain = chain.then(function () { return FC.parseFile(f); }).then(function (p) { parsed.push(p); }, function (e) { errs.push(f.name + ' : ' + ((e && e.message) || 'erreur')); });
    });
    chain.then(function () {
      if (!parsed.length) {
        return UI.modal({ title: 'Import impossible', body: '<p class="msg">' + errs.map(esc).join('<br>') + '</p>', buttons: [{ id: 'ok', label: 'OK', kind: 'primary' }] });
      }
      if (errs.length) UI.toast(errs.length + ' fichier(s) ignoré(s).');
      var tset = target && FC.set(target);
      if (tset && parsed.every(function (p) { return p.kind === 'set'; })) {
        var add = 0, skip = 0;
        parsed.forEach(function (p) { var u = FC.updateSetFromPortable(tset, p.data, 'merge'); add += u.added; skip += u.skipped; });
        UI.toast(FC.plural(add, 'carte ajoutée', 'cartes ajoutées') + (skip ? ' · ' + skip + ' déjà présente(s)' : '') + ' dans « ' + tset.title + ' ».');
        go('#/s/' + target);
        return;
      }
      return UI.importDialog(parsed, defFolder).then(function (r) {
        if (!r) return;
        var hasSet = parsed.some(function (p) { return p.kind === 'set'; });
        var dest = hasSet ? UI.resolvePick(r.pick) : null;
        var added = 0, nSets = 0, merged = 0, last = null;
        parsed.forEach(function (p) {
          if (p.kind === 'library') {
            var o = FC.restoreLibrary(p.data, r.mode);
            nSets += o.sets; merged += o.merged;
            (p.data.sets || []).forEach(function (x) { added += (x.cards || []).length; });
          } else {
            var dup = FC.findDuplicate(p.data.title, dest);
            if (dup && r.mode !== 'both') {
              var u = FC.updateSetFromPortable(dup, p.data, r.mode);
              added += u.added; merged++; last = dup;
            } else {
              var d = {}; for (var k in p.data) d[k] = p.data[k];
              if (dup) d.title = p.data.title + ' (2)';
              last = FC.createSetFromPortable(d, dest);
              added += last.cards.length; nSets++;
            }
          }
        });
        var bits = [];
        if (nSets) bits.push(FC.plural(nSets, 'jeu importé', 'jeux importés'));
        if (merged) bits.push(FC.plural(merged, 'jeu mis à jour', 'jeux mis à jour'));
        UI.toast((bits.join(' · ') || 'Import terminé') + ' · ' + FC.plural(added, 'carte') + '.');
        if (hasSet && !parsed.some(function (p) { return p.kind === 'library'; })) go(dest ? '#/f/' + dest : '#/');
        else go('#/');
      });
    });
  }

  /* ---------- Événements ---------- */
  function onClick(e) {
    var t = e.target.closest('[data-act]');
    if (!t) return;
    var act = t.dataset.act, id = t.dataset.id;
    if (t.tagName === 'A') e.preventDefault();
    switch (act) {
      case 'lib': go('#/'); break;
      case 'errors': go('#/errors'); break;
      case 'openFolder': go('#/f/' + id); break;
      case 'openSet': go('#/s/' + id); break;
      case 'toggle': FC.setOpen(id, !FC.get().ui.open[id]); break;
      case 'tab': go('#/s/' + R.setId + '/' + t.dataset.tab); break;
      case 'newFolder': createFolder(t.dataset.parent || null); break;
      case 'newSet': createSet(t.dataset.folder || null); break;
      case 'import': pickFiles(t.dataset.folder !== undefined ? (t.dataset.folder || null) : (route.v === 'folder' ? route.id : null)); break;
      case 'folderMenu': folderMenu(id); break;
      case 'setMenu': setMenu(id); break;
      case 'shuffle': toggleShuffle(); break;
      case 'prev': nav(-1); break;
      case 'next': nav(1); break;
      case 'flip': flip(); break;
      case 'swNo': commit('no'); break;
      case 'swOk': commit('ok'); break;
      case 'restart': restart(); break;
      case 'edit': var cc = cur(); if (cc) editCard(cc.set.id, cc.card); break;
      case 'addCard':
        if (R && R.kind === 'set') {
          var defCh = FC.set(R.setId).chapters.some(function (c) { return c.id === R.tab; }) ? R.tab : null;
          editCard(R.setId, null, { ch: R.tab === 'recap' ? '__recap' : defCh, star: R.tab === 'recap' });
        }
        break;
      case 'resume':
        var l = FC.get().last;
        if (l && FC.set(l.setId)) go('#/s/' + l.setId + '/' + l.tab);
        break;
      case 'searchResult':
        var s = FC.set(t.dataset.set), c = s && FC.findCard(s, t.dataset.card);
        if (s && c) {
          var list = FC.cardsOf(s, c.ch), ix = 0;
          list.forEach(function (x, k) { if (x.id === c.id) ix = k; });
          s.pos[c.ch] = ix;
          go('#/s/' + s.id + '/' + c.ch);
        }
        break;
      case 'backup': backup(); break;
      case 'sync': UI.syncDialog(); break;
      case 'data':
        FC.isPersisted().then(function (p) {
          UI.dataDialog({ persisted: p }).then(function (a) {
            if (a === 'backup') backup();
            else if (a === 'import') pickFiles(route.v === 'folder' ? route.id : null);
            else if (a === 'sync') UI.syncDialog();
            else if (a === 'update') refreshApp();
          });
        });
        break;
      case 'install':
        if (deferredInstall) { deferredInstall.prompt(); deferredInstall = null; renderSide(); }
        break;
    }
  }

  FC.VERSION = 'v20';
  function refreshApp() {
    var done = function () { location.reload(); };
    var p = Promise.resolve();
    if ('serviceWorker' in navigator) p = navigator.serviceWorker.getRegistrations().then(function (rs) { return Promise.all(rs.map(function (r) { return r.unregister(); })); });
    p.then(function () { return window.caches ? caches.keys().then(function (ks) { return Promise.all(ks.map(function (k) { return caches.delete(k); })); }) : null; }).then(done, done);
  }

  function onChange() {
    renderSide();
    renderTabbar();
    if (route.v === 'set' || route.v === 'errors') refreshReview();
    else if (route.v === 'lib') {
      if (document.activeElement && document.activeElement.id === 'q') paintLibBody();
      else { renderMain(); }
    } else renderMain();
  }

  function bind() {
    document.addEventListener('click', onClick);
    document.addEventListener('contextmenu', function (e) {
      var t = e.target.closest('[data-ctx]');
      if (!t) return;
      e.preventDefault();
      if (t.dataset.ctx === 'folderMenu') folderMenu(t.dataset.id);
      else if (t.dataset.ctx === 'setMenu') setMenu(t.dataset.id);
    });
    document.addEventListener('input', function (e) {
      if (e.target.id === 'q') { Q = e.target.value; paintLibBody(); }
    });
    document.addEventListener('keydown', function (e) {
      if (UI.modalOpen() || !R) return;
      var tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); commit('no'); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); commit('ok'); }
      else if (e.key === 'ArrowUp' || e.key === 'Backspace') { e.preventDefault(); nav(-1); }
      else if ((e.key === ' ' || e.key === 'Enter') && tag !== 'BUTTON') { e.preventDefault(); flip(); }
    });
    dragBind();
    /* renommer un onglet : double-clic ou appui long (discret) */
    function renameTab(btn) {
      if (!R || R.kind !== 'set' || !btn) return;
      var key = btn.dataset.tab, s = FC.set(R.setId);
      if (key === 'errors') return;
      if (!s) return;
      var tabs = FC.tabsOf(s), t = tabs.filter(function (x) { return x.key === key; })[0];
      if (!t) return;
      UI.askName('Renommer l’onglet', 'Nom', t.title).then(function (n) {
        if (!n || typeof n !== 'string') return;
        if (key === 'recap') FC.renameRecap(s.id, n);
        else FC.renameChapter(s.id, key, n);
      });
    }
    document.addEventListener('dblclick', function (e) { var b = e.target.closest && e.target.closest('.seg[data-tab]'); if (b) { e.preventDefault(); renameTab(b); } });
    var lp = null;
    document.addEventListener('pointerdown', function (e) {
      var b = e.target.closest && e.target.closest('.seg[data-tab]');
      if (!b || e.pointerType === 'mouse') return;
      clearTimeout(lp);
      lp = setTimeout(function () { lp = null; noClick = true; setTimeout(function () { noClick = false; }, 400); renameTab(b); }, 600);
    });
    ['pointerup', 'pointercancel', 'scroll'].forEach(function (ev) { document.addEventListener(ev, function () { if (lp) { clearTimeout(lp); lp = null; } }, true); });
    $('#file').addEventListener('change', function (e) {
      var files = e.target.files;
      if (files && files.length) doImport(files, pickDefaultFolder);
    });
    /* glisser-déposer un fichier HTML sur la fenêtre */
    window.addEventListener('dragover', function (e) { if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') >= 0) e.preventDefault(); });
    window.addEventListener('drop', function (e) {
      if (!e.dataTransfer || !e.dataTransfer.files || !e.dataTransfer.files.length) return;
      e.preventDefault();
      doImport(e.dataTransfer.files, route.v === 'folder' ? route.id : null);
    });
    window.addEventListener('hashchange', onRoute);
    window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferredInstall = e; renderSide(); });
    FC.onSaveError = function () { UI.toast('Impossible d’enregistrer sur cet appareil. Fais une sauvegarde HTML.'); };
  }

  /* ---------- Démarrage ---------- */
  FC.boot = function () {
    FC.load().then(function () {
      FC.requestPersist();
      FC.seedIfNeeded();
      FC.seedExtras();
      FC.seedFolders();
      FC.on(onChange);
      FC.sync.onStatus(function () { renderSide(); });
      FC.sync.start();
      bind();
      onRoute();
      if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
        var had = !!navigator.serviceWorker.controller, reloaded = false;
        navigator.serviceWorker.addEventListener('controllerchange', function () { if (had && !reloaded) { reloaded = true; location.reload(); } });
        navigator.serviceWorker.register('sw.js').then(function (r) { try { r.update(); } catch (e) {} }).catch(function () { /* hors ligne non disponible */ });
      }
      document.documentElement.classList.add('ready');
    });
  };
  FC._test = { get route() { return route; }, get R() { return R; }, go: go };
})();
