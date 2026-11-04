'use strict';
/* Cap Prépa — révision espacée, notes d'erreur, chapitres négligés. */
(function(){
 const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
 const STALE_DAYS=14;
 let dueMode=false;
 const baseRender=render,baseSetView=setView,baseDetail=renderDetail;
 const reasonLabel=r=>(REASONS.find(x=>x[0]===r)||[0,''])[1];
 const label=(c,i)=>isFrench(c)?`Axe ${Math.floor(i/4)+1} · argument ${i%4+1}`:`Question ${i+1}`;
 const dayText=d=>{const n=d-today();return n<=0?(n===0?'aujourd’hui':`en retard de ${-n} j`):n===1?'demain':`dans ${n} j`;};
 const ago=d=>{const n=today()-d;return n<=0?'aujourd’hui':n===1?'hier':`il y a ${n} j`;};

 /* ---------- calcul des révisions ---------- */
 function dueOf(c,i){const s=c.questions[i];if(s==='todo')return null;const e=c.info&&c.info[i];let d=e&&e.due;if(d===undefined&&s==='bad')d=today();return d===undefined?null:d;}
 function allScheduled(){const out=[];for(const c of state.chapters)c.questions.forEach((s,i)=>{const d=dueOf(c,i);if(d!==null)out.push({c,i,s,e:(c.info&&c.info[i])||{},due:d});});return out;}
 const dueItems=()=>{const t=today();return allScheduled().filter(x=>x.due<=t).sort((a,b)=>a.due-b.due||a.c.name.localeCompare(b.c.name,'fr')||a.i-b.i);};

 function review(c,i,ok){
  const t=today();c.touched=t;c.info=c.info||{};const e=c.info[i]||(c.info[i]={});e.t=t;let msg;
  if(ok){
   if(c.questions[i]==='bad'){c.questions[i]='good';e.k=1;e.due=t+STEPS[1];msg=`Réussie. À confirmer ${dayText(e.due)}.`;}
   else{const k=(e.k||1)+1;if(k>=3){delete e.due;delete e.k;msg='Question consolidée : plus de révision prévue.';}else{e.k=k;e.due=t+STEPS[k];msg=`Confirmée. Prochaine révision ${dayText(e.due)}.`;}}
  }else{c.questions[i]='bad';e.k=0;e.due=t+STEPS[0];msg=`À retravailler. Retour ${dayText(e.due)}.`;}
  commit(msg,true);toast(msg);
 }
 function postpone(c,i){c.info=c.info||{};const e=c.info[i]||(c.info[i]={});e.due=today()+1;commit('Reportée à demain.',true);}

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

 /* ---------- panneau « Révision du jour » ---------- */
 function renderDue(){
  const items=dueItems(),t=today(),panel=q('#duePanel');
  if(!items.length){
   const next=allScheduled().filter(x=>x.due>t).sort((a,b)=>a.due-b.due);
   panel.innerHTML=`<div class="empty-state"><h3>Rien à revoir aujourd’hui</h3><p>${next.length?`Prochaine révision ${dayText(next[0].due)} (${next.length} question${next.length>1?'s':''} planifiée${next.length>1?'s':''}).`:'Les questions « à retravailler » reviennent ici automatiquement à J+3, puis J+7 et J+21 une fois réussies.'}</p></div>`;return;}
  const groups=new Map();items.forEach(x=>{if(!groups.has(x.c.id))groups.set(x.c.id,[]);groups.get(x.c.id).push(x);});
  panel.innerHTML=[...groups.values()].map(list=>{const c=list[0].c;return `<section class="due-group"><header><h3>${escapeHTML(c.name)}</h3><span class="badge ${c.subject==='Chimie'?'chem':isFrench(c)?'french':''}">${c.subject}</span><span class="muted">${list.length} à revoir</span></header>${list.map(x=>{const late=t-x.due;return `<article class="due-row"><div class="due-main"><b>${label(c,x.i)}</b><span class="tag ${x.s==='good'?'confirm':'redo-tag'}">${x.s==='good'?'À confirmer':'À retravailler'}</span>${late>0?`<span class="late">en retard de ${late} j</span>`:''}${x.e.r?`<span class="reason">${escapeHTML(reasonLabel(x.e.r))}</span>`:''}</div>${x.e.n?`<p class="due-note">${escapeHTML(x.e.n)}</p>`:''}<div class="due-actions"><button class="ok" data-act="ok" data-c="${escapeHTML(c.id)}" data-i="${x.i}">✓ Réussie</button><button class="ko" data-act="ko" data-c="${escapeHTML(c.id)}" data-i="${x.i}">↻ Encore raté</button><button class="ghost" data-act="later" data-c="${escapeHTML(c.id)}" data-i="${x.i}">Demain</button><button class="ghost" data-act="note" data-c="${escapeHTML(c.id)}" data-i="${x.i}" aria-label="Ajouter une note">✎</button></div></article>`;}).join('')}</section>`;}).join('');
 }
 q('#duePanel').addEventListener('click',e=>{const b=e.target.closest('[data-act]');if(!b)return;const c=state.chapters.find(x=>x.id===b.dataset.c),i=Number(b.dataset.i);if(!c)return;
  ({ok:()=>review(c,i,true),ko:()=>review(c,i,false),later:()=>postpone(c,i),note:()=>openNote(c.id,i)})[b.dataset.act]();});

 /* ---------- détail du chapitre : liste des erreurs avec cause et note ---------- */
 function errorList(){
  const c=getChapter();if(!c)return;const bad=[];c.questions.forEach((s,i)=>{if(s==='bad')bad.push(i);});
  qa('.q').forEach(b=>{const e=c.info&&c.info[b.dataset.question];if(e&&(e.n||e.r)){b.classList.add('has-note');b.title+=` · ${[reasonLabel(e.r),e.n].filter(Boolean).join(' — ')}`;}});
  if(!bad.length)return;
  q('#detail').insertAdjacentHTML('beforeend',`<section class="err-list"><h3>À retravailler <span class="muted">${bad.length}</span></h3>${bad.map(i=>{const e=(c.info&&c.info[i])||{},d=dueOf(c,i);return `<div class="err-row"><div><b>${label(c,i)}</b>${e.r?`<span class="reason">${escapeHTML(reasonLabel(e.r))}</span>`:''}<span class="muted"> · révision ${dayText(d===null?today():d)}</span>${e.n?`<p>${escapeHTML(e.n)}</p>`:''}</div><button class="icon-btn" data-note="${i}" aria-label="Modifier la note">✎ Note</button></div>`;}).join('')}</section>`);
  qa('[data-note]').forEach(b=>b.onclick=()=>openNote(c.id,Number(b.dataset.note)));
 }
 renderDetail=function(){baseDetail.apply(this,arguments);errorList();};

 /* ---------- rendu global ---------- */
 function scopeList(){return state.chapters.filter(c=>subjectFilter==='Tous'||c.subject===subjectFilter);}
 function trainRender(){
  const t=today(),items=dueItems();
  q('#dueCount').textContent=items.length;
  const hd=q('#homeDue');if(hd){hd.hidden=!items.length;hd.textContent=`${items.length} question${items.length>1?'s':''} à revoir aujourd’hui ↗`;}
  q('#dueNav').classList.toggle('active',dueMode);q('#dueNav').setAttribute('aria-pressed',dueMode);
  q('#duePanel').hidden=!dueMode;q('.workspace').hidden=dueMode;
  q('#stale').hidden=true;q('#causes').hidden=true;
  if(dueMode){
   ['#allNav','#reviewNav'].forEach(s=>q(s).classList.remove('active'));qa('[data-subject]').forEach(b=>b.classList.remove('active'));
   q('#viewTitle').textContent='Révision du jour';q('#breadcrumb').textContent='Entraînement / Révision du jour';
   const sched=allScheduled(),late=items.filter(x=>x.due<t).length,conf=items.filter(x=>x.s==='good').length,week=sched.filter(x=>x.due>t&&x.due<=t+7).length;
   const tile=(cls,l,v,n)=>`<article class="stat ${cls}"><div class="stat-label">${l}</div><div class="stat-value">${v}</div><div class="stat-note">${n}</div></article>`;
   q('#stats').className='stats';q('#stats').innerHTML=tile('',"À revoir aujourd’hui",items.length,'')+tile('stat-bad','En retard',late,'')+tile('','À confirmer',conf,'réussies à revérifier')+tile('','Cette semaine',week,'à venir');
   q('#overall').textContent=`${items.length} à revoir · ${sched.length} planifiée${sched.length>1?'s':''}`;
   renderDue();return;
  }
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
 setView=function(){dueMode=false;return baseSetView.apply(this,arguments);};
 const openDue=()=>{dueMode=true;goStudy();render();};
 q('#dueNav').onclick=openDue;q('#mobileReview').onclick=openDue;q('#homeDue').onclick=openDue;
 render();
})();
