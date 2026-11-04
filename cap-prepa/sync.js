/* Cap Prépa — synchronisation entre appareils (Supabase : compte email + table « capprepa_chapters »).
   Local d'abord : chaque chapitre est une entité horodatée ; la modification la plus récente gagne ;
   les suppressions sont propagées. Aucune dépendance externe. */
(function () {
  'use strict';
  var S = (window.CPSync = {});
  var AUTH_KEY = 'cp-auth', META_KEY = 'cp-sync', PAGE = 1000, CHUNK = 100;
  var SUBJECTS = ['Maths', 'Physique', 'Chimie', 'Français', 'Autre'], CODE = { todo: 't', good: 'g', bad: 'b' }, DECODE = { t: 'todo', g: 'good', b: 'bad' };

  function lsGet(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function lsSet(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function cfg() { var c = window.CP_SYNC || {}; return { url: String(c.url || '').replace(/\/+$/, ''), key: String(c.key || '') }; }
  S.configured = function () { var c = cfg(); return !!(c.url && c.key); };
  S.user = function () { var a = lsGet(AUTH_KEY); return a && a.refresh_token ? { email: a.email, id: a.uid } : null; };

  S.status = { state: 'off', msg: '', last: 0 };
  var subs = [];
  S.onStatus = function (fn) { subs.push(fn); };
  function setStatus(state, msg) {
    S.status.state = state; S.status.msg = msg || '';
    if (state === 'idle') { S.status.last = Date.now(); var m = meta(); m.last = S.status.last; lsSet(META_KEY, m); }
    subs.forEach(function (fn) { try { fn(S.status); } catch (e) { console.error(e); } });
  }

  function hash(str) {
    var h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (var i = 0, ch; i < str.length; i++) { ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
  }

  function errText(j, status) {
    var m = String((j && (j.error_description || j.msg || j.message || j.error)) || '');
    if (/invalid login/i.test(m)) return 'Email ou mot de passe incorrect.';
    if (/already registered|already been registered/i.test(m)) return 'Un compte existe déjà avec cet email : connecte-toi.';
    if (/not confirmed/i.test(m)) return 'Email non confirmé : ouvre le mail de confirmation.';
    if (/at least \d+ char/i.test(m) || /weak/i.test(m)) return 'Mot de passe trop court (6 caractères minimum).';
    if (/valid email|invalid.*email/i.test(m)) return 'Adresse email invalide.';
    if (/rate limit|too many/i.test(m)) return 'Trop d’essais : attends une minute.';
    if (/capprepa_chapters|schema cache|does not exist/i.test(m)) return 'La table n’existe pas encore : colle supabase-cap-prepa.sql dans Supabase (SQL Editor).';
    return m || ('Erreur ' + status);
  }
  function http(method, url, headers, body) {
    return fetch(url, { method: method, headers: headers, body: body == null ? undefined : JSON.stringify(body), cache: 'no-store' }).then(function (r) {
      return r.text().then(function (t) {
        var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { j = null; }
        if (!r.ok) { var e = new Error(errText(j, r.status)); e.status = r.status; throw e; }
        return j;
      });
    }, function () { var e = new Error('Hors connexion.'); e.offline = true; throw e; });
  }
  function baseHeaders() { return { apikey: cfg().key, 'Content-Type': 'application/json' }; }
  function saveSession(j) {
    var old = lsGet(AUTH_KEY) || {}, u = j.user || {};
    lsSet(AUTH_KEY, { access_token: j.access_token, refresh_token: j.refresh_token || old.refresh_token, expires_at: j.expires_at || (Math.floor(Date.now() / 1000) + (j.expires_in || 3600)), email: u.email || old.email || '', uid: u.id || old.uid || '' });
  }
  function authCall(path, body) { return http('POST', cfg().url + path, baseHeaders(), body); }
  S.signUp = function (email, pw) {
    return authCall('/auth/v1/signup', { email: email, password: pw }).then(function (j) {
      if (j && j.access_token) { saveSession(j); afterLogin(); return { ok: true }; }
      return { ok: false, confirm: true };
    });
  };
  S.signIn = function (email, pw) {
    return authCall('/auth/v1/token?grant_type=password', { email: email, password: pw }).then(function (j) { saveSession(j); afterLogin(); return { ok: true }; });
  };
  S.signOut = function () {
    var a = lsGet(AUTH_KEY), c = cfg();
    if (a && a.access_token && c.url) fetch(c.url + '/auth/v1/logout', { method: 'POST', headers: { apikey: c.key, Authorization: 'Bearer ' + a.access_token } }).catch(function () {});
    lsSet(AUTH_KEY, null); setStatus('off', '');
  };
  function token() {
    var a = lsGet(AUTH_KEY);
    if (!a) return Promise.reject(Object.assign(new Error('Non connecté.'), { auth: true }));
    if (a.expires_at * 1000 - Date.now() > 60000) return Promise.resolve(a.access_token);
    return http('POST', cfg().url + '/auth/v1/token?grant_type=refresh_token', baseHeaders(), { refresh_token: a.refresh_token }).then(function (j) { saveSession(j); return j.access_token; }).catch(function (e) {
      if (e.status === 400 || e.status === 401 || e.status === 403) { lsSet(AUTH_KEY, null); e.auth = true; e.message = 'Session expirée : reconnecte-toi.'; }
      throw e;
    });
  }
  function rest(method, path, body, extra) {
    return token().then(function (t) {
      var h = baseHeaders(); h.Authorization = 'Bearer ' + t;
      for (var k in (extra || {})) h[k] = extra[k];
      return http(method, cfg().url + '/rest/v1/' + path, h, body);
    });
  }

  /* ---------- méta locale : { uid, cursor, init, last, m: { id: {ts,h,d,dirty} } } ---------- */
  function meta() { var m = lsGet(META_KEY); if (!m || typeof m !== 'object' || !m.m) m = { uid: '', cursor: 0, init: 0, last: 0, m: {} }; return m; }
  function pack(c) { return { name: c.name, subject: c.subject, total: c.total, q: c.questions.map(function (s) { return CODE[s] || 't'; }).join('') }; }
  function afterLogin() {
    var u = S.user(), m = meta();
    if (u && m.uid !== u.id) m = { uid: u.id, cursor: 0, init: 0, last: 0, m: {} };
    lsSet(META_KEY, m); setStatus('ready', ''); S.schedule(50);
  }
  function scan(m) {
    var now = Date.now(), first = !m.init, ids = {};
    state.chapters.forEach(function (c) {
      ids[c.id] = 1;
      var h = hash(JSON.stringify(pack(c))), e = m.m[c.id];
      if (!e) m.m[c.id] = { ts: first ? 1 : now, h: h, d: 0, dirty: 1 };
      else if (e.d || e.h !== h) m.m[c.id] = { ts: now, h: h, d: 0, dirty: 1 };
    });
    Object.keys(m.m).forEach(function (id) { if (!ids[id] && !m.m[id].d) m.m[id] = { ts: now, h: '', d: 1, dirty: 1 }; });
    m.init = 1;
  }
  function unpack(id, d) {
    if (!d || typeof d.name !== 'string' || !d.name.trim() || d.name.length > 100 || SUBJECTS.indexOf(d.subject) < 0 || !Number.isInteger(d.total) || d.total < 1 || d.total > 2000 || typeof d.q !== 'string' || d.q.length !== d.total) return null;
    if (d.subject === 'Français' && d.total % 4) return null;
    var qs = d.q.split('').map(function (ch) { return DECODE[ch]; });
    if (qs.indexOf(undefined) >= 0) return null;
    return { id: id, name: d.name, subject: d.subject, total: d.total, questions: qs };
  }
  function applyRemote(m, rows) {
    var changed = false;
    rows.forEach(function (r) {
      var e = m.m[r.id];
      if (e && r.ts <= e.ts) return;
      var i = state.chapters.findIndex(function (c) { return c.id === r.id; });
      if (r.del) { if (i >= 0) { state.chapters.splice(i, 1); changed = true; } m.m[r.id] = { ts: r.ts, h: '', d: 1, dirty: 0 }; return; }
      var c = unpack(r.id, r.data);
      if (!c) return;
      if (i >= 0) state.chapters[i] = c; else state.chapters.push(c);
      m.m[r.id] = { ts: r.ts, h: hash(JSON.stringify(pack(c))), d: 0, dirty: 0 };
      changed = true;
    });
    return changed;
  }

  var running = false, again = false, timer = null, applying = false;
  S.applying = function () { return applying; };
  function pull(m) {
    var rows = [], max = m.cursor;
    function page(from) {
      return rest('GET', 'capprepa_chapters?select=id,data,ts,del,seq&seq=gt.' + from + '&order=seq.asc&limit=' + PAGE).then(function (r) {
        r.forEach(function (x) { rows.push({ id: x.id, data: x.data, ts: Number(x.ts), del: !!x.del }); if (Number(x.seq) > max) max = Number(x.seq); });
        return r.length === PAGE ? page(max) : null;
      });
    }
    return page(m.cursor).then(function () { return { rows: rows, max: max }; });
  }
  function push(m) {
    var ids = Object.keys(m.m).filter(function (id) { return m.m[id].dirty; });
    function chunk(i) {
      if (i >= ids.length) return Promise.resolve();
      var part = ids.slice(i, i + CHUNK), byId = {};
      state.chapters.forEach(function (c) { byId[c.id] = c; });
      var rows = part.map(function (id) { var e = m.m[id], c = byId[id]; return { id: id, data: e.d || !c ? null : pack(c), ts: e.ts, del: !!e.d }; });
      return rest('POST', 'capprepa_chapters?on_conflict=user_id,id', rows, { Prefer: 'resolution=merge-duplicates,return=minimal' }).then(function () {
        part.forEach(function (id) { m.m[id].dirty = 0; });
        return chunk(i + CHUNK);
      });
    }
    return chunk(0);
  }
  function cycle() {
    var m = meta(); scan(m); lsSet(META_KEY, m);
    return pull(m).then(function (res) {
      var changed = false;
      applying = true;
      try { changed = applyRemote(m, res.rows); } finally { applying = false; }
      m.cursor = res.max;
      if (changed) { undo = null; if (!state.chapters.some(function (c) { return c.id === selected; })) selected = state.chapters[0] && state.chapters[0].id; S.saveLocal(); render(); }
      lsSet(META_KEY, m);
      return push(m).then(function () { lsSet(META_KEY, m); return changed; });
    });
  }
  S.saveLocal = function () { try { if (window.__cpPersist) window.__cpPersist(); } catch (e) { /* rien */ } };
  S.now = function () {
    if (!S.user() || !S.configured()) return Promise.resolve();
    if (running) { again = true; return Promise.resolve(); }
    running = true; setStatus('sync', 'Synchronisation…');
    return cycle().then(function () { setStatus('idle', ''); }).catch(function (e) {
      if (e.offline) setStatus('offline', 'Hors connexion : sera synchronisé au retour du réseau.');
      else setStatus('error', e.message || 'Échec de la synchronisation.');
    }).then(function () { running = false; if (again) { again = false; S.schedule(800); } });
  };
  S.schedule = function (ms) { clearTimeout(timer); timer = setTimeout(S.now, ms == null ? 2000 : ms); };
  S.changed = function () { if (!applying && S.user()) S.schedule(2000); };
  S.lastSync = function () { return S.status.last || meta().last || 0; };
  S.pendingCount = function () { var m = meta(); return Object.keys(m.m).filter(function (k) { return m.m[k].dirty; }).length; };

  window.addEventListener('online', function () { S.schedule(500); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden && Date.now() - S.lastSync() > 30000) S.schedule(300); });
  setInterval(function () { if (!document.hidden && S.user()) S.now(); }, 60000);
  setStatus(S.user() ? 'ready' : 'off', '');
  if (S.user()) S.schedule(600);
})();
