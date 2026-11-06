/* YAWMI v11: static shell cache only. Never cache auth, Supabase API or personal data. */
const CACHE='yawmi-v38-public-shell-live-auto-updates';
const STATIC=['index.html','auth.html','01_ATLAS_Executive.html','02_JOURNAL_Editorial.html','03_QUEST_RPG.html','cloud.js','yawmi-offline-v1.js','yawmi-seasons-v1.js','yawmi-seasons-v1.css','yawmi-habit-insights-v30.js','yawmi-habit-insights-v30.css','yawmi-friend-challenges-v30.js','yawmi-friend-challenges-v30.css','config.js','mobile-fix.css','yawmi-extras.js','yawmi-extras.css','yawmi-book-discovery-v31.js','yawmi-book-discovery-v31.css','yawmi-google-calendar-v35.js','yawmi-push-v35.js','yawmi-money-v32.js','yawmi-money-v32.css','yawmi-diary-v32.js','yawmi-diary-v32.css','yawmi-life-core-v33.js','yawmi-life-growth-v33.js','yawmi-life-privacy-v33.js','yawmi-life-v33.css','yawmi-life-v36.js','yawmi-life-v36.css','yawmi-push-actions-v37.js','yawmi-v35.css','yawmi-navigation-v34.js','yawmi-v34.css','yawmi-v15.css','yawmi-quran-typography-v16.css','yawmi-quran.js','yawmi-insights.js','yawmi-rank.js','yawmi-progress-v19.js','yawmi-progress-v19.css','yawmi-install-v22.js','yawmi-onboarding-v22.css','yawmi-features-v23.js','yawmi-features-v23.css','manifest.webmanifest','site-version.json','yawmi-live-update-v1.js','yawmi-widgets-v1.js','yawmi-native-widgets-v1.js','icon-192.png','icon-512.png'];
const PUBLIC_SDK='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/dist/umd/supabase.min.js';
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(async cache=>{
 await cache.addAll(STATIC.map(s=>'./'+s));
 // The public Supabase browser SDK is static code; auth requests and account data are never cached.
 try{const request=new Request(PUBLIC_SDK,{mode:'no-cors'});const response=await fetch(request);
 if(response.ok||response.type==='opaque')await cache.put(request,response)}catch(_){}
}).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
 const req=e.request;
 if(req.method!=='GET') return;
 const url=new URL(req.url);
 if(url.origin!==self.location.origin){
  if(url.href===PUBLIC_SDK){
   e.respondWith(fetch(req).then(response=>{
    if(response.ok||response.type==='opaque')caches.open(CACHE).then(cache=>cache.put(req,response.clone())).catch(()=>{});
    return response;
   }).catch(()=>caches.match(req).then(r=>r||Response.error())));
  }
  return;
 }
 const basename=url.pathname.split('/').pop()||'index.html';
 if(req.mode==='navigate'){
   e.respondWith(fetch(req).catch(()=>caches.match('./'+basename).then(r=>r||caches.match('./index.html'))));
 }else if(STATIC.includes(basename)){
   e.respondWith(fetch(req).then(r=>{if(r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put(req,copy));}return r}).catch(()=>caches.match(req)));
 }
});

/* Server-originated Web Push: works with no open page; notification contents intentionally generic. */
self.addEventListener('push',event=>{
 let msg={};try{msg=event.data?event.data.json():{}}catch(_){}
 const title=String(msg.title||'تذكير من يومي').slice(0,70);
 const body=String(msg.body||'افتح التقويم لمراجعة التذكير.').slice(0,150);
 // Only a technical record key is carried; private titles/finance data never leave the server.
 const key=String(msg.notification_key||'').slice(0,240);
 const canAct=/^(?:snooze:)?(?:calendar|reminder):/.test(key);
 event.waitUntil(self.registration.showNotification(title,{
  body,icon:'./icon-192.png',badge:'./icon-192.png',
  tag:'yawmi-'+(key||'background-reminder'),renotify:true,
  data:{url:'./?source=push&quick=calendar',key},
  actions:canAct?[{action:'done',title:'تم'},{action:'snooze10',title:'بعد 10 دقائق'},{action:'tomorrow',title:'بكرة'}]:
   [{action:'open',title:'فتح التقويم'}]
 }));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 event.waitUntil((async()=>{
  const target=new URL('./?source=push&quick=calendar',self.registration.scope);
  const action=event.action;
  if(['done','snooze10','tomorrow'].includes(action)&&event.notification.data?.key){
   target.searchParams.set('push_action',action);
   target.searchParams.set('push_key',String(event.notification.data.key).slice(0,240));
  }
  const dest=target.href;
  const all=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  for(const client of all){
   if(new URL(client.url).origin===new URL(dest).origin){
    try{await client.navigate(dest);await client.focus();return}catch(_){}
   }
  }
  if(self.clients.openWindow)await self.clients.openWindow(dest);
 })());
});
