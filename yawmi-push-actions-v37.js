/* YAWMI V37 — opt-in notification actions. The tap opens the authenticated app first.
 * Never award XP, complete a task, or send sensitive titles from a lock screen.
 */
(()=>{'use strict';
const api=()=>window.YawmiExtraAPI,cloud=()=>window.YawmiCloud;
const allowed=new Set(['done','snooze10','tomorrow']);
let pending=false,busy=false;
function parseKey(input){
 const initial=String(input||'');
 // A re-notification carries the original key and a numeric snooze timestamp.
 const key=initial.startsWith('snooze:')?initial.replace(/^snooze:/,'').replace(/:\d{13}$/,''):initial;
 const match=/^(calendar|reminder):([a-zA-Z0-9_-]{1,120}):(\d{4}-\d\d-\d\d):([01]\d|2[0-3]):([0-5]\d):(\d{1,4})$/.exec(key);
 return match?{key,type:match[1],id:match[2],date:match[3],time:match[4]+':'+match[5],lead:Number(match[6])}:null;
}
function schedule(key,action,at=new Date()){
 if(!allowed.has(action))return null;
 const now=+at;
 if(!Number.isFinite(now))return null;
 return {originalKey:key,at:new Date(now+(action==='snooze10'?10:24*60)*60000).toISOString(),createdAt:new Date(now).toISOString()};
}
function clearParams(url){
 url.searchParams.delete('push_action');url.searchParams.delete('push_key');
 try{history.replaceState(null,'',url.pathname+url.search+url.hash)}catch(_){}
}
function liveRecord(s,parsed){
 const items=parsed.type==='calendar'?s.lifeCalendar:s.lifeReminders;
 if(!Array.isArray(items))return null;
 const e=items.find(x=>x.id===parsed.id);
 if(!e||e.time!==parsed.time)return null;
 if(e.repeat==='yearly'){
  if(e.date?.slice(5)!==parsed.date.slice(5))return null;
 }else if(e.date!==parsed.date)return null;
 return e;
}
function applyAction(s,parsed,action,now=new Date()){
 if(!allowed.has(action))return {ok:false,error:'UNKNOWN_ACTION'};
 if(!liveRecord(s,parsed))return {ok:false,error:'RECORD_NOT_FOUND'};
 const original=s.lifeNotificationSnoozes,previous=s.lifeNotificationDismissed;
 if(action==='done'){
  if(!Array.isArray(s.lifeNotificationDismissed))s.lifeNotificationDismissed=[];
  s.lifeNotificationDismissed=[...new Set([...s.lifeNotificationDismissed,parsed.key])].slice(-400);
  if(Array.isArray(s.lifeNotificationSnoozes))s.lifeNotificationSnoozes=s.lifeNotificationSnoozes.filter(x=>x.originalKey!==parsed.key);
 }else{
  const snooze=schedule(parsed.key,action,now);
  if(!snooze)return {ok:false,error:'INVALID_DATE'};
  if(!Array.isArray(s.lifeNotificationSnoozes))s.lifeNotificationSnoozes=[];
  s.lifeNotificationSnoozes=[...s.lifeNotificationSnoozes.filter(x=>x.originalKey!==parsed.key),snooze].slice(-150);
 }
 return {ok:true,rollback(){s.lifeNotificationSnoozes=original;s.lifeNotificationDismissed=previous}};
}
function process(){
 if(busy||!api()?.getState||!cloud()?.ready||!cloud()?.currentUser||!api().save)return false;
 let url;try{url=new URL(location.href)}catch(_){return false}
 const act=url.searchParams.get('push_action'),key=url.searchParams.get('push_key');
 if(!act&&!key)return false;
 busy=true;clearParams(url);
 const parsed=parseKey(key),s=api().getState();
 if(!parsed||!allowed.has(act)||!s){busy=false;api()?.notify?.('تعذّر فتح إجراء الإشعار. راجع التقويم.');return true}
 if(act==='done'&&!confirm('هل تريد إيقاف تنبيه الموعد ده فقط؟ الموعد نفسه وهياناته هيفضلوا محفوظين. مش هتُضاف أي نقاط XP.')){
  busy=false;api().goPage?.('calendar');return true;
 }
 const applied=applyAction(s,parsed,act);
 if(!applied.ok){api().notify?.('التذكير اتغير أو اتحذف بالفعل. راجع التقويم.')}
 else if(api().save()===false){applied.rollback();api().notify?.('فشل حفظ إجراء الإشعار، حاول تاني.')}
 else api().notify?.(act==='done'?'تم إيقاف تنبيه هذا الموعد من غير حذف أو XP.':act==='snooze10'?'هتوصلك محاولة تذكير بعد 10 دقائق إذا كانت إشعارات جهازك مفعلة.':'هتوصلك محاولة تذكير بعد 24 ساعة إذا كانت إشعارات جهازك مفعلة.');
 api().goPage?.('calendar');busy=false;return true;
}
function init(){
 if(pending)return;pending=true;
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)process()});
 window.addEventListener('focus',process);
 window.addEventListener('pageshow',process);
 // Login may finish after page load: only check while a notification action is in the URL.
 let checks=0;const interval=setInterval(()=>{
  if(process()||++checks>180||!new URL(location.href).searchParams.has('push_action'))clearInterval(interval);
 },1000);
 process();
}
window.YawmiPushActions={process,parseKey,schedule,applyAction};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();