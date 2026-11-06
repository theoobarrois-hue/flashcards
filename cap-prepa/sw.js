'use strict';
const CACHE='cap-prepa-shell-v8';
const FILES=['./index.html','./style.css','./config.js','./core.js','./app.js','./install.js','./sync.js','./settings.js','./train.js','./theme.css','./fonts/dm-sans-latin-wght-normal.woff2','./fonts/fraunces-latin-wght-normal.woff2','./fonts/fraunces-latin-wght-italic.woff2','./manifest.webmanifest','./icons/logo2-192.png','./icons/logo2-512.png','./icons/logo2-touch.png'];
self.addEventListener('install',event=>{event.waitUntil((async()=>{
 const entries=await Promise.all(FILES.map(async path=>{
  const url=new URL(path,self.registration.scope);
  const response=await fetch(url,{cache:'reload',credentials:'same-origin'});
  if(!response.ok||new URL(response.url).origin!==url.origin)throw new Error('App shell unavailable');
  if(path.endsWith('index.html')&&!(await response.clone().text()).includes('id="homePage"'))throw new Error('Unexpected document');
  if(path.endsWith('.js')&&!/javascript/.test(response.headers.get('content-type')||''))throw new Error('Unexpected script');
  return [url.href,response];
 }));
 const cache=await caches.open(CACHE);
 await Promise.all(entries.map(([url,response])=>cache.put(url,response)));
})());});
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 for(const name of await caches.keys())if(name.startsWith('cap-prepa-shell-')&&name!==CACHE)await caches.delete(name);
 await self.clients.claim();
})()));
self.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE_UPDATE')self.skipWaiting();});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url),scope=new URL(self.registration.scope);
 if(request.method!=='GET'||url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname))return;
 const relative=url.pathname.slice(scope.pathname.length);
 const appNavigation=request.mode==='navigate'&&(relative===''||relative==='index.html');
 const asset=FILES.some(path=>path.slice(2)===relative);
 if(!appNavigation&&!asset)return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE),target=appNavigation?new URL('index.html',scope).href:request;
  const cached=await cache.match(target);
  return cached||fetch(request);
 })());
});
