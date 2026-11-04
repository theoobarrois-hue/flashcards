'use strict';
let installPrompt=null;
const standalone=()=>window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
function refreshInstallState(){document.body.classList.toggle('installed',standalone());}
refreshInstallState();
window.matchMedia('(display-mode: standalone)').addEventListener('change',refreshInstallState);
document.querySelectorAll('[data-install]').forEach(button=>button.onclick=()=>document.querySelector('#installDialog').showModal());
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;document.querySelector('#installNow').hidden=false;});
document.querySelector('#installNow').onclick=async()=>{
 if(!installPrompt)return;
 await installPrompt.prompt();const choice=await installPrompt.userChoice;
 installPrompt=null;document.querySelector('#installNow').hidden=true;
 if(choice.outcome==='accepted')document.querySelector('#installDialog').close();
};
window.addEventListener('appinstalled',()=>{refreshInstallState();document.querySelector('#installDialog').close();toast('Application installée.');});
document.querySelector('#mobileHome').onclick=()=>document.querySelector('#homeNav').click();
document.querySelector('#mobileStudy').onclick=()=>{setView('Tous');goStudy();};
document.querySelector('#mobileReview').onclick=()=>{setView('Tous',true);goStudy();};
document.querySelector('#mobileBackup').onclick=()=>document.querySelector('#dataDialog').showModal();
function showOfflineReady(){
 document.querySelector('#offlineMessage').textContent='Application prête hors connexion. Les modifications restent enregistrées sur cet appareil.';
 document.querySelector('#appAvailability').textContent=navigator.onLine?'Prête hors connexion':'Hors connexion · suivi disponible';
}
if('serviceWorker' in navigator&&window.isSecureContext){
 window.addEventListener('load',async()=>{
  try{
   const registration=await navigator.serviceWorker.register('./sw.js');
   navigator.serviceWorker.ready.then(()=>{showOfflineReady();window.addEventListener('online',showOfflineReady);window.addEventListener('offline',showOfflineReady);});
   function offerUpdate(){if(!registration.waiting)return;const box=document.querySelector('#appAvailability');box.textContent='Une mise à jour est disponible. ';const button=document.createElement('button');button.textContent='Mettre à jour';button.onclick=()=>{if(!persist())return;registration.waiting.postMessage({type:'ACTIVATE_UPDATE'});};box.append(button);}
   if(registration.waiting)offerUpdate();
   registration.addEventListener('updatefound',()=>{const worker=registration.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)offerUpdate();});});
   let reloading=false;
   navigator.serviceWorker.addEventListener('controllerchange',()=>{if(registration.active&&reloading)return;if(document.querySelector('#appAvailability button')){reloading=true;window.location.reload();}});
  }catch{
   document.querySelector('#offlineMessage').textContent='Le mode hors connexion n’a pas pu être préparé. Rouvre l’application avec une connexion.';
  }
 });
}else{
 document.querySelector('#offlineMessage').textContent='L’installation et le mode hors connexion nécessitent le lien HTTPS de l’application.';
}
// Request best-effort storage protection after an explicit Save gesture.
document.querySelector('#saveBtn').addEventListener('click',()=>{navigator.storage?.persist?.().catch(()=>{});});
