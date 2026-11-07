/* YAWMI Android launcher interaction bridge v2. User-authenticated on-device actions only.
   Task/habit titles are kept in app-private Android storage, never written into the
   public widget aggregate or Android broadcast extras. No Supabase JWT is shared. */
(()=>{'use strict';
if(!/YawmiAndroid\/\d+/.test(navigator.userAgent||''))return;
const api=()=>window.YawmiExtraAPI, cloud=()=>window.YawmiCloud;
let owner='',last='',sending=false,acting=false,wrapped=null;
const authed=()=>!!(cloud()?.configured&&cloud()?.ready&&!cloud()?.conflict&&
  cloud()?.currentUser?.id&&api()?.getState?.()&&!api().getState().demo);
const num=x=>Math.min(1e8,Math.max(0,Math.round(Number(x)||0)));
const toNative=(op,value)=>{location.href='yawmiwidgetdata://'+op+
  (value?'?items='+encodeURIComponent(value):'')};
async function ownerHash(id){
 const buffer=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(id));
 return Array.from(new Uint8Array(buffer),x=>x.toString(16).padStart(2,'0')).join('');
}
function snapshot(hash){
 const a=api(),s=a.getState(),d=a.today(),sum=a.getSummary(d);
 if(!s||!sum)return null;
 const pendingTasks=(sum.tasks||[]).filter(t=>!s.daily?.[d]?.tasks?.[t.id]).slice(0,4);
 const rec=s.daily?.[d]||{};
 function completedHabit(h){
  if(h.id==='reading')return (s.bookReadings||[]).filter(x=>x.date===d)
   .reduce((n,r)=>n+Math.max(0,Number(r.pages)||0),0)>=Math.max(1,Number(h.target)||1);
  if(h.id==='quran')return (s.quran?.readings||[]).filter(x=>x.date===d)
   .reduce((n,r)=>n+Math.max(0,Number(r.pages)||0),0)>=Math.max(1,Number(h.target)||1);
  if(h.id==='water')return Math.max(Number(rec.waterMl)||0,(Number(rec.habits?.water)||0)*250)
    >=Math.max(250,Number(s.waterPrefs?.goalMl)||2000);
  return Number(rec.habits?.[h.id]||0)>=Math.max(1,Number(h.target)||1);
 }
 const pendingHabits=(sum.habits||[]).filter(h=>!completedHabit(h)).slice(0,4);
 const row=x=>({id:String(x.id||'').slice(0,64),title:String(x.title||'')
  .replace(/[\r\n\t]/g,' ').trim().slice(0,38)});
 const money=s.finance||{},month=d.slice(0,7);
 const moneyHidden=window.YawmiLife?.isPrivacyLocked?.('money')===true;
 function total(type){
  if(moneyHidden)return 0;
  return (money.transactions||[]).filter(t=>t.type===type&&String(t.date||'').startsWith(month))
    .reduce((n,t)=>n+Math.max(0,Number(t.amount)||0),0);
 }
 const xp=num(a.getScores()?.xp),goals=Array.isArray(s.goals)?s.goals:[];
 return {owner:hash,day:d,progress:num(sum.pct),
  tasksDone:num(sum.taskDone),tasksTotal:num(sum.tasks?.length),
  habitsDone:num(sum.habitDone),habitsTotal:num(sum.habits?.length),
  xp,level:num(a.getLevelInfo(xp)?.level),streak:num(a.getStreak?.()),
  goalsDone:num(goals.filter(g=>Number(g.target)>0&&Number(g.progress)>=Number(g.target)).length),
  goalsTotal:num(goals.length),booksCount:num(s.books?.length),
  waterMl:num((Number(sum.water)||0)*250),waterGoalMl:num(s.waterPrefs?.goalMl||2000),
  readingPages:num((s.bookReadings||[]).filter(r=>r.date===d).reduce(
   (n,r)=>n+Math.max(0,Number(r.pages)||0),0)),
  moneyHidden:moneyHidden?1:0,moneyIncome:num(total('income')),moneyExpense:num(total('expense')),
  moneyCurrency:/^[A-Z]{3}$/.test(money.currency||'SAR')?money.currency:'SAR',
  todayTasks:pendingTasks.map(row),todayHabits:pendingHabits.map(row)};
}
async function sync(force=false){
 if(sending)return;
 if(!authed()){
  if(owner&&cloud()?.ready&&!cloud()?.currentUser?.id){owner='';last='';toNative('clear')}
  return;
 }
 sending=true;
 try{
  const uid=cloud().currentUser.id;
  if(uid!==owner){owner=uid;last=''}
  const payload=JSON.stringify(snapshot(await ownerHash(uid)));
  if(payload!=='null'&&(force||payload!==last)){last=payload;toNative('sync',payload)}
 }catch(_){/* Keep last known private snapshot offline. */}
 finally{sending=false}
}
function handleAction(){
 if(acting||!authed())return;
 let url;try{url=new URL(location.href)}catch(_){return}
 if(url.searchParams.get('source')!=='widget')return;
 const op=url.searchParams.get('widgetAction'),id=url.searchParams.get('widgetItem')||'';
 const allowed=new Set(['add-task','add-habit','add-reminder','add-expense','add-income',
 'complete-task','complete-habit','open-habit','refresh-widgets']);
 if(!allowed.has(op)||id&&!/^[A-Za-z0-9_-]{1,64}$/.test(id))return;
 acting=true;
 try{
  const a=api(),s=a.getState(),date=a.today();
  url.searchParams.delete('widgetAction');
  url.searchParams.delete('widgetItem');
  url.searchParams.delete('quick');
  history.replaceState(history.state,'',url.pathname+url.search+url.hash);
  if(op==='refresh-widgets'){void sync(true);return}
  if(op==='complete-task'){
   if(!a.getSummary(date).tasks.some(x=>String(x.id)===id)||s.daily?.[date]?.tasks?.[id])return;
   document.getElementById('goToday')?.click();
   a.goPage('tasks');
   [...document.querySelectorAll('button[data-action="toggleTask"]')]
    .find(b=>b.dataset.id===id)?.click();
   return;
  }
  if(op==='complete-habit'||op==='open-habit'){
   const h=a.getSummary(date).habits.find(x=>String(x.id)===id);
   if(!h)return;
   if(id==='reading'){a.goPage('books');return}
   if(id==='quran'){a.goPage('quran');return}
   document.getElementById('goToday')?.click();
   a.goPage('habits');
   if(op==='complete-habit')[...document.querySelectorAll('button[data-action="habitComplete"]')]
     .find(b=>b.dataset.id===id)?.click();
   return;
  }
  if(op==='add-task'){a.goPage('tasks');document.querySelector('[data-add-task]')?.click();return}
  if(op==='add-habit'){a.goPage('habits');document.querySelector('[data-add-habit]')?.click();return}
  if(op==='add-reminder'){
   a.goPage('calendar');
   const button=document.querySelector('[data-life-rem-new]');
   if(button)button.click();else window.YawmiLifeV36?.showQuick?.('فكرني');
   return;
  }
  if(op==='add-expense'||op==='add-income'){
   a.goPage('money');
   document.querySelector('[data-money-add="'+(op==='add-income'?'income':'expense')+'"]')?.click();
  }
 }finally{acting=false}
}
function hookSave(){
 const a=api();
 if(!a||a===wrapped||typeof a.save!=='function')return;
 const original=a.save;
 a.save=function(...args){const result=original.apply(this,args);
  if(result!==false)setTimeout(()=>sync(),350);
  return result;
 };
 wrapped=a;
}
function tick(){hookSave();handleAction();void sync()}
function boot(){
 tick();setInterval(tick,9000);
 window.addEventListener('online',tick);
 window.addEventListener('pageshow',tick);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)tick()});
}
window.YawmiWidgetActions={sync:()=>sync(true)};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();