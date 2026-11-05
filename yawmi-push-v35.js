/* YAWMI V35 background Web Push client — opt-in per device, account verified, server-scheduled. */
(()=>{'use strict';
const $=id=>document.getElementById(id),api=()=>window.YawmiExtraAPI,cloud=()=>window.YawmiCloud;
const endpoint=()=>String(window.YAWMI_CONFIG?.supabaseUrl||'').replace(/\/$/,'')+'/functions/v1/yawmi-push-v35';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let activeDevice=false,ready=false,busy=false,info='',owner=null,lastStatus=0;
function browserReady(){return !!(window.isSecureContext&&'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window)}
function validSession(){return Boolean(cloud()?.ready&&cloud()?.currentUser?.id&&cloud()?.sb)}
function ownerCheck(){
 const id=cloud()?.currentUser?.id||null;
 if(owner!==id){owner=id;ready=false;activeDevice=false;info=''}
}
async function call(action,body={},requiresAuth=true){
 const cfg=window.YAWMI_CONFIG||{},headers={'Content-Type':'application/json','apikey':String(cfg.supabasePublishableKey||'')};
 if(requiresAuth){
  if(!validSession())throw Error('سجّل دخول حسابك قبل تفعيل الإشعارات.');
  const {data,error}=await cloud().sb.auth.getSession();
  if(error||!data?.session?.access_token)throw Error('صلاحية الحساب غير متاحة. سجّل الدخول مرة تانية.');
  headers.Authorization='Bearer '+data.session.access_token;
 }
 const resp=await fetch(endpoint(),{method:'POST',headers,body:JSON.stringify({action,...body})});
 let result={};try{result=await resp.json()}catch(_){}
 if(!resp.ok||result.error)throw Error(result.error==='LOGIN_REQUIRED'?'سجّل دخولك مرة تانية.':result.error||'خدمة الإشعارات لم تستجب ('+resp.status+')');
 return result;
}
function asBytes(base64url){const str=base64url.replace(/-/g,'+').replace(/_/g,'/'),data=atob(str.padEnd(Math.ceil(str.length/4)*4,'='));return Uint8Array.from(data,ch=>ch.charCodeAt(0))}
async function registration(){
 if(!navigator.serviceWorker.controller){await navigator.serviceWorker.register('./sw.js',{scope:'./'})}
 return await navigator.serviceWorker.ready;
}
async function enable(){
 if(busy)return;
 if(!browserReady()){info='Web Push مش مدعوم في المتصفح ده. على iPhone ثبّت التطبيق على الشاشة الرئيسية أولًا.';renderControls();return}
 if(!validSession()){info='سجّل الدخول قبل ربط إشعارات الهاتف بحسابك.';renderControls();return}
 busy=true;renderControls();
 try{
  // Must request permission as a direct consequence of the user's click.
  const permission=Notification.permission==='default'?await Notification.requestPermission():Notification.permission;
  if(permission!=='granted')throw Error('إذن الإشعارات مرفوض. اسمح بها من إعدادات الموقع.');
  const {publicKey}=await call('public-key',{},false);
  if(!publicKey||publicKey.length<60)throw Error('المفتاح العام للإشعارات غير متوفر.');
  const reg=await registration(),push=reg.pushManager;
  let sub=await push.getSubscription();
  if(!sub){sub=await push.subscribe({userVisibleOnly:true,applicationServerKey:asBytes(publicKey)})}
  const timezone=Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';
  const result=await call('subscribe',{subscription:sub.toJSON(),timezone});
  if(!result.ok)throw Error('لم يتم تسجيل الجهاز في الخدمة.');
  const state=api()?.getState?.();if(state){state.lifeNotificationPrefs=state.lifeNotificationPrefs||{};state.lifeNotificationPrefs.enabled=true;api()?.save?.()}
  activeDevice=true;ready=true;
  info='جهازك متصل بالإشعارات حتى بعد إغلاق الصفحة، طالما الجهاز متصل بالإنترنت والنظام يسمح بذلك.';
 }catch(err){
  info=String(err?.message||err||'لم تكتمل تهيئة الإشعارات').slice(0,220);
 }finally{busy=false;renderControls()}
}
async function disable(){
 if(busy)return;busy=true;renderControls();
 try{
  const reg=await registration(),sub=await reg.pushManager.getSubscription();
  if(sub){await call('unsubscribe',{subscription:{endpoint:sub.endpoint}});await sub.unsubscribe()}
  activeDevice=false;ready=true;
  const result=await call('status',{},true);
  const state=api()?.getState?.();if(state){state.lifeNotificationPrefs=state.lifeNotificationPrefs||{};state.lifeNotificationPrefs.enabled=Number(result.devices)>0;api()?.save?.()}
  info='أوقفت إشعارات هذا الجهاز. البيانات والتذكيرات ما زالت محفوظة.';
 }catch(e){info='تعذر الإيقاف: '+String(e.message||e).slice(0,150)}
 finally{busy=false;renderControls()}
}
async function test(){
 if(busy||!activeDevice)return;
 busy=true;renderControls();
 try{const r=await call('test');info=r.queued?'تم إرسال إشعار تجريبي لخدمة جهازك. ظهور الإشعار يعتمد على إذن الهاتف.':'تعذر إرسال الإشعار التجريبي.'}
 catch(e){info='فشل الاختبار: '+String(e.message||e).slice(0,130)}
 finally{busy=false;renderControls()}
}
async function refresh(){
 ownerCheck();
 if(!browserReady()||!validSession()||Date.now()-lastStatus<15000)return;
 lastStatus=Date.now();
 try{
  const reg=await registration(),sub=await reg.pushManager.getSubscription();
  if(!sub){ready=true;activeDevice=false;renderControls();return}
  const result=await call('status');ready=true;activeDevice=Number(result.devices)>0&&Notification.permission==='granted';
  if(!activeDevice&&Notification.permission==='granted')info='هذا الجهاز فيه اشتراك سابق لكنه مش مربوط بحسابك؛ فعّل الإشعارات من جديد.';
 }catch(_){ready=false}renderControls();
}
function renderControls(){
 const box=$('ymPushControls');if(!box)return;ownerCheck();
 const support=browserReady(),permission='Notification' in window?Notification.permission:'unsupported';
 box.innerHTML='<div class="yl-toolbar"><h3>🔔 إشعارات الهاتف في الخلفية</h3><small>'+(!support?'غير مدعوم':activeDevice?'الجهاز متصل':'غير مفعّل')+'</small></div>'+
 '<p class="muted">فعّل الإشعارات على جهازك علشان السيرفر يبعت التذكيرات المستحقة حتى لو صفحة يومي مقفولة. لازم إنترنت وإذن النظام.</p>'+
 (!support?'<p class="yl-callout">على iPhone أو iPad ثبّت تطبيق يومي من Safari على الشاشة الرئيسية أولًا؛ وعلى المتصفحات الأخرى تأكد من دعم Web Push.</p>':
 '<div class="yl-calendar-connect">'+
 (activeDevice?'<button class="yl-action primary" data-push-test '+(busy?'disabled':'')+'>🧪 إشعار تجريبي</button><button class="yl-action" data-push-disable '+(busy?'disabled':'')+'>إيقاف إشعارات الجهاز</button>':
 '<button class="yl-action primary" data-push-enable '+(busy?'disabled':'')+'>🔔 تفعيل إشعارات الجهاز</button>')+
 '</div>')+
 '<p class="yl-google-status" role="status">'+esc(info||('إذن المتصفح: '+(permission==='granted'?'مسموح':permission==='denied'?'مرفوض':'غير محدد')))+'</p>'+
 '<small class="muted">الإرسال كل دقيقة تقريبًا عبر Supabase. لا يوجد ضمان لو الجهاز مقفول أو في وضع توفير بطارية شديد أو أذونات إشعاراته متوقفة.</small>';
 if(!ready&&!busy)refresh();
}
function init(){
 document.addEventListener('click',e=>{
  const b=e.target.closest?.('button');if(!b)return;
  if(b.hasAttribute('data-push-enable'))enable();
  if(b.hasAttribute('data-push-disable'))disable();
  if(b.hasAttribute('data-push-test'))test();
 });
}
window.YawmiPush={enable,disable,test,refresh,renderControls,active:()=>activeDevice&&ready,getState:()=>({supported:browserReady(),enabled:activeDevice,ready})};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();