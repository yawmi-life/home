/* YAWMI V23 — show installation UI only when installation is not confirmed. */
(()=>{'use strict';
let deferredPrompt=null,installedThisVisit=false,relatedInstalled=false,checkInFlight=null;
const standalone=()=>Boolean(window.matchMedia?.('(display-mode: standalone)').matches||navigator.standalone===true);
const installed=()=>standalone()||installedThisVisit||relatedInstalled;
const setVisible=(id,show)=>{const el=document.getElementById(id);if(!el)return;el.hidden=!show;};
const platformHelp=()=>{
 const ua=navigator.userAgent||'';
 if(/iPad|iPhone|iPod/i.test(ua))return 'على iPhone: افتح قائمة مشاركة المتصفح، ثم اختر «إضافة إلى الشاشة الرئيسية» وأكد الإضافة.';
 if(/Android/i.test(ua))return 'على أندرويد: افتح يومي في Chrome، ثم ⋮ ثم «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».';
 return 'في Chrome أو Edge على الكمبيوتر، اختر «تثبيت» من شريط العنوان أو قائمة المتصفح.';
};
function refresh(){
 const show=!installed();
 setVisible('ymAuthInstallBox',show);
 setVisible('ymAuthInstall',show);
 setVisible('ymAuthInstallHelp',show&&!!document.getElementById('ymAuthInstallHelp')?.textContent);
 setVisible('yLandingInstallBox',show);
 setVisible('yLandingInstall',show);
 setVisible('yLandingInstallHelp',show&&!!document.getElementById('yLandingInstallHelp')?.textContent);
 document.querySelectorAll('[data-yam-action="install"]').forEach(el=>el.hidden=!show);
 setVisible('installBtn',show&&!!deferredPrompt);
}
async function checkInstalled(){
 if(installed())return refresh();
 if(typeof navigator.getInstalledRelatedApps!=='function')return refresh();
 if(checkInFlight)return checkInFlight;
 checkInFlight=Promise.resolve().then(()=>navigator.getInstalledRelatedApps()).then(apps=>{
   relatedInstalled=Array.isArray(apps)&&apps.some(app=>app.platform==='webapp'&&(String(app.url||'').includes('/home/manifest.webmanifest')||String(app.id||'').includes('/home/index.html')));
 }).catch(()=>{}).finally(()=>{checkInFlight=null;refresh();});
 return checkInFlight;
}
function hint(id,text){const el=document.getElementById(id);if(el){el.textContent=text;el.hidden=false;}}
function install(helpId){
 if(installed())return refresh();
 if(deferredPrompt){
  const prompt=deferredPrompt;deferredPrompt=null;
  try{
   const result=prompt.prompt();Promise.resolve(result).then(()=>prompt.userChoice).then(choice=>{
    if(choice?.outcome==='accepted')hint(helpId,'تم قبول طلب التثبيت. ستجد التطبيق في شاشة التطبيقات بعد اكتمال التثبيت.');
    else hint(helpId,platformHelp());
  }).catch(()=>hint(helpId,platformHelp())).finally(()=>{refresh();checkInstalled()});
  }catch(_){hint(helpId,platformHelp());}
 }else hint(helpId,platformHelp());
}
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;checkInstalled();refresh();});
window.addEventListener('appinstalled',()=>{installedThisVisit=true;deferredPrompt=null;refresh();});
window.addEventListener('pageshow',()=>checkInstalled());
try{window.matchMedia?.('(display-mode: standalone)').addEventListener?.('change',()=>checkInstalled())}catch(_){}
window.YawmiInstall={install,standalone,installed,refresh,checkInstalled,sync:refresh};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{refresh();checkInstalled()});
else{refresh();checkInstalled()}
})();