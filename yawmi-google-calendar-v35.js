/* YAWMI V35 — Google Calendar OAuth integration. User must configure a Google OAuth Web Client ID. */
(()=>{'use strict';
const $=id=>document.getElementById(id),api=()=>window.YawmiExtraAPI,base='https://www.googleapis.com/calendar/v3/calendars/primary/events';
const scope='https://www.googleapis.com/auth/calendar.events';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clientId=()=>String(window.YAWMI_CONFIG?.googleCalendarClientId||'').trim();
const validClientId=x=>/^\d{8,}-[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/.test(x);
let token='',expiry=0,oauthClient=null,googleEvents=[],inFlight=false,status='',owner=null,loaded=false;
function accountCheck(){
 const current=window.YawmiCloud?.currentUser?.id||'local';
 if(owner!==current){owner=current;token='';expiry=0;googleEvents=[];status=''}
}
function authorized(){accountCheck();return token&&expiry>Date.now()+10000}
function handleError(e){const msg=String(e?.message||e||'تعذر الاتصال');status=msg.slice(0,180);renderControls();api()?.notify?.(status)}
function notify(message){status=message;renderControls();api()?.notify?.(message)}
function readDate(dateTime){const x=new Date(dateTime);if(!Number.isFinite(+x))return '';const y=x.getFullYear(),m=String(x.getMonth()+1).padStart(2,'0'),d=String(x.getDate()).padStart(2,'0');return y+'-'+m+'-'+d}
function localTime(dateTime){const d=new Date(dateTime);if(!Number.isFinite(+d))return '';return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')}
function eventsOn(d){if(!authorized())return [];
 return googleEvents.filter(e=>e.date===d).map(e=>({...e}));
}
async function loadLibrary(){
 if(window.google?.accounts?.oauth2)return;
 if(loaded)throw new Error('Google Identity Services غير متاحة الآن. أعد المحاولة.');
 loaded=true;
 await new Promise((resolve,reject)=>{
  const el=document.createElement('script');el.src='https://accounts.google.com/gsi/client';el.async=true;el.defer=true;
  el.onload=resolve;el.onerror=()=>reject(new Error('تعذر تحميل واجهة Google للموافقة.'));
  document.head.appendChild(el);
 });
}
function requestOAuth(){
 const id=clientId();
 if(!validClientId(id))return notify('الربط يحتاج إعداد Google OAuth Client ID للتطبيق أولًا؛ تقدر تستخدم إضافة موعد أو ملف ICS مؤقتًا.');
 loadLibrary().then(()=>{
  if(!oauthClient)oauthClient=window.google.accounts.oauth2.initTokenClient({client_id:id,scope,prompt:'consent',
   callback:r=>{
    if(r?.error||!r?.access_token)return notify('Google لم تمنح صلاحية التقويم، أو انتهت محاولة الربط.');
    token=r.access_token;expiry=Date.now()+Math.max(30,Number(r.expires_in)||3600)*1000;
    notify('تم ربط الجلسة الحالية بجوجل كالندر ✓');
    refresh();
   }});
  oauthClient.requestAccessToken({prompt:authorized()?'':'consent'});
 }).catch(handleError);
}
async function get(url,opts={}){
 if(!authorized())throw Error('صلاحية جوجل غير نشطة. اضغط ربط جوجل مرة أخرى.');
 const response=await fetch(url,{...opts,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',...(opts.headers||{})}});
 if(response.status===401){token='';expiry=0;googleEvents=[];renderControls();throw Error('انتهت صلاحية جوجل. اربط حسابك مجددًا.')}
 let json={};try{json=await response.json()}catch(_){}
 if(!response.ok){const err=new Error(json?.error?.message||'Google Calendar HTTP '+response.status);err.status=response.status;throw err}
 return json;
}
function isoLocal(d){const t=new Date(d);return Number.isFinite(+t)?t.toISOString():''}
async function refresh(){
 if(inFlight||!authorized())return;if(!navigator.onLine)return notify('الإنترنت مطلوب لاستيراد مواعيد Google.');
 inFlight=true;renderControls();
 try{
  const now=new Date(),from=new Date(+now-30*86400000),to=new Date(+now+370*86400000);
  const found=[];let pageToken='';
  for(let page=0;page<4;page++){
   const qs=new URLSearchParams({timeMin:from.toISOString(),timeMax:to.toISOString(),singleEvents:'true',orderBy:'startTime',maxResults:'250'});
   if(pageToken)qs.set('pageToken',pageToken);
   const data=await get(base+'?'+qs);
   for(const ev of data.items||[]){
    if(ev.status==='cancelled'||ev.extendedProperties?.private?.yawmiId)continue;
    const date=ev.start?.date||readDate(ev.start?.dateTime),time=ev.start?.date?'':localTime(ev.start?.dateTime);
    if(date&&/^\d{4}-\d{2}-\d{2}$/.test(date))found.push({id:'google-'+String(ev.id||'').slice(0,160),date,title:String(ev.summary||'موعد في Google Calendar').slice(0,130),
      time,source:'google',type:'event',url:/^https:\/\/calendar\.google\.com\//.test(ev.htmlLink||'')?ev.htmlLink:'',note:'من جوجل كالندر · للعرض فقط'});
   }
   pageToken=data.nextPageToken||'';if(!pageToken)break;
  }
  googleEvents=found;status='تم تحديث '+found.length+' موعد من جوجل، للعرض فقط. البيانات لا تُنسخ إلى يومي.';api()?.render?.();
 }catch(e){handleError(e)}finally{inFlight=false;renderControls()}
}
async function deterministicId(user,id){
 const data=new TextEncoder().encode(String(user)+':'+id);
 const digest=await crypto.subtle.digest('SHA-256',data);
 return 'a'+[...new Uint8Array(digest)].slice(0,18).map(z=>z.toString(16).padStart(2,'0')).join('');
}
function eventPayload(e,uid){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(e.date)||!/^\d\d:\d\d$/.test(e.time||''))return null;
 const start=new Date(e.date+'T'+e.time+':00'),end=e.end?new Date(e.date+'T'+e.end+':00'):new Date(+start+3600000);
 if(!Number.isFinite(+start)||!Number.isFinite(+end)||end<=start)return null;
 return {summary:String(e.title||'موعد من يومي').slice(0,160),
 description:'من تطبيق يومي LifeOS'+(e.note?'\n'+String(e.note).slice(0,400):''),
 start:{dateTime:start.toISOString()},end:{dateTime:end.toISOString()},
 ...(e.repeat==='yearly'?{recurrence:['RRULE:FREQ=YEARLY']}:{}),
 extendedProperties:{private:{yawmiId:e.id,yawmiOwner:uid}}};
}
async function uploadEvents(){
 if(!authorized())return requestOAuth();
 const s=api()?.getState?.();if(!s)return;
 const rows=(s.lifeCalendar||[]).filter(x=>x.date&&x.time);
 if(!rows.length)return notify('مفيش مواعيد محلية عندك لتصديرها إلى جوجل.');
 if(rows.length>100)return notify('لتفادي رفع بيانات كثيرة دفعة واحدة، الحد الحالي 100 موعد. قلل العدد قبل المزامنة.');
 if(!confirm('هل توافق على إنشاء/تحديث '+rows.length+' مواعيد من يومي داخل تقويم جوجل الأساسي؟ لن نحذف مواعيد Google الخاصة بك.'))return;
 inFlight=true;renderControls();let success=0,failed=0;
 const uid=window.YawmiCloud?.currentUser?.id||'local';
 for(const e of rows){
  try{
   const payload=eventPayload(e,uid);if(!payload){failed++;continue}
   const id=await deterministicId(uid,e.id);payload.id=id;
   try{await get(base,{method:'POST',body:JSON.stringify(payload)})}
   catch(err){if(err.status!==409)throw err;await get(base+'/'+encodeURIComponent(id),{method:'PUT',body:JSON.stringify(payload)})}
   success++;
  }catch(_){failed++}
 }
 inFlight=false;notify('جوجل كالندر: '+success+' موعد تم حفظه، '+failed+' تعذر حفظه. لن نحذف أحداث Google الأصلية.');
 if(success)refresh();
}
function toDateInput(e){
 const start=new Date(e.date+'T'+(e.time||'09:00')+':00');
 const end=e.end?new Date(e.date+'T'+e.end+':00'):new Date(+start+3600000);
 const f=d=>d.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
 return {start:f(start),end:f(end)};
}
function openInGoogle(id){
 const e=api()?.getState?.()?.lifeCalendar?.find(x=>x.id===id);if(!e||!e.date)return;
 const dates=toDateInput(e),url=new URL('https://calendar.google.com/calendar/render');
 url.search=new URLSearchParams({action:'TEMPLATE',text:String(e.title||'موعد').slice(0,160),
  dates:dates.start+'/'+dates.end,details:String(e.note||'').slice(0,300)});
 window.open(url.href,'_blank','noopener,noreferrer');
}
function exportIcs(){
 const list=api()?.getState?.()?.lifeCalendar||[];
 const items=list.filter(x=>x.date&&/^\d\d:\d\d$/.test(x.time||''));
 if(!items.length)return notify('ليس عندك مواعيد بتاريخ ووقت للتصدير.');
 const escape=x=>String(x||'').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
 const asIcs=d=>d.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
 const output=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//YAWMI LifeOS//Calendar//AR','CALSCALE:GREGORIAN'];
 for(const x of items){
  const first=new Date(x.date+'T'+x.time+':00'),last=x.end?new Date(x.date+'T'+x.end+':00'):new Date(+first+3600000);
  if(!Number.isFinite(+first)||!Number.isFinite(+last)||last<=first)continue;
  output.push('BEGIN:VEVENT','UID:'+escape(x.id)+'@yawmi-life.github.io','DTSTAMP:'+asIcs(new Date()),
   'DTSTART:'+asIcs(first),'DTEND:'+asIcs(last),'SUMMARY:'+escape(x.title),'DESCRIPTION:'+escape(x.note),
   ...(x.repeat==='yearly'?['RRULE:FREQ=YEARLY']:[]),'END:VEVENT');
 }
 output.push('END:VCALENDAR');
 const blob=new Blob([output.join('\r\n')],{type:'text/calendar;charset=utf-8'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='yawmi-calendar.ics';a.click();
 setTimeout(()=>URL.revokeObjectURL(url),2000);
}
function disconnect(){
 if(token&&window.google?.accounts?.oauth2?.revoke)try{window.google.accounts.oauth2.revoke(token,()=>{})}catch(_){}
 token='';expiry=0;googleEvents=[];status='تم فصل الجلسة الحالية. لم يتم حذف مواعيد Google الخاصة بك.';renderControls();api()?.render?.();
}
function renderControls(){
 const el=$('ymGoogleCalendarControls');if(!el)return;accountCheck();
 const configured=validClientId(clientId()),active=!!authorized();
 el.innerHTML='<div class="yl-toolbar"><h3>🗓️ ربط جوجل كالندر</h3><small>'+(active?'مرتبط في الجلسة الحالية':configured?'جاهز للموافقة من جوجل':'إعداد OAuth لم يكتمل')+'</small></div>'+
 '<p class="muted">مواعيد Google تظهر داخل تقويم يومي للعرض، وتقدر تصدّر مواعيد يومي إلى Google بعد موافقتك. لا يتم إرسال بيانات تلقائيًا.</p>'+
 (configured?'<div class="yl-calendar-connect">'+
 (active?'<button class="yl-action" data-google-refresh>↻ تحديث مواعيد جوجل</button><button class="yl-action primary" data-google-upload>↑ تصدير مواعيد يومي إلى جوجل</button><button class="yl-action" data-google-disconnect>فصل الجلسة</button>':
 '<button class="yl-action primary" data-google-connect>ربط حساب Google Calendar</button>')+'</div>':
 '<p class="yl-callout">للتفعيل التلقائي يحتاج مسؤول التطبيق إضافة Google OAuth Client ID وتفعيل Calendar API وتسجيل رابط الموقع في Google Cloud. لحين التفعيل يمكنك إضافة موعد لجوجل منفردًا أو تصدير ملف ICS.</p>')+
 '<div class="yl-calendar-connect"><button class="yl-action" data-google-ics>⇩ تنزيل مواعيدي (ICS)</button></div>'+
 (status?'<p class="yl-google-status" role="status">'+esc(status)+'</p>':'')+
 '<small class="muted">تفويض Google مؤقت داخل المتصفح؛ بعد انتهاء الجلسة يلزم ربط جديد. ليست مزامنة تلقائية في الخلفية.</small>';
}
function init(){
 document.addEventListener('click',e=>{
  const b=e.target.closest?.('button');if(!b)return;
  if(b.hasAttribute('data-google-connect'))requestOAuth();
  if(b.hasAttribute('data-google-refresh'))refresh();
  if(b.hasAttribute('data-google-upload'))uploadEvents();
  if(b.hasAttribute('data-google-disconnect'))disconnect();
  if(b.hasAttribute('data-google-ics'))exportIcs();
  if(b.dataset.googleExportEvent)openInGoogle(b.dataset.googleExportEvent);
 });
}
window.YawmiGoogleCalendar={renderControls,requestOAuth,refresh,uploadEvents,eventsOn,openInGoogle,exportIcs,disconnect,
 getState:()=>({configured:validClientId(clientId()),connected:!!authorized(),events:googleEvents.length})};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();