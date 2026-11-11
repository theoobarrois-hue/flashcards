/* Flashcards — import / export : un seul format, le fichier HTML */
(function () {
  'use strict';
  var FC = (window.FC = window.FC || {});

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function jsonForScript(o) {
    return JSON.stringify(o).split('<').join('\\u003c').split(String.fromCharCode(0x2028)).join('\\u2028').split(String.fromCharCode(0x2029)).join('\\u2029');
  }
  FC.slug = function (s) {
    return FC.norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'flashcards';
  };

  /* ---------- Lecture d'un fichier HTML au format de Theo ----------
     Le fichier tourne dans une iframe isolée (sans accès à l'appli) ; on
     parcourt ses onglets et ses cartes puis on renvoie le contenu brut. */
  function harvestRunner() {
    function post(o) { try { parent.postMessage({ fcHarvest: true, payload: o }, '*'); } catch (e) { /* rien */ } }
    function txt(el) { return (el.textContent || '').replace(/\s+/g, ' ').trim(); }
    function total(r) { var n = 0; ((r && r.tabs) || []).forEach(function (t) { n += t.cards.length; }); return n; }
    function docTitle() {
      var h1 = document.querySelector('h1'), t = '';
      if (h1) { var c = h1.cloneNode(true); var sm = c.querySelector('small'); if (sm) sm.remove(); t = txt(c); }
      if (!t) t = (document.title || '').replace(/^Flashcards?\s*[—–:-]\s*/i, '').trim();
      return t || 'Jeu importé';
    }

    /* 1) Modèle « cahier » : onglets + #front / #back / #next */
    function tryTemplate() {
      var tabsEl = document.getElementById('tabs');
      var btns = tabsEl ? [].slice.call(tabsEl.querySelectorAll('button')) : [];
      if (!btns.length || !document.getElementById('front') || !document.getElementById('back') || !document.getElementById('next')) return null;
      var h1 = document.querySelector('h1'), title = '', sub = '';
      if (h1) {
        var sm = h1.querySelector('small');
        sub = sm ? txt(sm) : '';
        var c = h1.cloneNode(true), s2 = c.querySelector('small');
        if (s2) s2.remove();
        title = txt(c);
      }
      if (!title) title = (document.title || '').replace(/^Flashcards\s*[—-]\s*/, '') || 'Jeu importé';
      var out = [];
      btns.forEach(function (btn) {
        var key = btn.getAttribute('data-key') || '';
        if (key === 'errors') return;
        btn.click();
        var empty = document.getElementById('empty');
        var cards = [], guard = 0;
        if (!(empty && !empty.hidden)) {
          while (guard++ < 3000) {
            cards.push({ f: document.getElementById('front').innerHTML, b: document.getElementById('back').innerHTML });
            var nx = document.getElementById('next');
            if (!nx || nx.disabled) break;
            nx.click();
          }
        }
        out.push({ key: key, title: txt(btn).replace(/\s*\d+$/, ''), cards: cards });
      });
      return { title: title, sub: sub, tabs: out };
    }

    /* 2) Fichiers « libres » : on cherche les cartes dans les données du fichier */
    function isStr(x) { return typeof x === 'string' && x.replace(/\s/g, '').length > 0; }
    function isPlain(o) { var p = Object.getPrototypeOf(o); return p === Object.prototype || p === null; }
    var FK = ['f', 'front', 'q', 'question', 'recto', 'r', 'prompt', 'fr', 'term', 'mot', 'enonce', 'énoncé'];
    var BK = ['b', 'back', 'a', 'answer', 'reponse', 'réponse', 'verso', 'v', 'def', 'definition', 'définition', 'rep', 'en', 'solution'];
    var TK = ['title', 'titre', 'name', 'nom', 'label', 'chapitre', 'chapter', 'theme', 'thème', 't'];
    function qa(o) {
      if (Array.isArray(o)) return (o.length >= 2 && o.length <= 4 && isStr(o[0]) && isStr(o[1])) ? { f: o[0], b: o[1] } : null;
      if (o && typeof o === 'object' && isPlain(o)) {
        var f = null, b = null, k;
        for (k = 0; k < FK.length; k++) if (isStr(o[FK[k]])) { f = o[FK[k]]; break; }
        for (k = 0; k < BK.length; k++) if (isStr(o[BK[k]]) && o[BK[k]] !== f) { b = o[BK[k]]; break; }
        if (f && b) return { f: f, b: b };
      }
      return null;
    }
    function titleOf(o) {
      if (!o || typeof o !== 'object' || Array.isArray(o)) return '';
      var t = '', k;
      for (k = 0; k < TK.length; k++) if (isStr(o[TK[k]]) && o[TK[k]].length < 120) { t = o[TK[k]]; break; }
      var g = isStr(o.cat) ? o.cat : (isStr(o.category) ? o.category : '');
      return g && t ? g + ' · ' + t : (t || g);
    }
    function nested(v) { return v && typeof v === 'object'; }
    var PAL = { woolf: '#1B5E9C', zola: '#B03A1E', platon: '#6B3FA0' }, XTRA = ['#0E7A5F', '#9A5B13', '#7A2F4F', '#2F6F73', '#5B5BA6'], pi = 0, given = {};
    function colorFor(name) {
      var k = String(name).toLowerCase().trim();
      if (PAL[k]) return PAL[k];
      if (!given[k]) given[k] = XTRA[pi++ % XTRA.length];
      return given[k];
    }
    function quoteHTML(q, col) {
      var sp = isStr(q.sp) && q.sp ? '<div style="font-size:.55em;font-style:italic;color:#9a9a9a;margin:0 0 2px;padding-left:12px">' + q.sp + '</div>' : '';
      return sp + '<div style="font-size:.78em;line-height:1.45;margin:0 0 6px;padding-left:12px;border-left:2px solid ' + col + ';color:' + col + '">« ' + q.t + ' »</div>';
    }
    function authorBlock(o) {
      var col = colorFor(o.a);
      return '<div style="text-align:left;margin:0 0 16px">' +
        '<div style="font-size:.6em;letter-spacing:.13em;text-transform:uppercase;font-weight:600;color:' + col + ';margin:0 0 6px">' + o.a + '</div>' +
        (isStr(o.x) && o.x ? '<div style="font-size:.62em;line-height:1.4;font-style:italic;color:#7c7c7c;margin:0 0 8px">' + o.x + '</div>' : '') +
        o.q.map(function (q) { return isStr(q) ? quoteHTML({ t: q }, col) : (q && isStr(q.t) ? quoteHTML(q, col) : ''); }).join('') + '</div>';
    }
    function rend(x) {
      if (isStr(x)) return '<p>' + x + '</p>';
      if (Array.isArray(x)) return x.map(rend).join('');
      if (nested(x)) {
        if (isStr(x.a) && Array.isArray(x.q)) return authorBlock(x);
        var strs = [], kids = [];
        Object.keys(x).forEach(function (k) {
          var v = x[k];
          if (isStr(v)) strs.push(v); else if (nested(v)) kids.push(v);
        });
        var head = '';
        if (kids.length && strs.length) {
          head = '<p style="margin:.7em 0 .15em"><b>' + strs[0] + '</b></p>' + strs.slice(1).map(function (t) { return '<p style="margin:.1em 0"><i>' + t + '</i></p>'; }).join('');
        } else {
          head = strs.map(function (t) { return '<p style="margin:.25em 0">' + t + '</p>'; }).join('');
        }
        return head + kids.map(rend).join('');
      }
      return '';
    }
    function loose(o) {
      if (!o || typeof o !== 'object' || Array.isArray(o) || !isPlain(o)) return null;
      var strs = [], nest = [];
      Object.keys(o).forEach(function (k) { var v = o[k]; if (isStr(v)) strs.push(v); else if (nested(v)) nest.push(v); });
      if (!strs.length || !nest.length) return null;
      var f;
      if (isStr(o.axe) && isStr(o.t)) {
        f = '<div style="font-size:.62em;letter-spacing:.13em;text-transform:uppercase;color:#7c7c7c;margin:0 0 14px">' + o.axe + '</div><div style="font-size:1.15em;line-height:1.25">' + o.t + '</div>' +
          (isStr(o.m) && o.m ? '<div style="margin-top:12px;font-size:.62em;font-style:italic;color:#7c7c7c">(' + o.m + ')</div>' : '');
        var b0 = nest.map(rend).join('');
        return b0 ? { f: f, b: b0 } : null;
      }
      f = strs.length >= 2 ? '<small>' + strs[0] + '</small><br><b>' + strs.slice(1).join('<br>') + '</b>' : '<b>' + strs[0] + '</b>';
      var b = nest.map(rend).join('');
      return b ? { f: f, b: b } : null;
    }
    function collect(v, hint, out, depth, mode, nodes) {
      if (depth > 7 || nodes.n++ > 20000 || !nested(v)) return;
      if (Array.isArray(v)) {
        var q = v.map(mode === 'strict' ? qa : loose), n = q.filter(Boolean).length;
        if (n && n >= v.length * 0.6) { out.push({ title: hint, cards: q.filter(Boolean) }); return; }
        v.forEach(function (e, i) { collect(e, titleOf(e) || (hint ? hint + ' ' + (i + 1) : ''), out, depth + 1, mode, nodes); });
      } else if (isPlain(v)) {
        var h = titleOf(v) || hint;
        Object.keys(v).forEach(function (k) { if (nested(v[k])) collect(v[k], h && (k === 'cards' || k === 'items' || k === 'c' || k === 'questions' || k === 'deck') ? h : (h ? h + ' · ' + k : k), out, depth + 1, mode, nodes); });
      }
    }
    function parseAt(text) {
      var chs = [], cur = null, mode = null, buf = [], chap = null;
      function flush() { if (cur && mode) cur[mode] = buf.join('\n').trim().replace(/\s*\n\s*/g, ' '); buf = []; }
      text.split('\n').forEach(function (line) {
        if (line.indexOf('@@C|') === 0) { flush(); cur = null; mode = null; var p = line.slice(4).split('|'); chap = { title: p.slice(1).join('|').trim() || p[0], cards: [] }; chs.push(chap); }
        else if (line.trim() === '@@Q') { flush(); cur = { Q: '', A: '' }; if (chap) chap.cards.push(cur); mode = 'Q'; }
        else if (line.trim() === '@@A') { flush(); mode = 'A'; }
        else if (mode) buf.push(line);
      });
      flush();
      return chs.map(function (c) { return { title: c.title, cards: c.cards.map(function (x) { return { f: x.Q, b: x.A }; }) }; });
    }
    function fixMath(s) {
      s = s.replace(/\[\[PLOT[\s\S]*?\]\]/g, '<i>[graphique non importé]</i>');
      if (s.indexOf('\\(') < 0 && s.indexOf('\\[') < 0) return s;
      s = s.replace(/\\\(/g, '$').replace(/\\\)/g, '$').replace(/\\\[/g, '$$$$').replace(/\\\]/g, '$$$$');
      return s.replace(/\$\$[\s\S]+?\$\$|\$[^$]+?\$/g, function (m) {
        return m.replace(/&(?!(?:[a-zA-Z]+|#\d+|#x[0-9a-fA-F]+);)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      });
    }
    /* Cartes générées par le script du fichier (ex. {{M:aldehyde}} -> dessin SVG) : on utilise sa propre fonction de rendu,
       puis on fige les styles de ses classes CSS en style="" pour que la carte s'affiche pareil dans l'appli. */
    function makePrep(scripts) {
      var ex = null, names = [];
      scripts.forEach(function (sc) {
        var re = /function\s+([A-Za-z_$][\w$]*)\s*\(/g, m, t = sc.textContent || '';
        while ((m = re.exec(t))) names.push(m[1]);
      });
      names.sort(function (a, b) { return (/expand|render|fmt|tpl|html|resolve|build/i.test(b) ? 1 : 0) - (/expand|render|fmt|tpl|html|resolve|build/i.test(a) ? 1 : 0); });
      function tryFn(nm, sample) {
        var f = window[nm];
        if (typeof f !== 'function' || f.length < 1) return false;
        try { var r = f(sample); return typeof r === 'string' && r !== sample && r.indexOf('{{') < 0 && r.length > sample.length; } catch (e) { return false; }
      }
      function find(sample) { if (ex) return ex; for (var i = 0; i < names.length; i++) if (tryFn(names[i], sample)) { ex = window[names[i]]; return ex; } return null; }
      var PROPS = ['display', 'flex-direction', 'flex-wrap', 'justify-content', 'align-items', 'gap', 'color', 'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing', 'text-align', 'text-transform', 'margin-top', 'margin-bottom', 'margin-left', 'margin-right', 'padding-top', 'padding-bottom', 'padding-left', 'padding-right', 'background-color', 'border-radius', 'max-width', 'min-width', 'overflow-wrap'];
      var ref = {};
      function refStyle(tag, host) {
        if (ref[tag]) return ref[tag];
        var e = document.createElement(tag); host.appendChild(e);
        var cs = getComputedStyle(e), o = {};
        PROPS.forEach(function (p) { o[p] = cs.getPropertyValue(p); });
        host.removeChild(e); return (ref[tag] = o);
      }
      function inline(html) {
        if (!/class\s*=/.test(html)) return html;
        var host = document.createElement('div');
        host.style.cssText = 'position:absolute;left:-9999px;top:0;width:700px';
        document.body.appendChild(host);
        try {
          host.innerHTML = html;
          var multi = host.querySelectorAll('.cell').length > 1;
          var all = host.querySelectorAll('*');
          var ops = [];
          function queue(el, style) { ops.push([el, style]); }
          for (var i = 0; i < all.length; i++) {
            var el = all[i];
            var tag = el.tagName.toLowerCase();
            if (el.closest('svg') && tag !== 'svg') {
              /* éléments internes d'un SVG : on fige les propriétés de dessin que la feuille de style du fichier leur donnait */
              if (el.getAttribute('class') || el.hasAttribute('style')) {
                var cv = getComputedStyle(el), sv = '';
                ['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'fill-opacity', 'stroke-opacity', 'opacity', 'font-size', 'font-family', 'font-weight', 'font-style', 'text-anchor', 'dominant-baseline', 'marker-end', 'marker-start'].forEach(function (p) { var v = cv.getPropertyValue(p); if (v && v !== 'normal' && v !== 'auto') sv += p + ':' + v + ';'; });
                queue(el, (el.getAttribute('style') || '') + ';' + sv);
              }
              continue;
            }
            if (!el.getAttribute('class') && tag !== 'svg') continue;
            if (tag === 'svg') {
              var sc = getComputedStyle(el);
              if (sc.getPropertyValue('position') !== 'static') {
                /* SVG en surimpression (flèches courbes) : on garde sa position et sa taille */
                queue(el, (el.getAttribute('style') || '') + ';position:' + sc.getPropertyValue('position') + ';left:' + sc.getPropertyValue('left') + ';top:' + sc.getPropertyValue('top') + ';width:' + sc.getPropertyValue('width') + ';height:' + sc.getPropertyValue('height') + ';pointer-events:none;overflow:visible;');
              } else queue(el, 'max-width:100%;max-height:' + (multi ? '15vh' : '34vh') + ';width:auto;height:auto;color:inherit;display:block;margin:0 auto');
              continue;
            }
            var cs = getComputedStyle(el), r = refStyle(tag, host), st = '';
            var ml = cs.getPropertyValue('margin-left'), mr = cs.getPropertyValue('margin-right');
            var sym = Math.abs(parseFloat(ml) - parseFloat(mr)) < 1 && parseFloat(ml) > 0 && cs.getPropertyValue('display') === 'block';
            /* marges latérales égales et non nulles = « margin:auto » résolu en px dans notre conteneur : on garde auto */
            if (sym) st += el.querySelector('svg,img,canvas') ? 'margin-left:auto;margin-right:auto;width:100%;' : 'margin-left:auto;margin-right:auto;width:fit-content;width:-webkit-fit-content;';
            PROPS.forEach(function (p) { if (sym && /^margin-(left|right)$/.test(p)) return; var v = cs.getPropertyValue(p); if (v && v !== r[p]) st += p + ':' + v + ';'; });
            if (cs.getPropertyValue('position') !== 'static') {
              st += 'position:' + cs.getPropertyValue('position') + ';';
              (cs.getPropertyValue('position') === 'relative' ? ['height', 'min-height', 'z-index'] : ['left', 'top', 'transform', 'z-index']).forEach(function (p) { var v = cs.getPropertyValue(p); if (v && v !== 'auto' && v !== 'none' && v !== '0px') st += p + ':' + v + ';'; });
              if (cs.getPropertyValue('position') !== 'relative') { st += 'white-space:nowrap;'; if (cs.getPropertyValue('left') === '0px') st += 'left:0;'; if (cs.getPropertyValue('top') === '0px') st += 'top:0;'; }
            }
            queue(el, (el.getAttribute('style') || '') + ';' + (st || ''));
          }
          ops.forEach(function (o) { o[0].setAttribute('style', o[1]); o[0].removeAttribute('class'); });
          return host.innerHTML;
        } catch (e) { return html; } finally { document.body.removeChild(host); }
      }
      return function (s) {
        s = String(s == null ? '' : s);
        if (s.indexOf('{{') >= 0) { var f = find(s); if (f) { try { s = f(s); } catch (e) { /* rien */ } } }
        return inline(s);
      };
    }
    /* Données déclarées dans une fonction (IIFE, « use strict ») : inaccessibles depuis l'extérieur, on lit le littéral dans le source */
    function literalAt(t, i) {
      var open = t.charAt(i), depth = 0, n = t.length, q = null;
      for (var k = i; k < n; k++) {
        var ch = t.charAt(k);
        if (q) { if (ch === '\\') k++; else if (ch === q) q = null; continue; }
        if (ch === '"' || ch === "'" || ch === '`') { q = ch; continue; }
        if (ch === '/' && t.charAt(k + 1) === '/') { var e1 = t.indexOf('\n', k); if (e1 < 0) return null; k = e1; continue; }
        if (ch === '/' && t.charAt(k + 1) === '*') { var e2 = t.indexOf('*/', k + 2); if (e2 < 0) return null; k = e2 + 1; continue; }
        if (ch === '[' || ch === '{') depth++;
        else if (ch === ']' || ch === '}') { depth--; if (depth === 0) return t.slice(i, k + 1); }
      }
      return null;
    }
    function localValues(scripts) {
      var out = [], seen = {};
      scripts.forEach(function (sc) {
        var type = (sc.type || '').toLowerCase(), t = sc.textContent || '';
        if ((type && type.indexOf('javascript') < 0 && type !== 'module') || t.length > 250000) return;
        var re = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*([\[{])/g, m;
        while ((m = re.exec(t))) {
          var lit = literalAt(t, m.index + m[0].length - 1);
          if (!lit || lit.length < 40 || seen[lit]) continue;
          seen[lit] = 1;
          try { var v = (new Function('"use strict";return (' + lit + ');'))(); if (nested(v)) out.push(v); } catch (e) { /* dépend d'autres variables : on ignore */ }
        }
      });
      return out;
    }
    function tryGeneric() {
      var scripts = [].slice.call(document.scripts).filter(function (s) { return !s.hasAttribute('data-fc'); });
      var cands = [], names = {};
      scripts.forEach(function (sc) {
        var type = (sc.type || '').toLowerCase(), text = sc.textContent || '';
        if (/^@@C\|/m.test(text)) { var d = parseAt(text); if (d.length) cands.push({ decks: d }); return; }
        if (type === 'application/json' || type === 'application/ld+json') { try { var j = JSON.parse(text), o1 = []; collect(j, '', o1, 0, 'strict', { n: 0 }); if (o1.length) cands.push({ decks: o1 }); } catch (e) { /* rien */ } return; }
        if (type && type.indexOf('javascript') < 0 && type !== 'module') return;
        var re = /(?:^|[;\n{}])\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g, m;
        while ((m = re.exec(text))) names[m[1]] = 1;
      });
      Object.keys(names).forEach(function (nm) {
        var v;
        try { v = (0, eval)(nm); } catch (e) { return; }
        if (!nested(v) || (!Array.isArray(v) && !isPlain(v))) return;
        ['strict', 'loose'].forEach(function (mode) {
          var out = [];
          try { collect(v, '', out, 0, mode, { n: 0 }); } catch (e) { /* rien */ }
          if (out.length) cands.push({ decks: out, mode: mode });
        });
      });
      localValues(scripts).forEach(function (v) {
        ['strict', 'loose'].forEach(function (mode) {
          var out = [];
          try { collect(v, '', out, 0, mode, { n: 0 }); } catch (e) { /* rien */ }
          if (out.length) cands.push({ decks: out, mode: mode });
        });
      });
      /* on garde la source qui contient le plus de cartes (en préférant les formats stricts) */
      var best = null, bestN = 0;
      cands.forEach(function (c) {
        var n = 0; c.decks.forEach(function (d) { n += d.cards.length; });
        var score = n * (c.mode === 'loose' ? 0.5 : 1);
        if (score > bestN) { bestN = score; best = c; }
      });
      if (!best) return null;
      var prep = makePrep(scripts);
      var tabs = best.decks.filter(function (d) { return d.cards.length; }).map(function (d, i) {
        return { key: 'g' + i, title: (d.title || 'Set ' + (i + 1)).replace(/\s+/g, ' ').trim().slice(0, 120), cards: d.cards.map(function (c) { return { f: fixMath(prep(c.f)), b: fixMath(prep(c.b)) }; }) };
      });
      return { title: docTitle(), sub: '', tabs: tabs };
    }

    /* Cartes déclarées dans le HTML : <div class="set" data-title> contenant des <span class="c" data-f data-b> */
    function tryDom() {
      var sets = [].slice.call(document.querySelectorAll('.set'));
      var scripts = [].slice.call(document.scripts).filter(function (s) { return !s.hasAttribute('data-fc'); });
      var tabs = [];
      sets.forEach(function (st, i) {
        var els = [].slice.call(st.querySelectorAll('[data-f][data-b]'));
        if (!els.length) return;
        var title = (st.getAttribute('data-title') || 'Set ' + (i + 1)).replace(/\s+/g, ' ').trim().slice(0, 120);
        var key = st.getAttribute('data-key') || ('g' + i);
        if (st.getAttribute('data-recap') === '1' && !/r[ée]cap/i.test(title)) title = 'Récap Ultra-Important';
        tabs.push({ key: key, title: title, cards: els.map(function (e) { return { f: e.getAttribute('data-f'), b: e.getAttribute('data-b') }; }) });
      });
      if (!tabs.length) return null;
      var prep = makePrep(scripts);
      tabs.forEach(function (t) { t.cards = t.cards.map(function (c) { return { f: fixMath(prep(c.f)), b: fixMath(prep(c.b)) }; }); });
      return { title: docTitle(), sub: '', tabs: tabs };
    }

    /* Jeux statiques : <section class="tab" id="tab-x"> de <div class="card"> avec .q (question) et .a (réponse) */
    function tryStatic() {
      var secs = [].slice.call(document.querySelectorAll('section.tab, [id^="tab-"]')).filter(function (e) { return e.querySelector('.card .q, .card .a') || e.querySelector('.q'); });
      var tabs = [];
      var prep = makePrep([].slice.call(document.scripts));
      secs.forEach(function (sec, i) {
        var key = (sec.id || '').replace(/^tab-/, '') || ('g' + i);
        var btn = document.querySelector('[data-tab="' + key + '"]');
        var title = ((btn && btn.textContent) || key).replace(/\s+/g, ' ').trim().slice(0, 120);
        if (key === 'recap' && !/r[ée]cap/i.test(title)) title = 'Récap Ultra-Important';
        var cards = [].slice.call(sec.querySelectorAll('.card')).map(function (c) {
          var q = c.querySelector('.q'), a = c.querySelector('.a');
          if (!q || !a) return null;
          return { f: prep(q.innerHTML.trim()), b: prep(a.innerHTML.trim()) };
        }).filter(Boolean);
        if (cards.length) tabs.push({ key: key, title: title, cards: cards });
      });
      if (!tabs.length) return null;
      return { title: docTitle(), sub: '', tabs: tabs };
    }

    function run() {
      try {
        var res = tryTemplate();
        var isTpl = !!res;
        if (!res || total(res) === 0) { var d0 = tryDom(); if (d0 && total(d0) > 0) res = d0; }
        if (!res || total(res) === 0) { var d1 = tryStatic(); if (d1 && total(d1) > 0) res = d1; }
        if (!res || total(res) === 0) { var g = tryGeneric(); if (g && total(g) > 0) res = g; }
        if (!res) return post({ error: 'format' });
        if (total(res) === 0) return post({ error: 'empty' });
        post(res);
      } catch (e) {
        post({ error: String((e && e.message) || e) });
      }
    }
    window.addEventListener('load', function () { setTimeout(run, 120); });
  }
  var HARVEST_SRC = '(' + harvestRunner.toString() + ')();';

  function harvest(html) {
    return new Promise(function (resolve, reject) {
      var clean = String(html)
        .replace(/<script\b[^>]*\bsrc\s*=[^>]*>\s*<\/script>/gi, '')
        .replace(/<link\b[^>]*>/gi, '')
        .replace(/<meta\b[^>]*http-equiv[^>]*>/gi, '');
      var inj = '<script data-fc="1">' + HARVEST_SRC + '<\/script>';
      clean = /<\/body>/i.test(clean) ? clean.replace(/<\/body>/i, function () { return inj + '</body>'; }) : clean + inj;
      /* l'iframe est isolée : on fournit un faux localStorage et des bouchons pour KaTeX, sinon certains fichiers plantent au démarrage */
      var shim = '<script data-fc="1">(function(){function S(){var d={};return{getItem:function(k){return Object.prototype.hasOwnProperty.call(d,k)?d[k]:null},setItem:function(k,v){d[k]=String(v)},removeItem:function(k){delete d[k]},clear:function(){d={}},key:function(i){return Object.keys(d)[i]||null},get length(){return Object.keys(d).length}}}' +
        'try{Object.defineProperty(window,"localStorage",{value:S(),configurable:true});Object.defineProperty(window,"sessionStorage",{value:S(),configurable:true})}catch(e){}' +
        'window.renderMathInElement=function(){};window.katex=window.katex||{render:function(){},renderToString:function(s){return s}};})();<\/script>';
      if (/<head[^>]*>/i.test(clean)) clean = clean.replace(/<head[^>]*>/i, function (m) { return m + shim; });
      else if (/<html[^>]*>/i.test(clean)) clean = clean.replace(/<html[^>]*>/i, function (m) { return m + shim; });
      else clean = shim + clean;

      var ifr = document.createElement('iframe');
      ifr.setAttribute('sandbox', 'allow-scripts');
      ifr.setAttribute('aria-hidden', 'true');
      ifr.tabIndex = -1;
      ifr.style.cssText = 'position:fixed;left:-9999px;top:0;width:900px;height:700px;border:0;visibility:hidden';
      var done = false;
      function finish(err, val) {
        if (done) return;
        done = true;
        clearTimeout(to);
        window.removeEventListener('message', onMsg);
        ifr.remove();
        if (err) reject(err); else resolve(val);
      }
      function onMsg(e) {
        if (e.source !== ifr.contentWindow || !e.data || !e.data.fcHarvest) return;
        var p = e.data.payload || {};
        if (p.error) return finish(new Error(p.error === 'format' || p.error === 'empty' ? p.error : 'Lecture impossible : ' + p.error));
        finish(null, p);
      }
      var to = setTimeout(function () { finish(new Error('Le fichier met trop de temps à répondre.')); }, 8000);
      window.addEventListener('message', onMsg);
      ifr.srcdoc = clean;
      document.body.appendChild(ifr);
    });
  }

  function splitNote(b) {
    var m = /<div class="note">([\s\S]*?)<\/div>\s*$/.exec(b);
    if (!m) return { b: b, n: '' };
    return { b: b.slice(0, m.index).trim(), n: m[1].trim() };
  }

  function portableFromHarvest(h) {
    var recap = null, chapters = [];
    h.tabs.forEach(function (t) {
      if (t.key === 'recap' || /r[ée]cap/i.test(t.title)) { if (!recap) recap = t; else chapters.push(t); } else chapters.push(t);
    });
    if (!chapters.length && recap) { chapters.push({ title: recap.title, cards: recap.cards }); recap = null; }
    var rk = {};
    if (recap) recap.cards.forEach(function (c) { rk[c.f + '\u0000' + c.b] = 1; });
    var used = {};
    var p = { kind: 'set', title: h.title, sub: h.sub, chapters: [], cards: [], errors: [] };
    chapters.forEach(function (t, i) {
      p.chapters.push({ title: t.title || 'Cartes' });
      t.cards.forEach(function (c) {
        var k = c.f + '\u0000' + c.b, sn = splitNote(c.b);
        if (rk[k]) used[k] = 1;
        p.cards.push({ ch: i, f: c.f, b: sn.b, n: sn.n, star: !!rk[k] });
      });
    });
    if (recap) {
      var rci = -1;
      recap.cards.forEach(function (c) {
        var k = c.f + '\u0000' + c.b;
        if (used[k]) return;
        if (rci < 0) { p.chapters.push({ title: FC.RECAP_CH }); rci = p.chapters.length - 1; }
        var sn = splitNote(c.b);
        p.cards.push({ ch: rci, f: c.f, b: sn.b, n: sn.n, star: true });
      });
    }
    return p;
  }

  /* À l'import d'un jeu, le Récap du fichier est ignoré : le Récap, c'est uniquement ce que tu coches toi-même. */
  function stripRecap(p) {
    var keep = [], map = {};
    p.chapters.forEach(function (c, i) { if (!FC.isRecapCh(c)) { map[i] = keep.length; keep.push(c); } });
    if (!keep.length) keep.push({ title: 'Cartes' });
    var cardIdx = {}, cards = [];
    p.cards.forEach(function (c, i) {
      if (map[c.ch] === undefined) return;
      cardIdx[i] = cards.length;
      cards.push({ ch: map[c.ch], f: c.f, b: c.b, n: c.n, star: false });
    });
    var errs = [];
    (p.errors || []).forEach(function (i) { if (cardIdx[i] !== undefined) errs.push(cardIdx[i]); });
    p.chapters = keep; p.cards = cards; p.errors = errs;
    return p;
  }

  /* Lit un fichier : soit une sauvegarde / un export de l'appli (données intégrées), soit un fichier au format cahier */
  FC.parseFile = function (file) {
    return file.text().then(function (text) {
      var doc = new DOMParser().parseFromString(text, 'text/html');
      var node = doc.getElementById('fc-data');
      if (node) {
        var j;
        try { j = JSON.parse(node.textContent); } catch (e) { throw new Error('Fichier abîmé.'); }
        if (j && j.kind === 'set') return { kind: 'set', data: stripRecap(j), name: file.name };
        if (j && j.kind === 'library') return { kind: 'library', data: j, name: file.name };
      }
      return harvest(text).then(function (h) {
        var d = stripRecap(portableFromHarvest(h));
        if (!d.cards.length) throw new Error('Aucune carte trouvée dans ce fichier. Envoie-le moi, je l’adapte.');
        return { kind: 'set', data: d, name: file.name };
      }, function (err) {
        if (err && (err.message === 'format' || err.message === 'empty')) throw new Error('Aucune carte trouvée dans ce fichier. Envoie-le moi, je l’adapte.');
        throw err;
      });
    });
  };

  /* ---------- Export ---------- */
  var CSS = [
    ':root{--paper:#fbf6e6;--ink:#2a2622;--rule:rgba(96,130,170,.28);--blue:#5a7088;--bordeaux:#7e1f3b;--card:#fffdf4}',
    '*{box-sizing:border-box}[hidden]{display:none!important}html,body{margin:0}',
    'body{font-family:Georgia,"Iowan Old Style","Times New Roman",serif;color:var(--ink);background-color:var(--paper);background-image:repeating-linear-gradient(to bottom,transparent 0,transparent 31px,var(--rule) 31px,var(--rule) 32px);min-height:100vh}',
    '@media (min-width:960px){body{background-image:linear-gradient(to right,transparent 56px,rgba(200,80,80,.35) 56px,rgba(200,80,80,.35) 58px,transparent 58px),repeating-linear-gradient(to bottom,transparent 0,transparent 31px,var(--rule) 31px,var(--rule) 32px)}}',
    '.wrap{max-width:860px;margin:0 auto;padding:0 16px 40px}header{padding:26px 0 14px}',
    'h1{margin:0;font-size:1.7rem;font-weight:normal;letter-spacing:.2px}h1 small{display:block;font-size:.85rem;color:#6b6152;margin-top:4px;font-style:italic}',
    'nav#tabs{display:flex;gap:4px;overflow-x:auto;border-bottom:2px solid rgba(60,40,20,.25)}',
    'nav#tabs button{font:inherit;font-size:1rem;background:transparent;border:none;cursor:pointer;padding:10px 14px;color:#5b5348;white-space:nowrap;border-bottom:3px solid transparent;margin-bottom:-2px;border-radius:8px 8px 0 0}',
    'nav#tabs button:hover{background:rgba(255,253,244,.6)}',
    'nav#tabs button.active{color:var(--bordeaux);font-weight:bold;border-bottom-color:var(--bordeaux);background:rgba(255,253,244,.95)}',
    '.badge{display:inline-block;min-width:1.5em;text-align:center;background:var(--bordeaux);color:#fff;border-radius:999px;font-size:.72em;padding:1px 6px;margin-left:6px;vertical-align:middle}',
    '.topline{display:flex;justify-content:space-between;align-items:baseline;gap:12px;margin:18px 2px 4px}',
    '#setTitle{font-size:1.05rem;color:#5b5348;font-style:italic}#counter{font-size:1rem;color:#5b5348;white-space:nowrap}',
    '.card{perspective:1600px;cursor:pointer;margin:10px 0 16px;outline:none}',
    '.inner{display:grid;transition:transform .55s cubic-bezier(.4,.2,.2,1);transform-style:preserve-3d}',
    '.card.noanim .inner{transition:none}.card.flipped .inner{transform:rotateY(180deg)}',
    '.face{grid-area:1/1;position:relative;backface-visibility:hidden;-webkit-backface-visibility:hidden;background:var(--card);border-radius:14px;box-shadow:0 4px 14px rgba(60,40,20,.15),0 1px 3px rgba(60,40,20,.12);border-left:9px solid var(--blue);padding:34px 26px 26px 30px;min-height:290px;display:flex;flex-direction:column;justify-content:center;font-size:1.25rem;line-height:1.55;overflow:hidden}',
    '.face.back{transform:rotateY(180deg);border-left-color:var(--bordeaux)}',
    '.tag{position:absolute;top:12px;left:30px;font-size:.7rem;letter-spacing:.14em;text-transform:uppercase;color:var(--blue)}.back .tag{color:var(--bordeaux)}',
    '.content{text-align:center}.content .katex-display{margin:.55em 0;overflow-x:auto;overflow-y:hidden;padding:.1em 0}',
    '.nl{display:inline-block;margin-right:.55em;font-size:.78em;font-weight:700;letter-spacing:.05em;text-transform:uppercase;opacity:.7}',
    '.note{font-size:.95rem;color:#5b4a3a;margin-top:.7em;padding-top:.5em;border-top:1px dashed rgba(60,40,20,.3)}',
    '.actions{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}',
    '.actions button{font:inherit;font-size:1rem;padding:10px 16px;border:1.5px solid #8a7f6a;background:var(--card);border-radius:10px;cursor:pointer;color:var(--ink)}',
    '.actions button:hover:not(:disabled){background:#f4ecd2}.actions button:disabled{opacity:.4;cursor:default}',
    '#errBtn.active{background:#f3dde2;border-color:var(--bordeaux);color:var(--bordeaux);font-weight:bold}',
    '.hint{text-align:center;font-size:.85rem;color:#7a6f5e;margin:14px 0 0;font-style:italic}',
    '.empty{background:var(--card);border-radius:14px;border-left:9px solid var(--bordeaux);box-shadow:0 4px 14px rgba(60,40,20,.15);padding:34px 26px;margin:14px 0;font-size:1.1rem;line-height:1.6;text-align:center}',
    '@media (max-width:640px){h1{font-size:1.4rem}.face{font-size:1.05rem;min-height:250px;padding:34px 16px 20px 18px}.tag{left:18px}}'
  ].join('\n');

  FC.MACROS_JSON = "{\"\\\\R\": \"\\\\mathbb{R}\", \"\\\\C\": \"\\\\mathbb{C}\", \"\\\\N\": \"\\\\mathbb{N}\", \"\\\\K\": \"\\\\mathbb{K}\", \"\\\\Z\": \"\\\\mathbb{Z}\", \"\\\\Sp\": \"\\\\operatorname{Sp}\", \"\\\\Ker\": \"\\\\operatorname{Ker}\", \"\\\\Im\": \"\\\\operatorname{Im}\", \"\\\\rg\": \"\\\\operatorname{rg}\", \"\\\\tr\": \"\\\\operatorname{tr}\", \"\\\\Vect\": \"\\\\operatorname{Vect}\", \"\\\\Cov\": \"\\\\operatorname{Cov}\", \"\\\\Id\": \"\\\\operatorname{Id}\", \"\\\\Mat\": \"\\\\operatorname{Mat}\", \"\\\\ch\": \"\\\\operatorname{ch}\", \"\\\\sh\": \"\\\\operatorname{sh}\", \"\\\\th\": \"\\\\operatorname{th}\", \"\\\\coth\": \"\\\\operatorname{coth}\", \"\\\\cotan\": \"\\\\operatorname{cotan}\", \"\\\\Argsh\": \"\\\\operatorname{Arg\\\\,sh}\", \"\\\\Argch\": \"\\\\operatorname{Arg\\\\,ch}\", \"\\\\Argth\": \"\\\\operatorname{Arg\\\\,th}\", \"\\\\Argcoth\": \"\\\\operatorname{Arg\\\\,coth}\", \"\\\\Arcsin\": \"\\\\operatorname{Arc\\\\,sin}\", \"\\\\Arccos\": \"\\\\operatorname{Arc\\\\,cos}\", \"\\\\Arctan\": \"\\\\operatorname{Arc\\\\,tan}\", \"\\\\Arccotan\": \"\\\\operatorname{Arc\\\\,cotan}\", \"\\\\grad\": \"\\\\overrightarrow{\\\\operatorname{grad}}\", \"\\\\rot\": \"\\\\overrightarrow{\\\\operatorname{rot}}\", \"\\\\dv\": \"\\\\operatorname{div}\", \"\\\\nab\": \"\\\\overrightarrow{\\\\nabla}\", \"\\\\Div\": \"\\\\operatorname{div}\", \"\\\\lap\": \"\\\\Delta\", \"\\\\vect\": \"\\\\overrightarrow{#1}\", \"\\\\dd\": \"\\\\mathrm{d}\", \"\\\\M\": \"\\\\mathcal{M}\", \"\\\\Imm\": \"\\\\operatorname{Im}\", \"\\\\GL\": \"\\\\operatorname{GL}\", \"\\\\SL\": \"\\\\operatorname{SL}\", \"\\\\diag\": \"\\\\operatorname{diag}\", \"\\\\Com\": \"\\\\operatorname{Com}\", \"\\\\neq\": \"\\\\mathrel{\\\\char\\\"2260}\", \"\\\\ne\": \"\\\\neq\"}";
  /* Macros à fonction : \not sans "rlap" (mal rendu par Safari) */
  FC.fixMacros = function (m) {
    var map = {
      '\\Leftarrow': '\\nLeftarrow', '\\Rightarrow': '\\nRightarrow', '\\Leftrightarrow': '\\nLeftrightarrow',
      '\\iff': '\\nLeftrightarrow', '\\implies': '\\nRightarrow', '\\impliedby': '\\nLeftarrow',
      '\\leftarrow': '\\nleftarrow', '\\rightarrow': '\\nrightarrow', '\\to': '\\nrightarrow',
      '\\leftrightarrow': '\\nleftrightarrow', '=': '\\neq', '\\in': '\\notin', '\\equiv': '\\mathrel{\\char"2262}',
      '\\subset': '\\mathrel{\\char"2284}', '\\ni': '\\mathrel{\\char"220C}'
    };
    var o = {};
    for (var k in m) o[k] = m[k];
    o['\\not'] = function (ctx) {
      var tk = ctx.future();
      if (tk && map[tk.text]) { ctx.popToken(); return map[tk.text]; }
      return '\\html@mathml{\\mathrel{\\mathrlap\\@not}}{\\char"338}';
    };
    o['\\notin'] = '\\mathrel{\\char"2209}';
    return o;
  };
  function viewerScript() {
    var J = JSON.parse(document.getElementById('fc-data').textContent);
    var MACROS = {};
    try { MACROS = JSON.parse(document.getElementById('fc-macros').textContent); } catch (e) {}
    if (window.FC_FIXMACROS) MACROS = window.FC_FIXMACROS(MACROS);
    var cards = J.cards.map(function (c, i) {
      return { id: 'c' + i, f: c.f, b: c.b + (c.n ? '<div class="note">' + c.n + '</div>' : ''), star: !!c.star, ch: c.ch };
    });
    var data = [];
    var recap = cards.filter(function (c) { return c.star; });
    if (recap.length) data.push({ key: 'recap', title: 'Récap Ultra-Important', cards: recap });
    J.chapters.forEach(function (ch, i) {
      if (ch.title === '\u00a7R\u00e9cap') return;
      data.push({ key: 'ch' + i, title: ch.title, cards: cards.filter(function (c) { return c.ch === i; }) });
    });
    var ERR_KEY = 'errors', ERR_TITLE = '★ Mes erreurs';
    var LS_KEY = 'flashcards:' + (J.title || 'jeu') + ':errors:v1';
    function loadErrors() {
      try {
        var raw = window.localStorage.getItem(LS_KEY);
        if (raw === null) return (J.errors || []).map(function (i) { return 'c' + i; });
        var a = JSON.parse(raw);
        return Array.isArray(a) ? a : [];
      } catch (e) { return (J.errors || []).map(function (i) { return 'c' + i; }); }
    }
    function saveErrors() { try { window.localStorage.setItem(LS_KEY, JSON.stringify(errors)); } catch (e) { /* rien */ } }
    var errors = loadErrors();
    function isErr(c) { return errors.indexOf(c.id) !== -1; }
    function allCards() {
      var seen = {}, out = [];
      data.forEach(function (s) { s.cards.forEach(function (c) { if (!seen[c.id]) { seen[c.id] = true; out.push(c); } }); });
      return out;
    }
    function cardsFor(key) {
      if (key === ERR_KEY) return allCards().filter(isErr);
      for (var i = 0; i < data.length; i++) if (data[i].key === key) return data[i].cards;
      return [];
    }
    function titleFor(key) {
      if (key === ERR_KEY) return ERR_TITLE;
      for (var i = 0; i < data.length; i++) if (data[i].key === key) return data[i].title;
      return '';
    }
    var $ = function (id) { return document.getElementById(id); };
    var tabsEl = $('tabs'), card = $('card'), front = $('front'), back = $('back'), counter = $('counter'),
      setTitle = $('setTitle'), stage = $('stage'), emptyEl = $('empty'), prev = $('prev'), next = $('next'), errBtn = $('errBtn');
    var cur = data.length ? data[0].key : ERR_KEY;
    var pos = {};
    function typeset(el) {
      if (typeof window.renderMathInElement === 'function') {
        try {
          window.renderMathInElement(el, { delimiters: [{ left: '$$', right: '$$', display: true }, { left: '$', right: '$', display: false }], throwOnError: false, macros: MACROS });
        } catch (e) { /* le LaTeX brut reste affiché */ }
      }
    }
    function buildTabs() {
      tabsEl.innerHTML = '';
      var keys = data.map(function (s) { return s.key; }).concat([ERR_KEY]);
      keys.forEach(function (k) {
        var b = document.createElement('button');
        b.type = 'button';
        b.setAttribute('data-key', k);
        b.appendChild(document.createTextNode(titleFor(k)));
        if (k === ERR_KEY) {
          var badge = document.createElement('span');
          badge.className = 'badge'; badge.id = 'errBadge';
          b.appendChild(badge);
        }
        b.addEventListener('click', function () { cur = k; go(); });
        tabsEl.appendChild(b);
      });
      updateTabs();
    }
    function updateTabs() {
      var btns = tabsEl.querySelectorAll('button');
      for (var i = 0; i < btns.length; i++) btns[i].className = btns[i].getAttribute('data-key') === cur ? 'active' : '';
      var badge = $('errBadge');
      if (badge) { var n = allCards().filter(isErr).length; badge.textContent = String(n); badge.hidden = n === 0; }
    }
    function updateErrBtn(c) {
      var on = isErr(c);
      errBtn.className = on ? 'active' : '';
      errBtn.textContent = on ? '★ Erreur marquée — retirer' : '☆ Marquer comme erreur';
    }
    function render() {
      var cards = cardsFor(cur), n = cards.length;
      setTitle.textContent = titleFor(cur);
      if (!n) {
        stage.hidden = true; emptyEl.hidden = false;
        emptyEl.textContent = cur === ERR_KEY ? 'Aucune erreur marquée. Pendant une révision, clique sur « Marquer comme erreur » pour retrouver ici les cartes à retravailler.' : 'Aucune carte ici.';
        counter.textContent = 'Carte 0 / 0';
        prev.disabled = true; next.disabled = true; errBtn.hidden = true;
        return;
      }
      stage.hidden = false; emptyEl.hidden = true; errBtn.hidden = false;
      var i = Math.min(Math.max(pos[cur] || 0, 0), n - 1);
      pos[cur] = i;
      var c = cards[i];
      front.innerHTML = c.f; back.innerHTML = c.b;
      typeset(card);
      counter.textContent = 'Carte ' + (i + 1) + ' / ' + n;
      prev.disabled = i === 0; next.disabled = i === n - 1;
      updateErrBtn(c);
    }
    function go() {
      card.classList.add('noanim'); card.classList.remove('flipped');
      updateTabs(); render();
      void card.offsetWidth;
      setTimeout(function () { card.classList.remove('noanim'); }, 30);
    }
    function flip() { if (!stage.hidden) card.classList.toggle('flipped'); }
    function step(d) {
      var n = cardsFor(cur).length, i = (pos[cur] || 0) + d;
      if (i < 0 || i > n - 1) return;
      pos[cur] = i; go();
    }
    function currentCard() {
      var cs = cardsFor(cur);
      return cs[Math.min(Math.max(pos[cur] || 0, 0), cs.length - 1)];
    }
    card.addEventListener('click', flip);
    prev.addEventListener('click', function () { step(-1); });
    next.addEventListener('click', function () { step(1); });
    errBtn.addEventListener('click', function () {
      var c = currentCard();
      if (!c) return;
      var k = errors.indexOf(c.id);
      if (k === -1) errors.push(c.id); else errors.splice(k, 1);
      saveErrors(); updateTabs();
      if (cur === ERR_KEY) go(); else updateErrBtn(c);
    });
    document.addEventListener('keydown', function (e) {
      var t = e.target && e.target.tagName;
      if (e.key === 'ArrowLeft') step(-1);
      else if (e.key === 'ArrowRight') step(1);
      else if ((e.key === ' ' || e.key === 'Enter') && t !== 'BUTTON') { e.preventDefault(); flip(); }
    });
    buildTabs();
    render();
    window.addEventListener('load', function () { render(); });
  }

  function staticList(p) {
    var h = '<main style="max-width:760px;margin:24px auto;padding:0 16px;font-family:Georgia,serif;color:#231f1b"><h1>' + esc(p.title) + '</h1><p style="color:#7c7c7c">Aperçu sans JavaScript : ouvre ce fichier dans Safari ou Chrome pour réviser, ou importe-le dans l’appli.</p>';
    p.chapters.forEach(function (c, ci) {
      h += '<h2 style="margin-top:28px">' + esc(c.title === FC.RECAP_CH ? 'Récap' : c.title) + '</h2>';
      p.cards.forEach(function (c2, i) {
        if ((c2.ch || 0) !== ci) return;
        h += '<div style="border:1px solid #dcd6ca;border-radius:10px;padding:12px 14px;margin:10px 0;background:#fff"><div><b>Q.</b> ' + c2.f + '</div><div style="margin-top:8px"><b>R.</b> ' + c2.b + '</div></div>';
      });
    });
    return h + '</main>';
  }
  FC.buildSetHTML = function (set) {
    var p = FC.toPortable(set);
    var title = esc(p.title), sub = esc(p.sub || 'Flashcards');
    return [
      '<!DOCTYPE html>',
      '<html lang="fr">',
      '<head>',
      '<meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      '<meta name="color-scheme" content="light">',
      '<title>Flashcards — ' + title + '</title>',
      '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.19.1/dist/katex.min.css">',
      '<script defer src="https://cdn.jsdelivr.net/npm/katex@0.19.1/dist/katex.min.js"><\/script>',
      '<script defer src="https://cdn.jsdelivr.net/npm/katex@0.19.1/dist/contrib/auto-render.min.js"><\/script>',
      '<style>',
      CSS,
      '</style>',
      '<noscript><style>.wrap{display:none}</style></noscript>',
      '</head>',
      '<body>',
      '<noscript>' + staticList(p) + '</noscript>',
      '<div class="wrap">',
      '  <header><h1>' + title + '<small>' + sub + '</small></h1></header>',
      '  <nav id="tabs" role="tablist" aria-label="Sets de flashcards"></nav>',
      '  <div class="topline"><span id="setTitle"></span><span id="counter"></span></div>',
      '  <div id="stage">',
      '    <div class="card" id="card" tabindex="0" aria-label="Carte, cliquer pour retourner">',
      '      <div class="inner">',
      '        <div class="face front"><span class="tag">Question</span><div class="content" id="front"></div></div>',
      '        <div class="face back"><span class="tag">Réponse</span><div class="content" id="back"></div></div>',
      '      </div>',
      '    </div>',
      '  </div>',
      '  <div class="empty" id="empty" hidden></div>',
      '  <div class="actions">',
      '    <button id="prev" type="button">← Précédente</button>',
      '    <button id="errBtn" type="button" aria-pressed="false">☆ Marquer comme erreur</button>',
      '    <button id="next" type="button">Suivante →</button>',
      '  </div>',
      '  <p class="hint">Clic sur la carte pour la retourner · ← → pour naviguer · Espace pour retourner</p>',
      '</div>',
      '<script type="application/json" id="fc-data">' + jsonForScript(p) + '<\/script>',
      '<script type="application/json" id="fc-macros">' + FC.MACROS_JSON + '<\/script>',
      '<script>window.FC_FIXMACROS=' + FC.fixMacros.toString() + ';<\/script>',
      '<script>(' + viewerScript.toString() + ')();<\/script>',
      '</body>',
      '</html>'
    ].join('\n');
  };

  FC.buildLibraryHTML = function () {
    var p = FC.toPortableLibrary();
    var t = FC.totals();
    var rows = [];
    function walk(parent, depth) {
      FC.children(parent).forEach(function (f) {
        rows.push('<li style="margin-left:' + depth * 18 + 'px"><b>' + esc(f.name) + '</b></li>');
        FC.setsIn(f.id).forEach(function (s) {
          rows.push('<li style="margin-left:' + (depth + 1) * 18 + 'px">' + esc(s.title) + ' <span>' + s.cards.length + ' cartes</span></li>');
        });
        walk(f.id, depth + 1);
      });
    }
    walk(null, 0);
    FC.setsIn(null).forEach(function (s) { rows.push('<li>' + esc(s.title) + ' <span>' + s.cards.length + ' cartes</span></li>'); });
    var d = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    return [
      '<!DOCTYPE html>', '<html lang="fr"><head><meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      '<title>Sauvegarde Flashcards — ' + esc(d) + '</title>',
      '<style>body{font-family:Georgia,serif;background:#f6f1e7;color:#231f1b;max-width:720px;margin:40px auto;padding:0 20px;line-height:1.6}h1{font-weight:600;margin-bottom:4px}p{color:#6b6156}ul{list-style:none;padding:0}li{padding:3px 0}li span{color:#6b6156;font-size:.9em;margin-left:6px}.box{background:#fffdf8;border:1px solid rgba(35,31,27,.12);border-radius:14px;padding:16px 20px;margin:20px 0}</style>',
      '</head><body>',
      '<h1>Sauvegarde Flashcards</h1>',
      '<p>' + esc(d) + ' · ' + t.folders + ' dossiers · ' + t.sets + ' jeux · ' + t.cards + ' cartes</p>',
      '<div class="box"><b>Pour restaurer :</b> ouvre l’application Flashcards, clique sur « Importer un HTML » et choisis ce fichier. Tes dossiers, tes jeux et tes erreurs reviennent tels quels.</div>',
      '<ul>' + rows.join('') + '</ul>',
      '<script type="application/json" id="fc-data">' + jsonForScript(p) + '<\/script>',
      '<script type="application/json" id="fc-macros">' + FC.MACROS_JSON + '<\/script>',
      '</body></html>'
    ].join('\n');
  };

  FC.download = function (name, text) {
    var blob = new Blob([text], { type: 'text/html;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { a.remove(); URL.revokeObjectURL(url); }, 1500);
  };
})();
