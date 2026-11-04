'use strict';
const $=s=>document.querySelector(s), KEY='cap-prepa-v1', labels={todo:'Non tentée',good:'Réussie',bad:'À retravailler'};
let state={version:1,chapters:[]},selected=null,subjectFilter='Tous',reviewOnly=false,questionFilter='all',editing=null,undo=null,toastTimer,quickAxis=1,pendingDelete=null,deletedChapter=null;
const subjects=['Maths','Physique','Chimie','Français','Autre'];
const isFrench=c=>c?.subject==='Français';
const units=c=>isFrench(c)?`${c.total/4} axes · ${c.total} arguments`:`${c.total} questions`;
const statusLabels=c=>isFrench(c)?{todo:'Non travaillé',good:'Maîtrisé',bad:'À retravailler'}:labels;
const escapeHTML=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function warn(s){$('#storageWarning').hidden=false;$('#storageWarning').textContent=s;$('#saveState').textContent='Sauvegarde indisponible';}
try{const raw=localStorage.getItem(KEY);if(raw)state=CP.validate(JSON.parse(raw));}catch(e){warn('La sauvegarde locale ne peut pas être chargée. Elle ne sera pas écrasée sans modification de ta part. Tu peux importer une sauvegarde JSON.');}
selected=state.chapters[0]?.id;
function toast(s){$('#toast').textContent=s;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),4000);}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(state));$('#saveState').textContent='Enregistré sur cet appareil';return true;}catch(e){warn('L’enregistrement sur cet appareil a échoué. Exporte une copie.');return false;}}
function commit(message,quiet=false){const previous=selected,scroll=$('.questions')?.scrollTop||0;const saved=persist();render();if(previous===selected&&$('.questions'))$('.questions').scrollTop=scroll;if(!quiet||!saved)toast(message+(saved?'':' · sauvegarde locale impossible'));}
function getChapter(){return state.chapters.find(c=>c.id===selected);}
function bar(c){const n=CP.counts(c);return `<div class="bar" aria-label="${n.good} validés, ${n.bad} à retravailler, ${n.todo} non travaillés"><i style="width:${n.good/c.total*100}%"></i><i class="bad" style="width:${n.bad/c.total*100}%"></i></div>`;}
function render(){const total=state.chapters.reduce((a,c)=>{const n=CP.counts(c);a.total+=c.total;for(const s of ['good','bad','todo'])a[s]+=n[s];return a;},{total:0,good:0,bad:0,todo:0});const pct=total.total?Math.round(100*total.good/total.total):0;
$('#stats').innerHTML=[[pct+' %','Progression globale',`${total.good} / ${total.total} éléments validés`],[total.good,'Validés',''],[total.bad,'À retravailler',''],[total.todo,'Non travaillés','']].map(([v,l,n])=>`<article class="stat ${l==='Validés'?'stat-good':l==='À retravailler'?'stat-bad':''}"><div class="stat-label">${l}</div><div class="stat-value">${v}</div><div class="stat-note">${n}</div></article>`).join('');
$('#navCount').textContent=total.bad;$('#allCount').textContent=state.chapters.length;$('#overall').textContent=`${total.good+total.bad} / ${total.total} éléments travaillés`;
$('#allNav').classList.toggle('active',!reviewOnly&&subjectFilter==='Tous');$('#reviewNav').classList.toggle('active',reviewOnly);
const view=reviewOnly?'À retravailler':subjectFilter==='Tous'?'Tous les chapitres':subjectFilter;
$('#viewTitle').textContent=view;$('#breadcrumb').textContent='Entraînement / '+view;
for(const [subject,id] of [['Maths','mathsCount'],['Physique','physicsCount'],['Chimie','chemCount'],['Français','frenchCount'],['Autre','otherCount']])$('#'+id).textContent=state.chapters.filter(c=>c.subject===subject).length;
document.querySelectorAll('[data-subject]').forEach(b=>b.classList.toggle('active',!reviewOnly&&b.dataset.subject===subjectFilter));
document.querySelectorAll('nav .nav').forEach(b=>b.setAttribute('aria-pressed',b.classList.contains('active')));
const query=$('#search').value.trim().toLocaleLowerCase('fr');
const visible=state.chapters.filter(c=>(subjectFilter==='Tous'||c.subject===subjectFilter)&&(!reviewOnly||CP.counts(c).bad>0)&&c.name.toLocaleLowerCase('fr').includes(query));
const sort=$('#sort').value;
visible.sort((a,b)=>sort==='review'?CP.counts(b).bad-CP.counts(a).bad||a.name.localeCompare(b.name,'fr',{numeric:true}):sort==='progress'?CP.counts(a).good/a.total-CP.counts(b).good/b.total||a.name.localeCompare(b.name,'fr',{numeric:true}):a.name.localeCompare(b.name,'fr',{numeric:true}));
if(!visible.some(c=>c.id===selected))selected=visible[0]?.id;
$('#chapterCount').textContent=visible.length;
const card=c=>{const n=CP.counts(c);return `<button class="chapter ${selected===c.id?'selected':''}" data-id="${escapeHTML(c.id)}" aria-pressed="${selected===c.id}"><div class="card-title"><h3>${escapeHTML(c.name)}</h3><span aria-hidden="true">›</span></div><div class="progress-label"><span>${units(c)}</span><b>${Math.round(n.good/c.total*100)} %</b></div>${bar(c)}<div class="card-foot"><span class="good-text">✓ ${n.good}</span><span class="bad-text">↻ ${n.bad}</span><span>○ ${n.todo}</span></div></button>`;};
$('#chapters').innerHTML=visible.length?(sort==='name'?subjects.map(subject=>{const group=visible.filter(c=>c.subject===subject);return group.length?`<section class="chapter-group"><h3 class="group-label">${subject}<span>${group.length}</span></h3>${group.map(card).join('')}</section>`:'';}).join(''):visible.map(c=>`<div class="sorted-chapter"><span class="sort-subject">${c.subject}</span>${card(c)}</div>`).join('')):`<div class="empty"><h3>${reviewOnly?'Aucun chapitre à retravailler':state.chapters.length?'Aucun résultat':'Aucun chapitre'}</h3>${state.chapters.length?'':'<button class="secondary" id="emptyExamples">Ajouter les exemples</button>'}</div>`;
$('#emptyExamples')?.addEventListener('click',examples);
document.querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>{selected=b.dataset.id;quickAxis=1;questionFilter=reviewOnly?'bad':'all';render();if(window.matchMedia('(max-width: 760px)').matches)$('#detail').scrollIntoView({behavior:'smooth',block:'start'});});renderDetail();renderHome();}
function renderDetail(){
 const c=getChapter();if(!c){$('#detail').innerHTML='<div class="empty"><h3>Aucun chapitre sélectionné</h3></div>';return;}
 const n=CP.counts(c), french=isFrench(c), sl=statusLabels(c);quickAxis=Math.min(quickAxis,french?c.total/4:1);
 const cell=(s,i)=>`<button class="q ${s}" data-question="${i}" title="${french?`Axe ${Math.floor(i/4)+1}, argument ${i%4+1}`:`Question ${i+1}`} · ${sl[s]}" aria-label="${french?`Axe ${Math.floor(i/4)+1}, argument ${i%4+1}`:`Question ${i+1}`}, ${sl[s]}">${french?`<span class="arg-label">Argument</span>${i%4+1}`:i+1}<span class="q-mark" aria-hidden="true">${s==='good'?'✓':s==='bad'?'↻':''}</span></button>`;
 let grid='';
 if(french){for(let axis=0;axis<c.total/4;axis++){const values=c.questions.slice(axis*4,axis*4+4);if(questionFilter!=='all'&&!values.includes(questionFilter))continue;grid+=`<section class="axis-block"><div class="axis-heading"><h3>Axe ${axis+1}</h3><span>${values.filter(s=>s==='good').length} / 4 maîtrisés</span></div><div class="axis-arguments">${values.map((s,j)=>questionFilter==='all'||questionFilter===s?cell(s,axis*4+j):`<div class="arg-placeholder" aria-label="Argument ${j+1} masqué par le filtre">${j+1}</div>`).join('')}</div></section>`;}}
 else grid=c.questions.map((s,i)=>questionFilter==='all'||questionFilter===s?cell(s,i):'').join('');
 $('#detail').innerHTML=`<button class="back-list" id="backList">← Liste des chapitres</button><div class="detail-top"><span class="badge ${c.subject==='Chimie'?'chem':french?'french':''}">${c.subject}</span><div class="detail-actions"><button class="icon-btn" id="editBtn">Modifier</button><button class="icon-btn" id="deleteBtn">Supprimer</button></div></div><h2>${escapeHTML(c.name)}</h2><div class="chapter-summary">${units(c)} <span>·</span> ${Math.round(n.good/c.total*100)} % ${french?'maîtrisés':'réussies'}</div>
 <form class="quick" id="quickForm"><h3>Saisie rapide</h3>${french?`<select id="quickAxis" aria-label="Axe à mettre à jour">${Array.from({length:c.total/4},(_,i)=>`<option value="${i+1}" ${quickAxis===i+1?'selected':''}>Axe ${i+1}</option>`).join('')}</select>`:''}<input id="numbers" aria-label="${french?'Numéros des arguments':'Numéros des questions'}" placeholder="${french?'Arguments : 1, 3-4':'Ex. 2, 5, 8-12'}" autocomplete="off" required><div class="quick-row"><select id="status" aria-label="Nouveau statut"><option value="bad">↻ À retravailler</option><option value="good">✓ ${french?'Maîtrisés':'Réussies'}</option><option value="todo">○ ${french?'Non travaillés':'Non tentées'}</option></select><button class="primary">Appliquer</button></div><div id="quickError" class="error" role="alert"></div>${undo&&undo.id===c.id?'<button class="subtle" type="button" id="undoBtn">↶ Annuler la dernière modification</button>':''}</form>
 <div class="grid-head"><strong>${french?'Axes et arguments':'Questions'}</strong><span class="muted">Cliquer pour changer le statut</span></div><div class="question-filters" role="group" aria-label="${french?'Filtrer les arguments':'Filtrer les questions'}">${[['all',french?'Tous':'Toutes',c.total],['todo',french?'Non travaillés':'Non tentées',n.todo],['bad','À retravailler',n.bad],['good',french?'Maîtrisés':'Réussies',n.good]].map(([key,label,count])=>`<button class="filter ${key} ${questionFilter===key?'active':''}" data-filter="${key}" aria-pressed="${questionFilter===key}">${label} <b>${count}</b></button>`).join('')}</div><div class="questions ${french?'axes-grid':''}">${grid||`<p class="muted">${french?'Aucun argument':'Aucune question'} dans ce statut.</p>`}</div>`;
 document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{questionFilter=b.dataset.filter;renderDetail();document.querySelector(`[data-filter="${questionFilter}"]`)?.focus({preventScroll:true});});
 $('#backList').onclick=()=>$('.chapter-panel').scrollIntoView({behavior:'smooth',block:'start'});$('#editBtn').onclick=()=>openForm(c);
 $('#deleteBtn').onclick=()=>{pendingDelete=c.id;$('#deleteDescription').textContent=`« ${c.name} » (${units(c)}) sera retiré de ton suivi.`;$('#deleteDialog').showModal();$('#cancelDelete').focus();};
 if(french)$('#quickAxis').onchange=e=>{quickAxis=Number(e.target.value);};
 $('#quickForm').onsubmit=e=>{e.preventDefault();try{const nums=CP.parseQuestions($('#numbers').value,french?4:c.total);const offset=french?(quickAxis-1)*4:0;undo={id:c.id,questions:[...c.questions]};const s=$('#status').value;nums.forEach(i=>c.questions[offset+i-1]=s);commit(`${nums.length} ${french?'argument(s)':'question(s)'} mis à jour.`);$('#numbers')?.focus({preventScroll:true});}catch(err){$('#quickError').textContent=french?err.message.replace('numéro de question','numéro d’argument'):err.message;}};
 $('#undoBtn')?.addEventListener('click',()=>{c.questions=undo.questions;undo=null;commit('Dernière modification annulée.');});
 document.querySelectorAll('[data-question]').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.question);undo={id:c.id,questions:[...c.questions]};c.questions[i]={todo:'bad',bad:'good',good:'todo'}[c.questions[i]];commit('Statut enregistré.',true);document.querySelector(`[data-question="${i}"]`)?.focus({preventScroll:true});});
}
function updateFormLabels(){const french=$('#subject').value==='Français';$('#totalLabel').textContent=french?'Nombre d’axes':'Nombre de questions';$('#total').max=french?'500':'2000';$('#nameLabel').textContent=french?'Thème ou œuvre':'Nom du chapitre';$('#name').placeholder=french?'Ex. La nature et l’expérience':'Ex. Mécanique';$('#formHint').textContent=french?'4 arguments par axe. Tous commencent « non travaillé ».':'Toutes les nouvelles questions commencent « non tentée ».';}
function openForm(c){editing=c?.id||null;$('#formTitle').textContent=c?'Modifier le chapitre':'Nouveau chapitre';$('#name').value=c?.name||'';$('#subject').value=c?.subject||(subjectFilter!=='Tous'?subjectFilter:'Chimie');$('#total').value=c?(isFrench(c)?c.total/4:c.total):($('#subject').value==='Français'?3:62);updateFormLabels();$('#formError').textContent='';$('#chapterDialog').showModal();$('#name').focus();}
$('#subject').onchange=()=>{const c=state.chapters.find(x=>x.id===editing);$('#total').value=c&&c.subject===$('#subject').value?(isFrench(c)?c.total/4:c.total):($('#subject').value==='Français'?3:62);updateFormLabels();};
$('#chapterForm').onsubmit=e=>{
 e.preventDefault();const name=$('#name').value.trim(),amount=Number($('#total').value),subject=$('#subject').value,french=subject==='Français',total=amount*(french?4:1);
 if(!name||!Number.isInteger(amount)||amount<1||total>2000){$('#formError').textContent=`Indique un nom et un nombre entier entre 1 et ${french?500:2000}.`;return;}
 let c=state.chapters.find(x=>x.id===editing);
 if(c){const changedFormat=isFrench(c)!==french;
 if(changedFormat&&c.questions.some(s=>s!=='todo')&&!confirm('Changer entre questions et axes réinitialisera les statuts de ce chapitre. Continuer ?'))return;
 if(!changedFormat&&total<c.total&&!confirm(french?`Réduire à ${amount} axes supprimera les axes ${amount+1} à ${c.total/4} et leurs arguments. Continuer ?`:`Réduire à ${total} questions supprimera le suivi des questions ${total+1} à ${c.total}. Continuer ?`))return;
 c.questions=Array.from({length:total},(_,i)=>changedFormat?'todo':c.questions[i]||'todo');c.name=name;c.subject=subject;c.total=total;undo=null;
 }else{if(state.chapters.length>=500){$('#formError').textContent='La limite de 500 chapitres est atteinte.';return;}c={id:crypto.randomUUID(),name,subject,total,questions:Array(total).fill('todo')};state.chapters.push(c);}
 selected=c.id;subjectFilter=subject;reviewOnly=false;questionFilter='all';quickAxis=1;$('#search').value='';$('#chapterDialog').close();commit('Chapitre enregistré.');
};
function examples(){const items=[['Chimie organique · ORG1 à ORG6','Chimie',62],['Fonctions','Maths',80]];let added=0;for(const [name,subject,total] of items)if(!state.chapters.some(c=>c.name===name)){state.chapters.push({id:crypto.randomUUID(),name,subject,total,questions:Array(total).fill('todo')});added++;}$('#helpDialog').close();commit(added?'Exemples ajoutés : toutes les questions sont non tentées.':'Les exemples sont déjà présents.');}
$('#addBtn').onclick=()=>openForm();$('#examplesBtn').onclick=examples;$('#helpBtn').onclick=()=>$('#helpDialog').showModal();$('#dataBtn').onclick=()=>$('#dataDialog').showModal();document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$('#'+b.dataset.close).close());$('#search').oninput=render;$('#sort').onchange=render;
function setView(subject,review=false){subjectFilter=subject;reviewOnly=review;questionFilter=review?'bad':'all';$('#search').value='';render();}
document.querySelectorAll('[data-subject]').forEach(b=>b.onclick=()=>setView(b.dataset.subject));$('#allNav').onclick=()=>setView('Tous');$('#reviewNav').onclick=()=>setView('Tous',true);
$('#exportBtn').onclick=()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`cap-prepa-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Sauvegarde exportée.');};$('#importBtn').onclick=()=>$('#importFile').click();$('#importFile').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>10*1024*1024)throw Error('Fichier trop volumineux (10 Mo maximum).');const data=CP.validate(JSON.parse(await file.text()));if(state.chapters.length&&!confirm(`Remplacer le suivi actuel par les ${data.chapters.length} chapitres de cette sauvegarde ? Exporte d’abord le suivi actuel si tu veux le conserver.`))return;deletedChapter=null;$('#deleteNotice').hidden=true;state=data;selected=state.chapters[0]?.id;undo=null;$('#dataDialog').close();setView('Tous');commit('Sauvegarde importée.');}catch(err){alert('Import impossible : '+err.message);}finally{e.target.value='';}};
window.addEventListener('storage',e=>{if(e.key===KEY&&e.newValue){try{state=CP.validate(JSON.parse(e.newValue));undo=null;deletedChapter=null;$('#deleteNotice').hidden=true;render();toast('Suivi actualisé depuis un autre onglet.');}catch{warn('Une modification dans un autre onglet est invalide.');}}});render();applyRoute();

function renderHome(){
 $('#homeTotal').textContent=`${state.chapters.length} chapitre${state.chapters.length>1?'s':''}`;
 $('#homeSubjects').innerHTML=['Maths','Physique','Chimie','Français'].map((subject,i)=>{const list=state.chapters.filter(c=>c.subject===subject),count=list.length;return `<button class="home-subject" data-home-subject="${subject}"><span class="home-subject-number">0${i+1}</span><span class="home-subject-name">${subject}</span><span class="home-subject-count">${count} chapitre${count>1?'s':''}${subject==='Français'?' · Axes & arguments':''}</span><span class="home-subject-arrow">↗</span></button>`;}).join('');
 document.querySelectorAll('[data-home-subject]').forEach(b=>b.onclick=()=>{setView(b.dataset.homeSubject);goStudy();});
}
function applyRoute(){document.body.classList.toggle('home-mode',location.hash!=='#suivi');}
function goStudy(){location.hash='suivi';applyRoute();window.scrollTo(0,0);}
$('#enterBtn').onclick=goStudy;$('#homeNav').onclick=()=>{location.hash='accueil';applyRoute();window.scrollTo(0,0);};window.addEventListener('hashchange',applyRoute);
$('#homeBackup').onclick=()=>$('#dataDialog').showModal();$('#homeExport').onclick=()=>$('#exportBtn').click();
$('#saveBtn').onclick=()=>{if(persist())toast('Suivi enregistré sur cet appareil.');else toast('Enregistrement impossible. Exporte une copie.');};

$('#cancelDelete').onclick=()=>$('#deleteDialog').close();
$('#deleteDialog').addEventListener('close',()=>{pendingDelete=null;});
$('#confirmDelete').onclick=()=>{
 const index=state.chapters.findIndex(c=>c.id===pendingDelete);
 if(index===-1){$('#deleteDialog').close();return;}
 const chapter=state.chapters[index];deletedChapter={chapter:JSON.parse(JSON.stringify(chapter)),index};
 state.chapters.splice(index,1);undo=null;$('#deleteDialog').close();commit('Chapitre supprimé.',true);
 $('#deleteNoticeText').textContent=`« ${chapter.name} » supprimé.`;$('#deleteNotice').hidden=false;$('#restoreChapter').focus({preventScroll:true});
};
$('#restoreChapter').onclick=()=>{
 if(!deletedChapter)return;
 if(state.chapters.length>=500){toast('Limite de 500 chapitres atteinte.');return;}
 const {chapter,index}=deletedChapter;
 if(state.chapters.some(c=>c.id===chapter.id)){toast('Ce chapitre est déjà présent.');return;}
 state.chapters.splice(Math.min(index,state.chapters.length),0,chapter);selected=chapter.id;subjectFilter=chapter.subject;reviewOnly=false;questionFilter='all';$('#search').value='';
 deletedChapter=null;$('#deleteNotice').hidden=true;commit('Chapitre restauré.');$('#editBtn')?.focus({preventScroll:true});
};
$('#dismissDelete').onclick=()=>{deletedChapter=null;$('#deleteNotice').hidden=true;};
