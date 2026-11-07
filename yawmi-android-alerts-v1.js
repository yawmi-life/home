/* YAWMI native Android notification scheduling. No permissions, data or UI on web/PWA.
   The Android app receives ONLY generic event ids and future timestamps.
   Device alerts work offline after scheduling, but are inexact and not FCM push. */
(()=>{'use strict';
const installed=/YawmiAndroid\\/\d+/.test(navigator.userAgent||'');
let allowed=false,enabled=false,owner='',lastPayload='',lastSync=0;
const cloud=()=>window.YawmiCloud,api=()=>window.YawmiExtraAPI;
const authorized=()=>!!(cloud()?.ready&&cloud()?.currentUser?.id&&!cloud()?.conflict&&api()?.getState);
function command(name,payload){
 if(!installed)return false;
 let uri='yawminotify://'+name;
 if(payload)uri+='?items='+encodeURIComponent(payload);
 location.href=uri;
 return true;
}
function togglePrefs(value){
 const a=api(),s=a?.getState?.();
 if(s){s.lifeNotificationPrefs=s.lifeNotificationPrefs||{};s.lifeNotificationPrefs.enabled=value;a.save?.()}
}
function nativeState(isEnabled,hasPermission){
 enabled=!!isEnabled&&!!hasPermission;
 allowed=!!hasPermission;
 window.YawmiPush?.renderControls?.();
 if(enabled)sync(true);
}
function enable(){
 if(!installed||!authorized())return false;
 command('enable');
 return true;
}
function disable(){
 if(!installed)return false;
 command('disable');
 enabled=false;lastPayload='';togglePrefs(false);
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
 for(const item of (Array.isArray(data.tasks)?data.tasks:[]).slice(0,200)){
  if(!item.time)continue;
  const date=item.date,completed=!!(data.daily?.[date]?.tasks?.[item.id]);
  if(!completed&&item.repeat==='once')add('task',item,0);
  // Repeating tasks are deliberately left to the existing web calendar
  // until their instance schedule can be reconstructed without false alerts.
 }
 return out.sort((a,b)=>a.at-b.at).slice(0,48);
}
function sync(force=false){
 if(!installed||!enabled)return false;
 const u=cloud()?.currentUser?.id||'';
 if(u!==owner){owner=u;lastPayload=''}
 if(!authorized()){
  if(lastPayload!=='[]'){lastPayload='[]';command('sync','[]')}
  return false;
 }
 const payload=JSON.stringify(events());
 if(payload===lastPayload&&!force)return true;
 if(!force&&Date.now()-lastSync<10000)return false;
 lastPayload=payload;lastSync=Date.now();
 return command('sync',payload);
}
function boot(){
 if(!installed)return;
 command('status');
 setInterval(()=>sync(false),45000);
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')sync()});
 window.addEventListener('online',()=>sync());
 window.addEventListener('pageshow',()=>sync());
}
window.YawmiAndroidAlerts={available:()=>installed,enabled:()=>enabled,enable,disable,test,sync,nativeState};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
else boot();
})();
