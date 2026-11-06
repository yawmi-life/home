/* YAWMI native Android launcher widget sync v1. No raw user data or auth tokens are transmitted. */
(()=>{'use strict';
const $=id=>document.getElementById(id),api=()=>window.YawmiExtraAPI,cloud=()=>window.YawmiCloud;
const DEFAULT_GOAL=2000;
let ui=null,pendingToken='',pendingUser='',lastUid='',lastValue='',lastPush=0,busy=false;
const isAndroid=()=>/Android/i.test(navigator.userAgent||'');
function authorized(){const c=cloud();return !!(c?.configured&&c?.currentUser?.id&&c?.ready&&!c?.conflict&&c?.sb);}
function makeSnapshot(){
 if(!authorized()||!api()?.getSummary||!api()?.getLevelInfo)return null;
 const a=api(),state=a.getState(),day=a.today(),summary=a.getSummary(day);
 if(!state||state.demo||!summary)return null;
 const scores=a.getScores(),xp=Math.max(0,Math.round(Number(scores?.xp)||0));
 const books=Array.isArray(state.books)?state.books:[];
 const ids=new Set(books.map(x=>x.id));
 const pages=(Array.isArray(state.bookReadings)?state.bookReadings:[])
   .filter(r=>r.date===day&&ids.has(r.bookId))
   .reduce((n,r)=>n+Math.max(0,Number(r.pages)||0),0);
 const goals=Array.isArray(state.goals)?state.goals:[];
 const progress=Number(summary.pct)||0;
 const obj={
  day,progress:Math.max(0,Math.min(100,Math.round(progress))),
  tasksDone:Math.max(0,summary.taskDone|0),tasksTotal:Math.max(0,summary.tasks?.length||0),
  habitsDone:Math.max(0,summary.habitDone|0),habitsTotal:Math.max(0,summary.habits?.length||0),
  xp,level:Math.max(1,Number(a.getLevelInfo(xp)?.level)||1),
  streak:Math.max(0,Number(a.getStreak?.())||0),
  goalsDone:goals.filter(g=>Number(g.target)>0&&Number(g.progress)>=Number(g.target)).length,
  goalsTotal:goals.length,
  booksCount:books.length,
  waterMl:Math.round(Math.max(0,Number(summary.water)||0)*250),
  waterGoalMl:Math.max(250,Number(state.waterPrefs?.goalMl)||DEFAULT_GOAL),
  readingPages:Math.round(Math.max(0,pages))
 };
 return Object.fromEntries(Object.entries(obj).map(([k,v])=>[k,k==='day'?v:Math.min(100000000,Math.max(0,Number(v)||0))]));
}
function say(message,bad=false){const area=$('yawmiNativeWidgetStatus');if(area){area.textContent=message;area.dataset.error=bad?'true':'false';}}
const widgetIntent=(host,token='')=>'intent://'+host+(token?'?token='+encodeURIComponent(token):'')+'#Intent;scheme=yawmiwidget;package=com.yawmilife.app;end';
function setPendingLink(token,user){
 pendingToken=token;pendingUser=user;
 const b=$('yawmiNativeWidgetFinish');if(b){b.hidden=!token;b.textContent='📱 ربط ويدجتس تطبيق يومي الأصلي';}
}
async function digest(value){
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
 return Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');
}
async function pair(){
 if(!isAndroid()){say('افتح يومي من هاتف Android بعد تثبيت آخر إصدار APK.',true);return}
 if(!authorized()){say('سجّل دخولك وانتظر انتهاء مزامنة الحساب أولًا.',true);return}
 const c=cloud(),uid=c.currentUser.id,snapshot=makeSnapshot();
 if(!snapshot){say('تعذّر قراءة بيانات الحساب. حاول مرة أخرى.',true);return}
 const b=$('yawmiNativeWidgetPair');if(b)b.disabled=true;
 try{
  const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
  const hash=await digest(token);
  const {error}=await c.sb.from('yawmi_widget_snapshots').insert({
    user_id:uid,token_hash:hash,snapshot,updated_at:new Date().toISOString()
  });
  if(error)throw Error(error.message||'SERVER_ERROR');
  setPendingLink(token,uid);
  lastUid=uid;lastValue=JSON.stringify(snapshot);lastPush=Date.now();
  say('الربط جاهز. اضغط «ربط ويدجتس تطبيق يومي الأصلي»؛ يلزم تثبيت تحديث يومي الموقّع بنفس شهادة التطبيق الحالي.');
 }catch(err){say('تعذّر ربط الويدجت: '+String(err.message||err),true)}
 finally{if(b)b.disabled=false}
}
function finishPair(){
 if(!pendingToken||!authorized()||cloud().currentUser.id!==pendingUser){
  setPendingLink('','');say('انتهت جلسة التفعيل. ابدأ الربط مرة أخرى.',true);return;
 }
 // Must be a direct, user-initiated click; no auth JWT or personal data in the URI.
 window.location.href=widgetIntent('link',pendingToken);
 setPendingLink('','');
 say('تم إرسال أمر الربط لأندرويد. أضف ويدجت «يومي» من الشاشة الرئيسية.');
}
async function disconnect(){
 if(!authorized()){say('يلزم تسجيل الدخول لإلغاء الربط.',true);return}
 if(!confirm('سيتم فصل جميع هواتفك المرتبطة بويدجتس يومي. هل تتابع؟'))return;
 const c=cloud(),uid=c.currentUser.id;
 const b=$('yawmiNativeWidgetUnlink');if(b)b.disabled=true;
 try{
  const {error}=await c.sb.from('yawmi_widget_snapshots').delete().eq('user_id',uid);
  if(error)throw Error(error.message||'SERVER_ERROR');
  lastUid='';lastValue='';setPendingLink('','');
  say('تم فصل الأجهزة من السحابة. اضغط «مسح القيم من هذا الهاتف» لإخفاء آخر نسخة محلية.');
  const x=$('yawmiNativeWidgetClear');if(x)x.hidden=!isAndroid();
 }catch(err){say('لم يكتمل فصل الأجهزة: '+String(err.message||err),true)}
 finally{if(b)b.disabled=false}
}
async function publish(){
 if(busy||!authorized())return;
 const c=cloud(),uid=c.currentUser.id;
 if(uid!==lastUid){lastUid=uid;lastValue='';setPendingLink('','');}
 const snapshot=makeSnapshot();if(!snapshot)return;
 const value=JSON.stringify(snapshot);
 if(value===lastValue)return;
 if(Date.now()-lastPush<12000)return;
 busy=true;lastPush=Date.now();
 try{
  const {error}=await c.sb.from('yawmi_widget_snapshots').update({
    snapshot,updated_at:new Date().toISOString()
  }).eq('user_id',uid);
  if(!error){lastValue=value;const status=$('yawmiNativeWidgetStatus');if(status&&!pendingToken)status.textContent='بيانات ويدجتس يومي جاهزة ومحدثة.';}
 }catch(_){}
 finally{busy=false}
}
function mount(){
 const home=$('page-home');if(!home||ui)return;
 ui=document.createElement('section');ui.id='yawmiNativeWidgetsPanel';
 ui.innerHTML='<div class="yn-head"><span class="yn-emoji">▦</span><div><h2>ويدجتس شاشة الهاتف</h2><p>تابع مهامك وعاداتك وXP والمياه خارج التطبيق، من شاشة Android الرئيسية.</p></div></div>'+
 '<div class="yn-actions"><button type="button" id="yawmiNativeWidgetPair">ربط ويدجتس الهاتف</button>'+
 '<button type="button" id="yawmiNativeWidgetFinish" hidden>📱 ربط ويدجتس يومي الأصلي</button>'+
 '<button type="button" id="yawmiNativeWidgetUnlink">فصل جميع الأجهزة</button>'+
 '<button type="button" id="yawmiNativeWidgetClear" hidden>مسح القيم من هذا الهاتف</button></div>'+
 '<p id="yawmiNativeWidgetStatus" role="status">الويدجتس جزء من تطبيق يومي الرئيسي، ولا تحتاج إلى تنزيل تطبيق منفصل. ظهورها يتطلب نسخة APK المحدثة والموقّعة بمفتاح الإصدار الأصلي.</p>'+
 '<small>بعد التفعيل، اضغط مطوّلًا على شاشة الهاتف الرئيسية ← الويدجتس ← يومي LifeOS. التحديث الدوري حسب قيود أندرويد.</small>';
 const anchor=home.querySelector('.date-row');
 if(anchor)home.insertBefore(ui,anchor);else home.appendChild(ui);
 const css=document.createElement('style');
 css.textContent=`
 #yawmiNativeWidgetsPanel{margin:16px 0 25px;padding:18px 20px;border:1px solid var(--border,#3d3d58);border-radius:19px;background:var(--panel,#22263a);direction:rtl}
 #yawmiNativeWidgetsPanel .yn-head{display:flex;gap:11px;align-items:center}.yn-emoji{font-size:30px;line-height:1;color:var(--accent,#ab91fc)}
 #yawmiNativeWidgetsPanel h2{font-size:18px;font-weight:900;margin:0 0 3px}
 #yawmiNativeWidgetsPanel p{color:var(--muted,#bcb7d3);font-size:12px;line-height:1.8;margin:0}
 #yawmiNativeWidgetsPanel .yn-actions{display:flex;gap:8px;flex-wrap:wrap;margin:15px 0 11px}
 #yawmiNativeWidgetsPanel button,#yawmiNativeWidgetsPanel .yn-download{border:1px solid var(--border,#555);background:var(--accent-faint,rgba(150,110,250,.18));color:var(--text,#fff);border-radius:11px;padding:10px 13px;font:800 12px Cairo,Tahoma,sans-serif;cursor:pointer}
 #yawmiNativeWidgetPair{background:var(--accent,#ab91fc)!important;color:var(--on-accent,#141226)!important}
 #yawmiNativeWidgetsPanel button:disabled{opacity:.5}
 #yawmiNativeWidgetsPanel button[hidden]{display:none!important}
 #yawmiNativeWidgetsPanel small{color:var(--muted,#aaa);font-size:11px}
 #yawmiNativeWidgetStatus[data-error="true"]{color:#ed9f9f}
 `;
 document.head.appendChild(css);
 $('yawmiNativeWidgetPair').addEventListener('click',pair);
 $('yawmiNativeWidgetFinish').addEventListener('click',()=>finishPair());
 $('yawmiNativeWidgetUnlink').addEventListener('click',disconnect);
 $('yawmiNativeWidgetClear').addEventListener('click',()=>{window.location.href=widgetIntent('unlink')});
 if(!isAndroid())say('لربط الويدجتس افتح يومي من هاتف Android بعد تثبيت تحديث التطبيق الرئيسي.');
}
function boot(){mount();setInterval(()=>{if(document.visibilityState==='visible')publish()},15000);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')publish()});setTimeout(publish,3000);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.YawmiNativeWidgets={sync:publish,prepare:pair};
})();
