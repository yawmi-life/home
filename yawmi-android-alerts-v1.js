/* YAWMI native Android notification scheduling. No permissions, data or UI on web/PWA.
   The Android app receives ONLY generic event ids and future timestamps.
   Device alerts work offline after scheduling, but are inexact and not FCM push. */
(()=>{'use strict';
const installed=/YawmiAndroid\/\d+/.test(navigator.userAgent||'');
let enabled=false,owner='',lastPayload='',lastSync=0,scheduled=0,nextAt=0;
const cloud=()=>window.YawmiCloud,api=()=>window.YawmiExtraAPI;
const authorized=()=>!!(cloud()?.ready&&cloud()?.currentUser?.id&&!cloud()?.conflict&&api()?.getState);
function command(name,payload){
 if(!installed)return false;
 let uri='yawminotify://'+name;
 if(payload)uri+='?items='+encodeURIComponent(payload);
 location.href=uri;
 return true;
}
function nativeState(isEnabled,hasPermission,count=0,upcoming=0){
 const previouslyEnabled=enabled;
 enabled=!!isEnabled&&!!hasPermission;
 scheduled=Math.max(0,Number(count)||0);
 nextAt=Math.max(0,Number(upcoming)||0);
 window.YawmiPush?.renderControls?.();
 if(document.querySelector('#page-reminders.on'))window.YawmiLife?.render?.('reminders');
 // Never re-send an identical calendar to the native bridge in a status loop.
 if(enabled&&!previouslyEnabled)sync(true);
}
function scheduleInfo(){return {count:scheduled,nextAt}}
function enable(){
 if(!installed||!authorized())return false;
 command('enable');
 return true;
}
function disable(){
 if(!installed)return false;
 command('disable');
 enabled=false;lastPayload='';
 window.YawmiPush?.renderControls?.();
 return true;
}
function test(){return installed&&command('test')}
function parseDay(date,time){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date||'')||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time||''))return NaN;
 const t=new Date(date+'T'+time+':00');
 return t.getFullYear()===Number(date.slice(0,4))&&t.getMonth()===Number(date.slice(5,7))-1&&t.getDate()===Number(date.slice(8))?t.getTime():NaN;
}
function events(){
 const data=api()?.getState?.();if(!data)return [];
 const out=[],now=Date.now(),limit=now+30*86400000;
 function add(kind,item,lead=0){
  if(!item?.id||item.done||item.cancelled)return;
  let date=String(item.date||''),time=String(item.time||'');
  if(item.repeat==='yearly'&&/^\d{4}-\d{2}-\d{2}$/.test(date)){
   const d=new Date(),year=d.getFullYear();
   date=year+date.slice(4);
   if(parseDay(date,time)<now)date=(year+1)+date.slice(4);
  }
  const at=parseDay(date,time)-lead*60000;
  if(!Number.isFinite(at)||at<now+10000||at>limit)return;
  const id=(kind+':'+String(item.id).replace(/[^a-zA-Z0-9_-]/g,'').slice(0,35)+':'+date.replace(/-/g,'')+':'+time.replace(':','')+':'+lead).slice(0,90);
  out.push({id,at});
 }
 for(const item of (Array.isArray(data.lifeCalendar)?data.lifeCalendar:[]).slice(0,200)){
  if(item.remind==='none'||item.remind==null)continue;
  const lead=Number(item.remind)||0;
  if([0,10,60,1440].includes(lead))add('cal',item,lead);
 }
 for(const item of (Array.isArray(data.lifeReminders)?data.lifeReminders:[]).slice(0,200)){
  const lead=Number(item.lead)||0;
  if([0,10,60,1440].includes(lead))add('rem',item,lead);
 }
 // Follow the existing YAWMI recurrence engine: include scheduled daily/weekly
 // instances for the next week, without inventing recurring dates ourselves.
 for(let offset=0;offset<7;offset++){
  const day=new Date();
  day.setHours(12,0,0,0);
  day.setDate(day.getDate()+offset);
  const date=[day.getFullYear(),String(day.getMonth()+1).padStart(2,'0'),
   String(day.getDate()).padStart(2,'0')].join('-');
  const tasks=api()?.getSummary?.(date)?.tasks||[];
  for(const item of tasks.slice(0,90)){
   if(!item.time||data.daily?.[date]?.tasks?.[item.id])continue;
   add('task',{...item,date},0);
  }
 }
 return out.sort((a,b)=>a.at-b.at).slice(0,48);
}
function sync(force=false){
 if(!installed||!enabled)return false;
 const u=cloud()?.currentUser?.id||'';
 if(!authorized()){
  // Never delete previously scheduled alarms merely because an offline
  // login/session cannot be read. Only clear on a confirmed, ready logout.
  if(owner&&cloud()?.ready&&!u){owner='';lastPayload='[]';command('sync','[]')}
  return false;
 }
 if(u!==owner){owner=u;lastPayload=''}
 const payload=JSON.stringify(events());
 if(payload===lastPayload&&!force)return true;
 if(!force&&Date.now()-lastSync<10000)return false;
 lastPayload=payload;lastSync=Date.now();
 return command('sync',payload);
}
let wrapped=null;
function hookSave(){
 const a=api();
 if(!installed||!a||a===wrapped||typeof a.save!=='function')return;
 const previous=a.save;
 a.save=function(...args){
  const outcome=previous.apply(this,args);
  // Schedule immediately after saving a reminder rather than relying on a
  // 45-second polling window that users might close before it fires.
  if(outcome!==false)setTimeout(()=>sync(true),300);
  return outcome;
 };
 wrapped=a;
}
function boot(){
 if(!installed)return;
 command('status');
 hookSave();
 setInterval(()=>{hookSave();sync(false)},5000);
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')sync()});
 window.addEventListener('online',()=>sync());
 window.addEventListener('pageshow',()=>sync());
}
window.YawmiAndroidAlerts={available:()=>installed,enabled:()=>enabled,enable,disable,test,sync,nativeState,scheduleInfo};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
else boot();
})();
