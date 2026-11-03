/* Flashcards — écran « Synchronisation » */
(function () {
  'use strict';
  var FC = window.FC, UI = FC.ui;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  UI.syncLabel = function () {
    var s = FC.sync.status, u = FC.sync.user();
    if (!FC.sync.configured() || !u) return 'Synchronisation désactivée';
    if (s.state === 'syncing') return 'Synchronisation…';
    if (s.state === 'offline') return 'Hors ligne';
    if (s.state === 'error') return 'Erreur de synchro';
    if (s.state === 'auth') return 'Reconnexion nécessaire';
    return 'Synchronisé';
  };

  UI.syncDialog = function () {
    var S = FC.sync, root, msg = '', busy = false, mode = 'in';
    function when(ts) {
      if (!ts) return 'jamais';
      var d = new Date(ts);
      return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    }
    function html() {
      var u = S.user(), c = S.config(), b = '';
      if (!S.configured()) {
        b += '<p class="msg">Colle l’adresse et la clé de ton projet Supabase (gratuit). Elles sont dans Supabase › Project Settings › API.</p>' +
          '<label class="field"><span>Project URL</span><input type="url" id="sUrl" placeholder="https://xxxx.supabase.co" autocomplete="off" autocapitalize="off" value="' + esc(c.url) + '"></label>' +
          '<label class="field"><span>Clé « anon public »</span><input type="text" id="sKey" placeholder="eyJ…" autocomplete="off" autocapitalize="off" value="' + esc(c.key) + '"></label>' +
          '<button type="button" class="btn primary" data-s="cfg">Enregistrer</button>';
      } else if (!u || S.status.state === 'auth') {
        b += '<p class="msg">' + (mode === 'up' ? 'Crée ton compte : il sert à retrouver tes cartes sur tous tes appareils.' : 'Connecte-toi pour synchroniser tes cartes entre tes appareils.') + '</p>' +
          '<label class="field"><span>Email</span><input type="email" id="sMail" autocomplete="email" autocapitalize="off" value="' + esc((u && u.email) || '') + '"></label>' +
          '<label class="field"><span>Mot de passe</span><input type="password" id="sPw" autocomplete="' + (mode === 'up' ? 'new-password' : 'current-password') + '"></label>' +
          '<div class="srow2"><button type="button" class="btn primary" data-s="' + (mode === 'up' ? 'signup' : 'signin') + '">' + (mode === 'up' ? 'Créer le compte' : 'Se connecter') + '</button>' +
          '<button type="button" class="btn" data-s="' + (mode === 'up' ? 'tin' : 'tup') + '">' + (mode === 'up' ? 'J’ai déjà un compte' : 'Créer un compte') + '</button></div>' +
          '<button type="button" class="linkbtn" data-s="reconf">Changer de projet Supabase</button>';
      } else {
        var st = S.status;
        b += '<p class="msg"><b>' + esc(UI.syncLabel()) + '</b> · ' + esc(u.email) + '<br>Dernière synchro : ' + esc(when(st.last)) + '</p>' +
          (st.msg ? '<p class="msg warn">' + esc(st.msg) + '</p>' : '<p class="msg">Tes cartes, dossiers et erreurs se synchronisent tout seuls entre tes appareils connectés à ce compte. Hors ligne, tout reste utilisable : la synchro reprend au retour du réseau.</p>') +
          '<div class="srow2"><button type="button" class="btn primary" data-s="now">Synchroniser maintenant</button><button type="button" class="btn" data-s="out">Se déconnecter</button></div>';
      }
      if (msg) b += '<p class="msg warn" role="alert">' + esc(msg) + '</p>';
      return b;
    }
    function paint() { var el = root && root.querySelector('.modal-body'); if (el) el.innerHTML = html(); }
    function val(id) { var e = root.querySelector('#' + id); return e ? e.value.trim() : ''; }
    function run(p, okMsg) {
      if (busy) return;
      busy = true; msg = ''; paint();
      Promise.resolve(p).then(function (r) { msg = ''; if (r && r.confirm) msg = 'Compte créé. Ouvre l’email de confirmation envoyé par Supabase, puis connecte-toi (ou désactive « Confirm email » dans Supabase).'; if (r && r.confirm) mode = 'in'; })
        .catch(function (e) { msg = (e && e.message) || 'Erreur'; })
        .then(function () { busy = false; paint(); });
    }
    function onClick(e) {
      var t = e.target.closest('[data-s]');
      if (!t) return;
      var a = t.dataset.s;
      if (a === 'cfg') {
        var u = val('sUrl'), k = val('sKey');
        if (!/^https?:\/\//i.test(u) || k.length < 20) { msg = 'Adresse (https://…) ou clé invalide.'; return paint(); }
        S.setConfig(u, k); msg = ''; paint();
      } else if (a === 'reconf') { S.setConfig('', ''); S.signOut(); msg = ''; paint(); }
      else if (a === 'signin') run(S.signIn(val('sMail'), val('sPw')).then(function () { S.run(); }));
      else if (a === 'signup') run(S.signUp(val('sMail'), val('sPw')).then(function (r) { if (r.ok) S.run(); return r; }));
      else if (a === 'tup') { mode = 'up'; msg = ''; paint(); }
      else if (a === 'tin') { mode = 'in'; msg = ''; paint(); }
      else if (a === 'now') { run(S.run()); }
      else if (a === 'out') { S.signOut(); msg = ''; paint(); }
    }
    S.onStatus(function () { if (root && root.isConnected && !busy) paint(); });
    return UI.modal({
      title: 'Synchronisation',
      body: html(),
      buttons: [{ id: 'close', label: 'Fermer' }],
      onOpen: function (el) { root = el; el.addEventListener('click', onClick); el.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { var p = el.querySelector('.btn.primary[data-s]'); if (p) p.click(); } }); }
    });
  };
})();
