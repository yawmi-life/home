/* YAWMI V22 — PWA install available before authentication and on the landing page. */
(()=>{'use strict';
let deferredPrompt=null;
const standalone=()=>Boolean(window.matchMedia?.('(display-mode: standalone)').matches||navigator.standalone===true);
const platformHelp=()=>{
 if(standalone())return 'التطبيق مثبت بالفعل. افتح «يومي» من شاشة التطبيقات.';
 const ua=navigator.userAgent||'';
 if(/iPad|iPhone|iPod/i.test(ua))return 'على iPhone: افتح القائمة «مشاركة» من Safari أو متصفحك، ثم اختر «إضافة إلى الشاشة الرئيسية» وأكّد «إضافة».';
 if(/Android/i.test(ua))return 'على أندرويد: افتح رابط يومي في Chrome ثم ⋮ واختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».';
 return 'من Chrome أو Edge على الكمبيوتر: استخدم زر «تثبيت التطبيق» في شريط العنوان أو من قائمة المتصفح. ويمكنك تثبيته من هاتفك أيضًا.';
};
function hint(id,message){
 const el=typeof id==='string'?document.getElementById(id):id;
 if(el){el.textContent=message;el.hidden=false;}
}
function sync(){
 const installed=standalone();
 for(const id of ['ymAuthInstall','yLandingInstall']){
   const b=document.getElementById(id);if(b){b.textContent=installed?'✓ تطبيق يومي مثبت بالفعل':'📲 تثبيت تطبيق يومي';b.setAttribute('aria-label',installed?'التطبيق مثبت بالفعل':'تثبيت تطبيق يومي على الجهاز');}
 }
}
function install(helpId){
 if(standalone()){hint(helpId,platformHelp());return;}
 const prompt=deferredPrompt;
 if(prompt){
  deferredPrompt=null;
  try{
   // Important: call .prompt() synchronously inside the click gesture.
   const pending=prompt.prompt();
   Promise.resolve(pending).then(()=>prompt.userChoice).then(choice=>{
    if(choice?.outcome==='accepted')hint(helpId,'تم قبول طلب التثبيت. أكمل خطوات المتصفح.');
    else hint(helpId,'يمكنك تثبيت يومي في أي وقت من قائمة المتصفح.');
   }).catch(()=>hint(helpId,platformHelp())).finally(sync);
  }catch(_){hint(helpId,platformHelp());}
  return;
 }
 hint(helpId,platformHelp());
}
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;sync();});
window.addEventListener('appinstalled',()=>{deferredPrompt=null;sync();hint('ymAuthInstallHelp','تم تثبيت التطبيق بنجاح ✓');hint('yLandingInstallHelp','تم تثبيت التطبيق بنجاح ✓');});
window.YawmiInstall={install,standalone,sync};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',sync);else sync();
})();