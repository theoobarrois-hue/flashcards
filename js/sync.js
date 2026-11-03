/* Flashcards — synchronisation entre appareils (Supabase : compte email + table « entities »).
   Principe : l'appli reste « locale d'abord ». Chaque dossier / jeu / chapitre / carte est une
   entité horodatée ; les deux côtés échangent les entités modifiées, la plus récente gagne.
   Les suppressions sont propagées (pierres tombales). Aucune dépendance externe. */
(function () {
  'use strict';
  var FC = window.FC;
  var S = (FC.sync = {});
  var AUTH_KEY = 'fc-auth', CFG_KEY = 'fc-sync-cfg';
  var PAGE = 1000, CHUNK = 300;

  /* ---------- stockage léger (compte, config) ---------- */
  function lsGet(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function lsSet(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* rien */ } }

  S.config = function () {
    var c = lsGet(CFG_KEY) || {}, d = window.FC_SYNC || {};
    return { url: String(c.url || d.url || '').trim().replace(/\/+$/, ''), key: String(c.key || d.key || '').trim() };
  };
  S.setConfig = function (url, key) { lsSet(CFG_KEY, { url: String(url || '').trim(), key: String(key || '').trim() }); };
  S.configured = function () { var c = S.config(); return !!(c.url && c.key); };
  S.user = function () { var a = lsGet(AUTH_KEY); return a && a.refresh_token ? { email: a.email, id: a.uid } : null; };

  /* ---------- état + abonnés ---------- */
  S.status = { state: 'off', msg: '', last: 0 };
  var subs = [];
  S.onStatus = function (fn) { subs.push(fn); };
  function setStatus(state, msg) {
    S.status.state = state; S.status.msg = msg || '';
    if (state === 'idle') S.status.last = Date.now();
    subs.forEach(function (fn) { try { fn(S.status); } catch (e) { console.error(e); } });
  }
  function resetState() {
    if (!S.user()) setStatus('off', '');
    else if (!S.configured()) setStatus('off', '');
    else setStatus('idle', '');
  }

  /* ---------- haché rapide (cyrb53) ---------- */
  function hash(str) {
    var h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (var i = 0, ch; i < str.length; i++) {
      ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
  }

  /* ---------- API HTTP ---------- */
  function errText(j, status) {
    var m = (j && (j.error_description || j.msg || j.message || j.error)) || '';
    m = String(m);
    if (/invalid login/i.test(m)) return 'Email ou mot de passe incorrect.';
    if (/already registered|already been registered/i.test(m)) return 'Un compte existe déjà avec cet email : connecte-toi.';
    if (/not confirmed/i.test(m)) return 'Email non confirmé. Ouvre le mail de confirmation, ou désactive « Confirm email » dans Supabase (Authentication › Providers › Email).';
    if (/at least \d+ char/i.test(m) || /weak/i.test(m)) return 'Mot de passe trop court (6 caractères minimum).';
    if (/valid email|invalid.*email/i.test(m)) return 'Adresse email invalide.';
    if (/rate limit|too many/i.test(m)) return 'Trop d’essais : attends une minute.';
    if (/relation .*entities|schema cache|does not exist/i.test(m)) return 'La table n’existe pas encore : colle le SQL dans Supabase (SQL Editor).';
    return m || ('Erreur ' + status);
  }
  function http(method, url, headers, body) {
    return fetch(url, { method: method, headers: headers, body: body == null ? undefined : JSON.stringify(body), cache: 'no-store' }).then(function (r) {
      return r.text().then(function (t) {
        var j = null;
        try { j = t ? JSON.parse(t) : null; } catch (e) { j = null; }
        if (!r.ok) { var e = new Error(errText(j, r.status)); e.status = r.status; e.body = j; throw e; }
        return j;
      });
    });
  }
  function baseHeaders() {
    var c = S.config();
    return { apikey: c.key, 'Content-Type': 'application/json' };
  }
  function saveSession(j) {
    var old = lsGet(AUTH_KEY) || {};
    var u = j.user || {};
    lsSet(AUTH_KEY, {
      access_token: j.access_token,
      refresh_token: j.refresh_token || old.refresh_token,
      expires_at: j.expires_at || (Math.floor(Date.now() / 1000) + (j.expires_in || 3600)),
      email: u.email || old.email || '',
      uid: u.id || old.uid || ''
    });
  }
  function authCall(path, body) {
    var c = S.config();
    if (!c.url || !c.key) return Promise.reject(new Error('Renseigne l’adresse et la clé du projet.'));
    return http('POST', c.url + path, baseHeaders(), body);
  }
  S.signUp = function (email, pw) {
    return authCall('/auth/v1/signup', { email: email, password: pw }).then(function (j) {
      if (j && j.access_token) { saveSession(j); afterLogin(); return { ok: true }; }
      return { ok: false, confirm: true };
    });
  };
  S.signIn = function (email, pw) {
    return authCall('/auth/v1/token?grant_type=password', { email: email, password: pw }).then(function (j) {
      saveSession(j); afterLogin(); return { ok: true };
    });
  };
  S.signOut = function () {
    var a = lsGet(AUTH_KEY);
    var c = S.config();
    if (a && a.access_token && c.url) { fetch(c.url + '/auth/v1/logout', { method: 'POST', headers: { apikey: c.key, Authorization: 'Bearer ' + a.access_token } }).catch(function () { /* rien */ }); }
    lsSet(AUTH_KEY, null);
    setStatus('off', '');
  };
  function afterLogin() {
    var st = FC.get(), u = S.user();
    if (st.sync.uid && u && st.sync.uid !== u.id) { st.sync = { meta: {}, cursor: 0, init: 0, uid: u.id }; }
    if (u) st.sync.uid = u.id;
    FC.touch(true);
    setStatus('idle', '');
    S.schedule(50);
  }
  function token() {
    var a = lsGet(AUTH_KEY);
    if (!a) return Promise.reject(Object.assign(new Error('Non connecté.'), { auth: true }));
    if (a.expires_at * 1000 - Date.now() > 60000) return Promise.resolve(a.access_token);
    var c = S.config();
    return http('POST', c.url + '/auth/v1/token?grant_type=refresh_token', baseHeaders(), { refresh_token: a.refresh_token }).then(function (j) {
      saveSession(j); return j.access_token;
    }).catch(function (e) {
      if (e.status === 400 || e.status === 401 || e.status === 403) { lsSet(AUTH_KEY, null); e.auth = true; e.message = 'Session expirée : reconnecte-toi.'; }
      throw e;
    });
  }
  function rest(method, path, body, extra) {
    return token().then(function (t) {
      var c = S.config(), h = baseHeaders();
      h.Authorization = 'Bearer ' + t;
      for (var k in (extra || {})) h[k] = extra[k];
      return http(method, c.url + '/rest/v1/' + path, h, body);
    });
  }

  /* ---------- État local → entités ---------- */
  function flatten() {
    var st = FC.get(), out = {};
    st.folders.forEach(function (f) { out['f:' + f.id] = { name: f.name, parent: f.parent || null, color: f.color || null, order: f.order || 0 }; });
    st.sets.forEach(function (s) {
      out['s:' + s.id] = { folder: s.folder || null, title: s.title, sub: s.sub || '', order: s.order || 0 };
      s.chapters.forEach(function (c) { out['h:' + s.id + ':' + c.id] = { title: c.title, o: c.o || 0 }; });
      var err = {};
      s.errors.forEach(function (id) { err[id] = 1; });
      s.cards.forEach(function (c) { out['c:' + s.id + ':' + c.id] = { ch: c.ch, f: c.f, b: c.b, n: c.n || '', star: !!c.star, err: !!err[c.id], o: c.o || 0 }; });
    });
    return out;
  }

  function scan() {
    var sy = FC.get().sync, meta = sy.meta, flat = flatten(), now = Date.now(), first = !sy.init;
    Object.keys(flat).forEach(function (k) {
      var h = hash(JSON.stringify(flat[k])), m = meta[k];
      if (!m) meta[k] = { ts: first ? 1 : now, h: h, d: 0, dirty: 1 };
      else if (m.d || m.h !== h) meta[k] = { ts: now, h: h, d: 0, dirty: 1 };
    });
    Object.keys(meta).forEach(function (k) {
      if (!(k in flat) && !meta[k].d) meta[k] = { ts: now, h: '', d: 1, dirty: 1 };
    });
    sy.init = 1;
    return flat;
  }

  /* ---------- Entités distantes → état local ---------- */
  var ORDER = { f: 0, s: 1, h: 2, c: 3 };
  function byO(a, b) { return (a.o || 0) - (b.o || 0); }

  function applyRemote(rows) {
    var st = FC.get(), sy = st.sync, meta = sy.meta;
    var take = rows.filter(function (r) { var m = meta[r.key]; return !m || r.ts > m.ts; });
    if (!take.length) return false;
    take.sort(function (a, b) { return ORDER[a.key.charAt(0)] - ORDER[b.key.charAt(0)]; });
    var applied = [], touched = {};
    take.forEach(function (r) {
      var p = r.key.split(':'), t = p[0], d = r.data || {};
      if (t === 'f') {
        var f = FC.folder(p[1]);
        if (r.del) { if (f) st.folders = st.folders.filter(function (x) { return x.id !== p[1]; }); }
        else {
          if (!f) { f = { id: p[1] }; st.folders.push(f); }
          f.name = d.name; f.parent = d.parent || null; f.color = d.color || null; f.order = d.order || 0;
        }
        applied.push(r);
      } else if (t === 's') {
        var s = FC.set(p[1]);
        if (r.del) {
          if (s) { st.sets = st.sets.filter(function (x) { return x.id !== p[1]; }); if (st.last && st.last.setId === p[1]) st.last = null; }
        } else {
          if (!s) { s = { id: p[1], chapters: [], cards: [], errors: [], seen: [], pos: {}, tab: 'recap' }; st.sets.push(s); }
          s.folder = d.folder || null; s.title = d.title; s.sub = d.sub || ''; s.order = d.order || 0;
        }
        applied.push(r);
      } else if (t === 'h') {
        var sh = FC.set(p[1]);
        if (!sh) return;
        if (r.del) {
          sh.chapters = sh.chapters.filter(function (c) { return c.id !== p[2]; });
          if (sh.tab === p[2]) sh.tab = 'recap';
        } else {
          var ch = null;
          sh.chapters.forEach(function (c) { if (c.id === p[2]) ch = c; });
          if (!ch) { ch = { id: p[2] }; sh.chapters.push(ch); }
          ch.title = d.title; ch.o = d.o || 0;
        }
        touched[sh.id] = sh; applied.push(r);
      } else if (t === 'c') {
        var sc = FC.set(p[1]);
        if (!sc) return;
        if (r.del) {
          sc.cards = sc.cards.filter(function (c) { return c.id !== p[2]; });
          sc.errors = sc.errors.filter(function (id) { return id !== p[2]; });
          sc.seen = sc.seen.filter(function (id) { return id !== p[2]; });
        } else {
          var cd = FC.findCard(sc, p[2]);
          if (!cd) { cd = { id: p[2] }; sc.cards.push(cd); }
          cd.ch = d.ch; cd.f = d.f; cd.b = d.b; cd.n = d.n || ''; cd.star = !!d.star; cd.o = d.o || 0;
          var i = sc.errors.indexOf(cd.id);
          if (d.err && i < 0) sc.errors.push(cd.id);
          if (!d.err && i >= 0) sc.errors.splice(i, 1);
        }
        touched[sc.id] = sc; applied.push(r);
      }
    });
    /* cohérence : tri, orphelins */
    Object.keys(touched).forEach(function (id) { var s = touched[id]; s.chapters.sort(byO); s.cards.sort(byO); });
    var fids = {};
    st.folders.forEach(function (f) { fids[f.id] = 1; });
    st.folders.forEach(function (f) { if (f.parent && !fids[f.parent]) f.parent = null; if (!f.parent && !f.color) f.color = FC.COLORS[0].id; });
    st.sets.forEach(function (s) {
      if (s.folder && !fids[s.folder]) s.folder = null;
      var cids = {};
      s.chapters.forEach(function (c) { cids[c.id] = 1; });
      s.cards.forEach(function (c) {
        if (!cids[c.ch]) {
          if (!s.chapters.length) { s.chapters.push({ id: FC.uid(), title: 'Cartes', o: FC.ord() }); cids[s.chapters[0].id] = 1; }
          c.ch = s.chapters[0].id;
        }
      });
      if (s.tab !== 'recap' && s.tab !== 'errors' && !cids[s.tab]) s.tab = 'recap';
    });
    /* on mémorise l'état local résultant pour ne pas le renvoyer comme une modif locale */
    var flat = flatten();
    applied.forEach(function (r) {
      meta[r.key] = r.del ? { ts: r.ts, h: '', d: 1, dirty: 0 } : { ts: r.ts, h: r.key in flat ? hash(JSON.stringify(flat[r.key])) : '', d: 0, dirty: 0 };
    });
    return applied.length > 0;
  }

  /* ---------- Cycle de synchronisation ---------- */
  var running = false, again = false, applying = false, timer = null;

  S.schedule = function (ms) {
    if (!S.user() || !S.configured()) return;
    clearTimeout(timer);
    timer = setTimeout(function () { S.run(); }, ms == null ? 1500 : ms);
  };

  function pull(cursor) {
    var rows = [], max = cursor;
    function page(from) {
      return rest('GET', 'entities?select=key,data,ts,del,seq&seq=gt.' + from + '&order=seq.asc&limit=' + PAGE).then(function (r) {
        r = r || [];
        r.forEach(function (x) { rows.push({ key: x.key, data: x.data, ts: Number(x.ts), del: !!x.del }); if (Number(x.seq) > max) max = Number(x.seq); });
        if (r.length >= PAGE) return page(Number(r[r.length - 1].seq));
      });
    }
    return page(Math.max(0, cursor - 50)).then(function () { return { rows: rows, max: max }; });
  }

  function push(flat) {
    var meta = FC.get().sync.meta;
    var keys = Object.keys(meta).filter(function (k) { return meta[k].dirty; });
    var sent = 0;
    function next() {
      var part = keys.splice(0, CHUNK);
      if (!part.length) return Promise.resolve(sent);
      var rows = part.map(function (k) {
        var m = meta[k];
        return { key: k, data: m.d ? null : (flat[k] || null), ts: m.ts, del: !!m.d };
      });
      return rest('POST', 'entities?on_conflict=user_id,key', rows, { Prefer: 'resolution=merge-duplicates,return=minimal' }).then(function () {
        part.forEach(function (k, i) { if (meta[k] && meta[k].ts === rows[i].ts) meta[k].dirty = 0; });
        sent += part.length;
        return next();
      });
    }
    return next();
  }

  S.run = function () {
    if (!S.user() || !S.configured()) { resetState(); return Promise.resolve(); }
    if (running) { again = true; return Promise.resolve(); }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) { setStatus('offline', 'Hors ligne : la synchro reprendra toute seule.'); return Promise.resolve(); }
    running = true;
    setStatus('syncing', '');
    var sy = FC.get().sync;
    var flat = scan();
    return pull(sy.cursor || 0).then(function (res) {
      applying = true;
      var changed = false;
      try { changed = applyRemote(res.rows); } finally { applying = false; }
      sy.cursor = res.max;
      return push(flat).then(function () {
        FC.touch(!changed); /* silencieux si rien n'a changé à l'écran */
        FC.flush();
        S.status.pulled = changed;
        setStatus('idle', '');
      });
    }).catch(function (e) {
      if (e && e.auth) setStatus('auth', e.message);
      else if (navigator.onLine === false || (e && e.name === 'TypeError')) setStatus('offline', 'Pas de connexion : la synchro reprendra toute seule.');
      else setStatus('error', (e && e.message) || 'Erreur de synchro');
    }).then(function () {
      running = false;
      if (again) { again = false; S.schedule(300); }
    });
  };

  /* ---------- Démarrage ---------- */
  S.start = function () {
    FC.on(function () { if (!applying && S.user()) S.schedule(1500); });
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') S.schedule(100); else if (document.visibilityState === 'hidden') S.run(); });
    window.addEventListener('online', function () { S.schedule(200); });
    window.addEventListener('focus', function () { S.schedule(300); });
    setInterval(function () { if (document.visibilityState === 'visible') S.run(); }, 30000);
    resetState();
    if (S.user()) S.schedule(200);
  };
})();
