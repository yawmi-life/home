/* YAWMI v11: static shell cache only. Never cache auth, Supabase API or personal data. */
const CACHE='yawmi-v14-public-shell';
const STATIC=['index.html','auth.html','01_ATLAS_Executive.html','02_JOURNAL_Editorial.html','03_QUEST_RPG.html','cloud.js','config.js','mobile-fix.css','yawmi-extras.js','yawmi-extras.css','manifest.webmanifest','icon-192.png','icon-512.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(STATIC.map(s=>'./'+s))).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
 const req=e.request;
 if(req.method!=='GET') return;
 const url=new URL(req.url);
 if(url.origin!==self.location.origin) return;
 const basename=url.pathname.split('/').pop()||'index.html';
 if(req.mode==='navigate'){
   e.respondWith(fetch(req).catch(()=>caches.match('./'+basename).then(r=>r||caches.match('./index.html'))));
 }else if(STATIC.includes(basename)){
   e.respondWith(fetch(req).then(r=>{if(r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put(req,copy));}return r}).catch(()=>caches.match(req)));
 }
});
