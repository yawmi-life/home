/* YAWMI Android home-screen widgets — headless account bridge.
   No widget panel, widget button or widget settings inside the YAWMI pages.
   Add widgets ONLY through the Android launcher widget picker.
   A tap on an unlinked launcher widget triggers a one-time background pairing
   after cloud sign-in. No raw private tasks or auth tokens are put on widgets. */
(()=>{'use strict';
const api=()=>window.YawmiExtraAPI,cloud=()=>window.YawmiCloud;
const DEFAULT_GOAL=2000;
const STORE_PENDING='yawmi_launcher_widget_link_pending';
let lastUid='',lastValue='',lastPush=0,busy=false,pairing=false,nextTry=0;
const isAndroid=()=>/Android/i.test(navigator.userAgent||'');
function authorized(){
 const c=cloud();
 return !!(c?.configured&&c?.currentUser?.id&&c?.ready&&!c?.conflict&&c?.sb);
}
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

const widgetIntent=(token)=>'intent://link?token='+encodeURIComponent(token)+
 '#Intent;scheme=yawmiwidget;package=com.yawmilife.app;end';
async function digest(value){
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
 return Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');
}
function requestedFromLauncher(){
 const params=new URLSearchParams(location.search);
 if(params.get('widgetPair')==='1'){
  try{sessionStorage.setItem(STORE_PENDING,'1')}catch(_){}
  return true;
 }
 try{return sessionStorage.getItem(STORE_PENDING)==='1'}catch(_){return false}
}
function clearRequest(){
 try{sessionStorage.removeItem(STORE_PENDING)}catch(_){}
 try{
  const u=new URL(location.href);
  if(u.searchParams.has('widgetPair')){
   u.searchParams.delete('widgetPair');
   history.replaceState(history.state,'',u.toString());
  }
 }catch(_){}
}
async function pairFromLauncher(){
 // The widget is an Android OS component. The in-app interface never shows
 // configuration controls, but a deliberate tap on the unlinked launcher
 // widget may connect account aggregates after the user signs in.
 if(pairing||!isAndroid()||!requestedFromLauncher()||!authorized()||Date.now()<nextTry)return;
 const snapshot=makeSnapshot();if(!snapshot)return;
 pairing=true;
 nextTry=Date.now()+12000;
 try{
  const c=cloud(),uid=c.currentUser.id;
  const bytes=crypto.getRandomValues(new Uint8Array(32));
  const token=Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');
  const hash=await digest(token);
  const {error}=await c.sb.from('yawmi_widget_snapshots').insert({
   user_id:uid,token_hash:hash,snapshot,updated_at:new Date().toISOString()
  });
  if(error)throw Error(error.message||'WIDGET_LINK_ERROR');
  lastUid=uid;lastValue=JSON.stringify(snapshot);lastPush=Date.now();
  // Ensure login/navigation does not create a second pairing token.
  clearRequest();
  // Hand only the revocable widget token to the installed original app.
  // Android intercepts this intent in YawmiMainActivity and refreshes the
  // launcher widget; the browser never receives the account JWT here.
  location.href=widgetIntent(token);
 }catch(_){
  // Keep the request pending for a retry after network or auth recovery.
  nextTry=Date.now()+15000;
 }finally{pairing=false}
}
async function publish(){
 if(busy||!authorized())return;
 const c=cloud(),uid=c.currentUser.id;
 if(uid!==lastUid){lastUid=uid;lastValue=''}
 const snap=makeSnapshot();if(!snap)return;
 const value=JSON.stringify(snap);
 if(value===lastValue||Date.now()-lastPush<12000)return;
 busy=true;lastPush=Date.now();
 try{
  const {error}=await c.sb.from('yawmi_widget_snapshots')
   .update({snapshot:snap,updated_at:new Date().toISOString()})
   .eq('user_id',uid);
  if(!error)lastValue=value;
 }catch(_){}
 finally{busy=false}
}
function tick(){
 if(document.visibilityState!=='visible')return;
 pairFromLauncher();
 publish();
}
function boot(){
 // Do not create ANY section, button, overlay or DOM content for widgets.
 // Native widgets are registered exclusively in the AndroidManifest.
 requestedFromLauncher();
 tick();
 setInterval(tick,10000);
 document.addEventListener('visibilitychange',tick);
 window.addEventListener('online',tick);
 window.addEventListener('pageshow',tick);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
else boot();
window.YawmiNativeWidgets={sync:publish};
})();
