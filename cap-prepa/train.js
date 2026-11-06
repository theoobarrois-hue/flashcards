'use strict';
/* Cap Prépa — révision espacée, notes d'erreur, chapitres négligés. */
(function(){
 const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
 const STALE_DAYS=14;
 const baseRender=render,baseSetView=setView,baseDetail=renderDetail;
 const reasonLabel=r=>(REASONS.find(x=>x[0]===r)||[0,''])[1];
 const label=(c,i)=>isFrench(c)?`Axe ${Math.floor(i/4)+1} · argument ${i%4+1}`:`Question ${i+1}`;
 const dayText=d=>{const n=d-today();return n<=0?(n===0?'aujourd’hui':`en retard de ${-n} j`):n===1?'demain':`dans ${n} j`;};
 const ago=d=>{const n=today()-d;return n<=0?'aujourd’hui':n===1?'hier':`il y a ${n} j`;};

 /* ---------- notes ---------- */
 let noteTarget=null;
 function openNote(cid,i){const c=state.chapters.find(x=>x.id===cid);if(!c)return;noteTarget={cid,i};const e=(c.info&&c.info[i])||{};
  q('#noteTitle').textContent=`${c.name} · ${label(c,i)}`;q('#noteReason').value=e.r||'';q('#noteText').value=e.n||'';q('#noteDialog').showModal();q('#noteText').focus();}
 q('#noteReason').innerHTML=REASONS.map(([v,l])=>`<option value="${v}">${v?l:'Aucune cause'}</option>`).join('');
 q('#noteForm').onsubmit=e=>{e.preventDefault();const c=state.chapters.find(x=>x.id===noteTarget?.cid);if(!c)return;
  c.info=c.info||{};const en=c.info[noteTarget.i]||(c.info[noteTarget.i]={}),r=q('#noteReason').value,n=q('#noteText').value.trim().slice(0,240);
  if(r)en.r=r;else delete en.r;if(n)en.n=n;else delete en.n;if(!Object.keys(en).length)delete c.info[noteTarget.i];
  q('#noteDialog').close();commit('Note enregistrée.',true);};
 q('#noteCancel').onclick=()=>q('#noteDialog').close();

 /* ---------- détail du chapitre : liste des erreurs avec cause et note ---------- */
 function errorList(){
  const c=getChapter();if(!c)return;const bad=[];c.questions.forEach((s,i)=>{if(s==='bad')bad.push(i);});
  qa('.q').forEach(b=>{const e=c.info&&c.info[b.dataset.question];if(e&&(e.n||e.r)){b.classList.add('has-note');b.title+=` · ${[reasonLabel(e.r),e.n].filter(Boolean).join(' — ')}`;}});
  if(!bad.length)return;
  q('#detail').insertAdjacentHTML('beforeend',`<section class="err-list"><h3>À retravailler <span class="muted">${bad.length}</span></h3>${bad.map(i=>{const e=(c.info&&c.info[i])||{};return `<div class="err-row"><div><b>${label(c,i)}</b>${e.r?`<span class="reason">${escapeHTML(reasonLabel(e.r))}</span>`:''}${e.n?`<p>${escapeHTML(e.n)}</p>`:''}</div><button class="icon-btn" data-note="${i}" aria-label="Modifier la note">✎ Note</button></div>`;}).join('')}</section>`);
  qa('[data-note]').forEach(b=>b.onclick=()=>openNote(c.id,Number(b.dataset.note)));
 }
 renderDetail=function(){baseDetail.apply(this,arguments);errorList();};

 /* ---------- rendu global ---------- */
 function scopeList(){return live().filter(c=>(subjectFilter==='Tous'||c.subject===subjectFilter)&&(!groupFilter||c.group===groupFilter));}
 function trainRender(){
  const t=today();
  const sub=q('#viewSub');if(sub){{const sc=scopeList().filter(c=>!reviewOnly||CP.counts(c).bad>0),x=sumOf(sc);sub.textContent=sc.length?`${plural(sc.length,'chapitre')} · ${x.total} ${subjectFilter==='Français'?'arguments':subjectFilter==='Tous'?'éléments':'questions'} · ${pctOf(x)} % validés`:'Aucun chapitre pour l’instant';}}
  q('#stale').hidden=true;q('#causes').hidden=true;
  /* chapitres négligés */
  qa('.chapter[data-id]').forEach(b=>{const c=state.chapters.find(x=>x.id===b.dataset.id);if(!c)return;const n=CP.counts(c),days=c.touched===undefined?null:t-c.touched;
   const stale=days!==null&&days>=STALE_DAYS&&n.good<c.total;
   b.insertAdjacentHTML('beforeend',`<div class="last-seen ${stale?'is-stale':''}">${days===null?(n.good+n.bad?'Dernière séance : inconnue':'Pas encore commencé'):stale?`À reprendre · ${days} j sans séance`:`Dernière séance : ${ago(c.touched)}`}</div>`);});
  if(!reviewOnly){
   const stale=scopeList().filter(c=>c.touched!==undefined&&t-c.touched>=STALE_DAYS&&CP.counts(c).good<c.total).sort((a,b)=>a.touched-b.touched);
   if(stale.length){const el=q('#stale');el.hidden=false;el.innerHTML=`<span><b>${stale.length} chapitre${stale.length>1?'s':''} non travaillé${stale.length>1?'s':''} depuis ${stale.length>1?'plus de ':''}${STALE_DAYS} jours</b> · ${stale.slice(0,3).map(c=>`${escapeHTML(c.name)} (${t-c.touched} j)`).join(', ')}${stale.length>3?'…':''}</span><button id="staleSort">Les voir en premier</button>`;
    q('#staleSort').onclick=()=>{q('#sort').value='stale';render();};}
   const counts={};let tot=0;scopeList().forEach(c=>Object.values(c.info||{}).forEach(e=>{if(e.r){counts[e.r]=(counts[e.r]||0)+1;tot++;}}));
   if(tot>=2){const el=q('#causes');el.hidden=false;el.innerHTML=`<h3>Pourquoi tu rates</h3><div class="cause-list">${Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([r,n])=>`<span class="cause"><b>${n}</b> ${escapeHTML(reasonLabel(r))}<i style="width:${Math.round(100*n/tot)}%"></i></span>`).join('')}</div>`;}
  }
 }
 render=function(){baseRender.apply(this,arguments);trainRender();};
  q('#mobileReview').onclick=()=>{setView('Tous',true);goStudy();};
 render();
})();
