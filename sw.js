/* YAWMI v11: static shell cache only. Never cache auth, Supabase API or personal data. */
const CACHE='yawmi-v29-public-shell';
const STATIC=['index.html','auth.html','01_ATLAS_Executive.html','02_JOURNAL_Editorial.html','03_QUEST_RPG.html','cloud.js','yawmi-offline-v1.js','yawmi-seasons-v1.js','yawmi-seasons-v1.css','config.js','mobile-fix.css','yawmi-extras.js','yawmi-extras.css','yawmi-v15.css','yawmi-quran-typography-v16.css','yawmi-quran.js','yawmi-insights.js','yawmi-rank.js','yawmi-progress-v19.js','yawmi-progress-v19.css','yawmi-install-v22.js','yawmi-onboarding-v22.css','yawmi-features-v23.js','yawmi-features-v23.css','manifest.webmanifest','icon-192.png','icon-512.png'];
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
