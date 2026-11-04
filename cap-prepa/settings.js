'use strict';
/* Cap Prépa — Réglages : compte et synchronisation, mises à jour, données. */
(function(){
 const SQL=`-- À coller UNE FOIS dans Supabase › SQL Editor › New query › Run  (même projet que Flashcards)
create table if not exists public.capprepa_chapters (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id      text not null,
  data    jsonb,
  ts      bigint not null,
  del     boolean not null default false,
  seq     bigint not null default 0,
  primary key (user_id, id)
);
create sequence if not exists public.capprepa_seq;
create index if not exists capprepa_seq_idx on public.capprepa_chapters (user_id, seq);

create or replace function public.capprepa_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.ts <= old.ts then return null; end if;  -- la modif la plus récente gagne
  new.seq := nextval('public.capprepa_seq');
  return new;
end $$;

drop trigger if exists capprepa_guard on public.capprepa_chapters;
create trigger capprepa_guard before insert or update on public.capprepa_chapters
  for each row execute function public.capprepa_guard();

alter table public.capprepa_chapters enable row level security;
drop policy if exists "mes chapitres" on public.capprepa_chapters;
create policy "mes chapitres" on public.capprepa_chapters for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.capprepa_chapters to authenticated;
grant usage, select on sequence public.capprepa_seq to authenticated;
`;
 const q=s=>document.querySelector(s), APP=window.CP_APP||{version:'?',build:''};
 const native=typeof NATIVE!=='undefined'&&NATIVE;
 /* le suivi sauvegardé localement déclenche la synchro */
 const basePersist=persist;window.__cpPersist=basePersist;
 persist=function(){const ok=basePersist.apply(this,arguments);if(window.CPSync)CPSync.changed();return ok;};

 const dlg=q('#settingsDialog');
 const open=()=>{refresh();dlg.showModal();};
 ['#dataBtn','#homeBackup','#mobileBackup','#syncChip'].forEach(s=>{const el=q(s);if(el)el.onclick=open;});
 q('#setExport').onclick=()=>q('#exportBtn').click();
 q('#setImport').onclick=()=>{dlg.close();q('#importBtn').click();};
 q('#setHelp').onclick=()=>{dlg.close();q('#helpDialog').showModal();};
 q('#verInfo').textContent=`Cap Prépa · version ${APP.version}${APP.build?' · '+APP.build:''}`;

 /* ---------- compte / synchro ---------- */
 const fmt=t=>t?new Date(t).toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'jamais';
 const hm=t=>new Date(t).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
 function refresh(){
  const u=CPSync.user(),st=CPSync.status;
  q('#syncOut').hidden=!!u;q('#syncIn').hidden=!u;
  if(u){q('#syncUser').textContent=u.email;
   const pend=CPSync.pendingCount();
   q('#syncInfo').textContent=st.state==='error'||st.state==='offline'?st.msg:st.state==='sync'?'Synchronisation en cours…':`Dernière synchronisation : ${fmt(CPSync.lastSync())}`+(pend?` · ${pend} modification${pend>1?'s':''} en attente`:'');
   q('#syncInfo').classList.toggle('error',st.state==='error');
   q('#sqlHelp').hidden=!(st.state==='error'&&/Table manquante/.test(st.msg));}
  const chip=q('#syncChip'),dot=q('#navSync');
  const label=!u?'Synchro désactivée':st.state==='sync'?'Synchronisation…':st.state==='error'?'Synchro en échec':st.state==='offline'?'Hors connexion':CPSync.lastSync()?'Synchronisé · '+hm(CPSync.lastSync()):'Connecté';
  if(chip){chip.textContent=label;chip.dataset.state=!u?'off':st.state;}
  if(dot)dot.dataset.state=!u?'off':st.state;
  const btn=q('#syncNow');if(btn)btn.disabled=st.state==='sync';
 }
 CPSync.onStatus(refresh);refresh();setInterval(()=>{if(CPSync.user())refresh();},30000);

 const busy=(on)=>{['#syncLogin','#syncSignup'].forEach(s=>q(s).disabled=on);};
 async function auth(kind){
  const email=q('#syncEmail').value.trim(),pass=q('#syncPass').value;q('#syncError').textContent='';
  if(!email||pass.length<6){q('#syncError').textContent='Renseigne ton email et un mot de passe (6 caractères minimum).';return;}
  busy(true);
  try{
   if(kind==='up'){const r=await CPSync.signUp(email,pass);if(!r.ok){q('#syncError').textContent='Compte créé : ouvre le mail de confirmation, puis connecte-toi.';return;}}
   else await CPSync.signIn(email,pass);
   q('#syncPass').value='';toast('Connecté. Synchronisation en cours…');refresh();
  }catch(e){q('#syncError').textContent=e.message||'Connexion impossible.';}
  finally{busy(false);}
 }
 q('#syncForm').onsubmit=e=>{e.preventDefault();auth('in');};
 q('#syncSignup').onclick=()=>auth('up');
 q('#syncNow').onclick=()=>{CPSync.now().then(()=>{refresh();if(CPSync.status.state==='idle')toast('Synchronisé.');});};
 q('#sqlCopy').onclick=async()=>{
  const b=q('#sqlCopy');
  try{await navigator.clipboard.writeText(SQL);}
  catch(e){const t=document.createElement('textarea');t.value=SQL;t.style.cssText='position:fixed;opacity:0';document.body.append(t);t.select();try{document.execCommand('copy');}catch(x){}t.remove();}
  b.textContent='Code copié ✓';setTimeout(()=>b.textContent='Copier le code',3000);
 };
 q('#syncLogout').onclick=()=>{if(!confirm('Se déconnecter ? Ton suivi reste sur cet appareil.'))return;CPSync.signOut();refresh();toast('Déconnecté.');};

 /* ---------- mises à jour ---------- */
 const info=q('#updInfo');
 function swReady(){return !native&&'serviceWorker' in navigator&&window.isSecureContext;}
 async function showWaiting(reg){
  info.textContent='Une mise à jour est prête.';
  const b=q('#updCheck');b.textContent='Installer et redémarrer';b.dataset.mode='apply';
  b.onclick=()=>{persist();let done=false;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(!done){done=true;location.reload();}});reg.waiting.postMessage({type:'ACTIVATE_UPDATE'});setTimeout(()=>location.reload(),2500);};
 }
 function resetCheck(){const b=q('#updCheck');b.textContent='Rechercher une mise à jour';b.dataset.mode='';b.onclick=check;}
 async function check(){
  if(!swReady()){info.textContent=native?'Cette version est mise à jour avec l’application Mac.':'Les mises à jour nécessitent le lien HTTPS de l’application.';return;}
  const b=q('#updCheck');b.disabled=true;info.textContent='Recherche en cours…';
  try{
   const reg=await navigator.serviceWorker.getRegistration();
   if(!reg){info.textContent='Application non installée hors connexion. Utilise « Forcer l’actualisation ».';return;}
   await reg.update();
   if(!reg.waiting&&reg.installing){await new Promise(res=>{const w=reg.installing;w.addEventListener('statechange',()=>{if(w.state==='installed'||w.state==='redundant')res();});setTimeout(res,8000);});}
   if(reg.waiting){showWaiting(reg);}
   else{info.textContent=`Tu as la dernière version (${APP.version}). Vérifié à ${hm(Date.now())}.`;try{localStorage.setItem('cp-upd-check',String(Date.now()));}catch(e){}}
  }catch(e){info.textContent=navigator.onLine?'Vérification impossible pour le moment.':'Hors connexion : réessaie avec du réseau.';}
  finally{b.disabled=false;}
 }
 resetCheck();
 q('#updForce').onclick=async()=>{
  if(!confirm('Recharger l’application avec la dernière version ? Ton suivi n’est pas effacé.'))return;
  persist();
  try{const regs=await navigator.serviceWorker?.getRegistrations?.()||[];await Promise.all(regs.map(r=>r.unregister()));}catch(e){}
  try{for(const k of await caches.keys())await caches.delete(k);}catch(e){}
  location.reload();
 };
 if(!swReady()){q('#updForce').hidden=true;info.textContent=native?'Cette version est mise à jour avec l’application Mac.':'';}
 else{info.textContent=`Version ${APP.version}.`;}
 /* recherche silencieuse au lancement */
 if(swReady())navigator.serviceWorker.getRegistration().then(r=>r&&r.update().catch(()=>{}));
})();

