/* YAWMI LifeOS V23 — user-owned focus, weekly quests, onboarding and reviews. */
(()=>{'use strict';
const $=id=>document.getElementById(id),api=()=>window.YawmiExtraAPI,S=()=>api()?.getState();
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=x=>Math.max(0,Number(x)||0),whole=x=>Math.max(0,Math.floor(Number(x)||0));
const date=()=>api()?.today()||new Date().toISOString().slice(0,10);
function addDays(day,delta){const x=new Date(day+'T12:00:00');x.setDate(x.getDate()+delta);return [x.getFullYear(),String(x.getMonth()+1).padStart(2,'0'),String(x.getDate()).padStart(2,'0')].join('-')}
function weekStart(day){const x=new Date(day+'T12:00:00');return addDays(day,-x.getDay())}
function weekDays(day){return Array.from({length:7},(_,i)=>addDays(weekStart(day),i))}
function focusRows(){const s=S();return Array.isArray(s?.focusSessions)?s.focusSessions:[]}
const QUESTS=[
{id:'steady',icon:'🌿',title:'نشاط 3 أيام',desc:'أنجز شيئًا في ثلاثة أيام مختلفة خلال الأسبوع',goal:3,xp:80,coins:16,stat:'days'},
{id:'tasks',icon:'🎯',title:'خمس مهام',desc:'أنجز خمس مهام خلال الأسبوع',goal:5,xp:110,coins:20,stat:'tasks'},
{id:'focus',icon:'🔥',title:'جلستا تركيز',desc:'أنهِ جلستي تركيز خلال الأسبوع',goal:2,xp:140,coins:26,stat:'sessions'}];
function weekStats(week){
const s=S();if(!s)return {days:0,tasks:0,sessions:0,focusMinutes:0,bookPages:0,quranPages:0,habitCompletions:0};
const days=weekDays(week),dates=new Set(days),tasks=new Set((s.tasks||[]).map(x=>x.id)),habits=(s.habits||[]);
let active=0,tasksCount=0,habitsCount=0;
for(const day of days){
 const r=s.daily?.[day]||{};
 const done=Object.keys(r.tasks||{}).filter(id=>r.tasks[id]&&tasks.has(id)).length;
 const hCount=habits.filter(h=>h.active!==false&&h.id!=='reading'&&h.id!=='quran'&&h.id!=='water'&&n(r.habits?.[h.id])>=Math.max(1,n(h.target))).length;
 const water=n(r.waterMl)>0||n(r.water)>0;
 const read=(s.bookReadings||[]).some(x=>x.date===day&&(s.books||[]).some(b=>b.id===x.bookId));
 const quran=(s.quran?.readings||[]).some(x=>x.date===day);
 const focused=focusRows().some(x=>x.date===day);
 if(done+hCount>0||water||read||quran||focused)active++;
 tasksCount+=done;habitsCount+=hCount;
}
const sessions=focusRows().filter(x=>dates.has(x.date));
return {days:active,tasks:tasksCount,sessions:sessions.length,focusMinutes:sessions.reduce((a,r)=>a+n(r.minutes),0),habitCompletions:habitsCount,
bookPages:(s.bookReadings||[]).filter(x=>dates.has(x.date)&&(s.books||[]).some(b=>b.id===x.bookId)).reduce((a,x)=>a+n(x.pages),0),
quranPages:(s.quran?.readings||[]).filter(x=>dates.has(x.date)).reduce((a,x)=>a+n(x.pages),0)};
}
function focusXP(day){return Math.min(160,focusRows().filter(x=>x.date===day).reduce((sum,x)=>sum+Math.min(60,n(x.minutes))*2,0))}
function weeklyBonus(day){
const claims=Array.isArray(S()?.weeklyClaims)?S().weeklyClaims:[];
let xp=0,coins=0;
for(const claim of claims.filter(x=>x.date===day)){
 const def=QUESTS.find(x=>x.id===claim.quest),start=weekStart(claim.week||claim.date);
 if(!def||start!==weekStart(day)||weekStats(start)[def.stat]<def.goal)continue;
 xp+=def.xp;coins+=def.coins;
}
return {xp,coins};
}
let focus={running:false,endAt:0,remaining:25*60,minutes:25,goal:'',targetType:'general',finished:false,sessionId:''},timer=null,undoFn=null,undoTimer=null,openedOnboard=false,reviewWeek=weekStart(date()),initDone=false,lastAccountId=null;
function focusTargets(type){
 const s=S()||{};
 if(type==='habit')return (s.habits||[]).filter(h=>h.active!==false);
 if(type==='task')return (s.tasks||[]).filter(t=>!t.archived);
 if(type==='goal')return (s.goals||[]).filter(g=>whole(g.progress)<whole(g.target));
 return [];
}
const focusTypeName=type=>({general:'جلسة عامة',habit:'عادة',task:'مهمة',goal:'هدف أو مشروع'}[type]||'جلسة عامة');
function updateFocusTarget(){
 const type=focus.targetType||'general',select=$('ymFocusGoal'),label=$('ymFocusTargetWrap');
 if(!select||!label)return;
 const general=type==='general';label.hidden=general;
 const items=focusTargets(type);
 select.innerHTML='<option value="">'+(general?'جلسة عامة':'اختر '+focusTypeName(type))+'</option>'+items.map(item=>'<option value="'+esc(item.id)+'">'+esc(item.title)+'</option>').join('');
 if(items.some(item=>String(item.id)===String(focus.goal)))select.value=focus.goal;
 else {focus.goal='';select.value=''}
}
const focusStoreKey=()=>{const u=window.YawmiCloud?.currentUser?.id;return u?'yawmi_focus_v1_'+u:null};
function saveFocusState(){
 const key=focusStoreKey();if(!key)return;
 try{localStorage.setItem(key,JSON.stringify({...focus,updatedAt:Date.now()}))}catch(_){}
}
function restoreFocusState(){
 const key=focusStoreKey();if(!key)return;
 try{
  const f=JSON.parse(localStorage.getItem(key)||'null');
  if(!f||!Number.isFinite(Number(f.minutes))||Number(f.minutes)<5||Number(f.minutes)>60)return;
  if(Date.now()-Number(f.updatedAt||0)>7*86400000)return;
  const remaining=Number(f.remaining);
  focus={running:!!f.running,endAt:Number(f.endAt)||0,
   remaining:Number.isFinite(remaining)?Math.max(0,Math.min(3600,remaining)):f.minutes*60,
   minutes:Number(f.minutes),goal:String(f.goal||''),targetType:['general','habit','task','goal'].includes(f.targetType)?f.targetType:'general',
   finished:!!f.finished,sessionId:String(f.sessionId||'')};
  if(focus.running&&focus.endAt<=Date.now()){focus.running=false;focus.remaining=0;focus.finished=true;saveFocusState();}
 }catch(_){}
}
function focusTime(){return focus.running?Math.max(0,Math.ceil((focus.endAt-Date.now())/1000)):Math.max(0,Math.ceil(focus.remaining))}
function tick(){if(focus.running&&focusTime()<=0){focus.running=false;focus.remaining=0;focus.finished=true;saveFocusState();}const timerEl=$('ymFocusClock');if(timerEl){const remain=focusTime();timerEl.textContent=String(Math.floor(remain/60)).padStart(2,'0')+':'+String(remain%60).padStart(2,'0');}const complete=$('ymFocusFinish');if(complete)complete.hidden=!focus.finished;const start=$('ymFocusStart');if(start)start.textContent=focus.running?'إيقاف مؤقت':focus.remaining<focus.minutes*60?'استكمال':'ابدأ التركيز'}
function focusStart(){
 if(focus.finished){api().notify('احفظ الجلسة المكتملة أو ابدأ جلسة جديدة');return}
 if(focus.running){focus.remaining=focusTime();focus.running=false}
 else{
  if(focus.remaining===focus.minutes*60){
   focus.minutes=Math.max(5,Math.min(60,whole($('ymFocusMinutes')?.value)||25));focus.remaining=focus.minutes*60;
   focus.targetType=$('ymFocusType')?.value||'general';
   focus.goal=focus.targetType==='general'?'':$('ymFocusGoal')?.value||'';
   focus.sessionId=focus.sessionId||api().uid();
   if(focus.targetType!=='general'&&!focus.goal){api().notify('اختار '+focusTypeName(focus.targetType)+' قبل بدء الجلسة');return}
  }
  focus.endAt=Date.now()+focus.remaining*1000;focus.running=true;
 }
 saveFocusState();tick();
 const locked=focus.running||focus.finished||focus.remaining<focus.minutes*60;
 for(const id of ['ymFocusMinutes','ymFocusType','ymFocusGoal'])if($(id))$(id).disabled=locked;
}
function focusReset(){if(focus.running||focus.finished||focus.remaining<focus.minutes*60){if(!confirm('تصفير المؤقت الحالي دون احتساب XP؟'))return}focus.running=false;focus.finished=false;focus.remaining=focus.minutes*60;focus.goal='';focus.targetType='general';focus.sessionId='';saveFocusState();renderFocus()}
function finishFocus(){
 tick();if(!focus.finished)return;
 const s=S();if(!s)return;
 const kind=focus.targetType||'general',ref=focus.goal||null;
 const target=focusTargets(kind).find(item=>String(item.id)===String(ref));
 const entry={id:focus.sessionId||api().uid(),date:date(),minutes:focus.minutes,goalId:kind==='goal'?ref:null,linkType:kind,linkId:kind==='general'?null:ref,linkTitle:target?.title||null,at:new Date().toISOString()};
 if(!Array.isArray(s.focusSessions))s.focusSessions=[];
 if(s.focusSessions.some(x=>x.id===entry.id)){focus={running:false,endAt:0,remaining:25*60,minutes:25,goal:'',targetType:'general',finished:false,sessionId:''};saveFocusState();renderFocus();return}
 s.focusSessions.push(entry);
 if(!s.daily[entry.date])s.daily[entry.date]={habits:{},tasks:{},water:0,mood:0,note:''};
 api().activity('focus','أنهيت '+entry.minutes+' دقيقة تركيز'+(entry.linkTitle?' على '+entry.linkTitle:''),entry.date);
 focus={running:false,endAt:0,remaining:25*60,minutes:25,goal:'',targetType:'general',finished:false,sessionId:''};
 saveFocusState();api().save();api().render();api().notify('جلسة تركيز مكتملة ✦');
}
function deleteFocus(id){
 const s=S(),f=focusRows().find(x=>x.id===id);if(!f||!confirm('حذف جلسة التركيز هذه؟ ستنخفض نقاط XP وأي تحديات لم تعد مكتملة.'))return;
 s.focusSessions=s.focusSessions.filter(x=>x.id!==id);
 api().activity('focus','حذفت جلسة تركيز',date());api().save();api().render();
}
function renderFocus(){
 const box=$('ymFocusPanel');if(!box||!S())return;
 const locked=focus.running||focus.finished||focus.remaining<focus.minutes*60,disabled=locked?'disabled':'';
 box.innerHTML='<div class="ym-section-head"><div><small>FOCUS SESSION</small><h3>⏳ جلسة تركيز</h3></div><b id="ymFocusClock">25:00</b></div>'
 +'<div class="ym-focus-fields"><label>المدة<select id="ymFocusMinutes" '+disabled+'><option value="25">25 دقيقة</option><option value="45">45 دقيقة</option><option value="15">15 دقيقة</option><option value="50">50 دقيقة</option></select></label>'
 +'<label>نوع الجلسة<select id="ymFocusType" '+disabled+'><option value="general">جلسة عامة</option><option value="habit">عادة</option><option value="task">مهمة</option><option value="goal">هدف أو مشروع</option></select></label>'
 +'<label id="ymFocusTargetWrap">اختار العنصر<select id="ymFocusGoal" '+disabled+'></select></label></div>'
 +'<div class="ym-focus-actions"><button class="btn" id="ymFocusStart">'+(focus.running?'إيقاف مؤقت':'ابدأ التركيز')+'</button><button class="btn soft" id="ymFocusReset">تصفير</button><button class="btn" id="ymFocusFinish" hidden>✓ تسجيل الجلسة المكتملة</button></div><p class="muted mini">الجلسة المرتبطة بعادة أو مهمة تُسجل كوقت تركيز فقط، ولا تنجزها تلقائيًا. تُحتسب النقاط بعد انتهاء الوقت وتأكيد الإكمال.</p>'
 +'<div id="ymFocusRecent"></div>';
 if([15,25,45,50].includes(focus.minutes))$('ymFocusMinutes').value=String(focus.minutes);
 $('ymFocusType').value=focus.targetType||'general';
 updateFocusTarget();
 const last=focusRows().slice(-3).reverse();
 $('ymFocusRecent').innerHTML=last.length?'<div class="ym-focus-log">'+last.map(x=>{
  const kind=x.linkType||(x.goalId?'goal':'general'),ref=x.linkId||x.goalId;
  const item=focusTargets(kind).find(item=>String(item.id)===String(ref));
  const name=item?.title||x.linkTitle;
  return '<div><span>✓ '+whole(x.minutes)+' دقيقة · '+esc(x.date)+(name?' · '+esc(focusTypeName(kind))+': '+esc(name):'')+'</span><button type="button" data-ym-focus-delete="'+esc(x.id)+'" title="حذف الجلسة">🗑</button></div>';
 }).join('')+'</div>':'';
 tick();
}
function renderChallenges(){
 const box=$('ymWeeklyChallenges');if(!box||!S())return;
 const week=weekStart(date()),stats=weekStats(week),claimed=Array.isArray(S().weeklyClaims)?S().weeklyClaims:[];
 box.innerHTML='<div class="ym-section-head"><div><small>WEEKLY QUESTS</small><h3>🏆 تحديات الأسبوع</h3></div><span class="ym-week-range">'+esc(week)+' إلى '+esc(addDays(week,6))+'</span></div>'
 +'<div class="ym-quest-grid">'+QUESTS.map(q=>{const value=Math.min(q.goal,stats[q.stat]),done=value>=q.goal,claimedNow=claimed.some(x=>x.week===week&&x.quest===q.id);
 return '<article class="ym-quest"><div><span>'+q.icon+'</span><b>'+q.title+'</b></div><p>'+q.desc+'</p><div class="progress"><i style="width:'+(100*value/q.goal)+'%"></i></div><small>'+value+' / '+q.goal+'</small><button '+(claimedNow?'data-ym-unclaim="'+q.id+'"':'data-ym-claim="'+q.id+'"')+' '+(!done&&!claimedNow?'disabled':'')+'>'+(claimedNow?'↶ التراجع عن الاستلام':done?'استلام المكافأة':'قيد التقدم')+'</button></article>'}).join('')+'</div>';
}
function claimQuest(id){
 const q=QUESTS.find(x=>x.id===id),s=S(),week=weekStart(date());
 if(!q||!s||weekStats(week)[q.stat]<q.goal)return;
 if(!Array.isArray(s.weeklyClaims))s.weeklyClaims=[];
 if(s.weeklyClaims.some(x=>x.week===week&&x.quest===id))return;
 s.weeklyClaims.push({id:api().uid(),week,date:date(),quest:id});
 if(!s.daily[date()])s.daily[date()]={habits:{},tasks:{},water:0,mood:0,note:''};
 api().activity('reward','استلمت مكافأة تحدي '+q.title,date());api().save();api().render();api().notify('مكافأة تحدي الأسبوع! ✦');
}
function unclaimQuest(id){
 const s=S(),week=weekStart(date()),claim=(s?.weeklyClaims||[]).find(x=>x.quest===id&&x.week===week);
 if(!claim||!confirm('التراجع عن مكافأة هذا التحدي؟ سيتم خصم نقاطها وعملاتها.'))return;
 s.weeklyClaims=s.weeklyClaims.filter(x=>x.id!==claim.id);
 api().activity('reward','تراجعت عن مكافأة تحدي '+id,date());api().save();api().render();
}
function renderReview(){
 const box=$('ymWeeklyReview');if(!box||!S())return;
 const d=reviewWeek,stats=weekStats(d),prior=weekStats(addDays(d,-7));
 const trend=stats.days-prior.days;
 box.innerHTML='<div class="ym-section-head"><div><small>WEEKLY REVIEW</small><h3>📊 مراجعتك الأسبوعية</h3></div><label>الأسبوع<select id="ymReviewWeek"></select></label></div>'
 +'<div class="ym-review-stats">'+[
 ['أيام نشاط',stats.days+'/7'],['مهام',stats.tasks],['عادات مكتملة',stats.habitCompletions],
 ['تركيز',stats.focusMinutes+' د'],['قراءة كتب',stats.bookPages+' ص'],['قرآن',stats.quranPages+' ص']
 ].map(x=>'<div><strong>'+x[1]+'</strong><small>'+x[0]+'</small></div>').join('')+'</div><p class="ym-review-message">'+(trend>0?'نشاطك زاد عن الأسبوع السابق بـ'+trend+' يوم 👏':trend<0?'الأسبوع السابق كان أنشط بـ'+(-trend)+' يوم، ودي فرصة ترجع بخطوة صغيرة.':'استمراريتك مستقرة عن الأسبوع السابق.')+'</p>';
 const weeks=Array.from({length:26},(_,i)=>addDays(weekStart(date()),-7*i));
 $('ymReviewWeek').innerHTML=weeks.map(w=>'<option value="'+w+'">'+w+' إلى '+addDays(w,6)+'</option>').join('');
 $('ymReviewWeek').value=d;
}
function showOnboard(){
 if(openedOnboard||!$('ymOnboard')||!S()||!window.YawmiCloud?.ready||S().onboarding?.completed)return;
 if(Number(window.YawmiCloud.revision)>1)return;
 if(Object.keys(S().daily||{}).length>0||(S().history||[]).length||(S().books||[]).length)return;
 openedOnboard=true;
 const h=S().habits||[];
 $('ymOnboardChoices').innerHTML=h.map((x,i)=>'<label><input type="checkbox" value="'+esc(x.id)+'" '+(['fajr','reading','water'].includes(x.id)?'checked':'')+'> '+esc(x.icon||'✦')+' '+esc(x.title)+'</label>').join('');
 $('ymOnboard').showModal();
}
function applyOnboard(skip=false){
 const s=S(),checked=Array.from($('ymOnboardChoices').querySelectorAll('input:checked')).map(x=>x.value);
 if(!skip&&(checked.length<1||checked.length>3)){api().notify('اختر من عادة إلى 3 عادات كبداية');return}
 const wanted=skip?['fajr','reading','water']:checked;
 s.habits.forEach(h=>{h.active=wanted.includes(h.id)});
 if(Array.isArray(s.tasks)&&s.tasks.length===4&&s.tasks.every(t=>/^t[1-4]$/.test(t.id)))s.tasks=[];
 const title=skip?'':$('ymOnboardGoal').value.trim().slice(0,100);
 if(title){if(!Array.isArray(s.goals))s.goals=[];s.goals.push({id:api().uid(),title,kind:'custom',unit:'خطوة',target:10,progress:0,progressEntries:[]})}
 s.onboarding={completed:true,habits:wanted,at:new Date().toISOString()};
 $('ymOnboard').close();api().save();api().render();api().notify('أهلًا بيك في يومي ✦');
}
function offerUndo(label,fn){
 undoFn=fn;
 const box=$('ymUndoBar');if(!box)return;
 $('ymUndoLabel').textContent=label;box.hidden=false;clearTimeout(undoTimer);undoTimer=setTimeout(()=>{box.hidden=true;undoFn=null},11000);
}
function doUndo(){
 if(!undoFn)return;const fn=undoFn;undoFn=null;$('ymUndoBar').hidden=true;clearTimeout(undoTimer);
 try{fn();api().notify('تم التراجع عن آخر تعديل')}catch(_){api().notify('تعذر التراجع، راجع سجل الإنجاز')}
}
function navigateShortcut(){
 if(!window.YawmiCloud?.ready||!api())return;
 const value=new URLSearchParams(location.search).get('quick');
 if(!['tasks','quran','focus','water'].includes(value))return;
 try{history.replaceState(null,'',location.pathname)}catch(_){}
 if(value==='quran')api().goQuran();
 if(value==='tasks')api().goTasks?.();
 if(value==='focus'||value==='water'){api().goHome();const target=$(value==='focus'?'ymFocusPanel':'waterGlasses');target?.scrollIntoView({behavior:'smooth',block:'center'});}
}
function onAccountReady(){
 if(!window.YawmiCloud?.ready)return;
 const userId=window.YawmiCloud.currentUser?.id||null;
 if(userId&&userId!==lastAccountId){
  lastAccountId=userId;
  focus={running:false,endAt:0,remaining:25*60,minutes:25,goal:'',targetType:'general',finished:false,sessionId:''};
  restoreFocusState();
  openedOnboard=false;
  undoFn=null;if($('ymUndoBar'))$('ymUndoBar').hidden=true;clearTimeout(undoTimer);
 }
 render();showOnboard();navigateShortcut();
}
function render(){renderFocus();renderChallenges();renderReview()}
function wire(){
 if(initDone||!$('ymEnhancementsHome'))return;initDone=true;
 $('ymOnboardContinue')?.addEventListener('click',()=>applyOnboard(false));
 $('ymOnboardSkip')?.addEventListener('click',()=>applyOnboard(true));
 $('ymUndoAction')?.addEventListener('click',doUndo);
 document.addEventListener('change',e=>{
  if(e.target.id==='ymFocusMinutes'&&!focus.running&&!focus.finished&&focus.remaining===focus.minutes*60){focus.minutes=whole(e.target.value)||25;focus.remaining=focus.minutes*60;saveFocusState();tick()}
  if(e.target.id==='ymFocusType'&&!focus.running&&!focus.finished&&focus.remaining===focus.minutes*60){focus.targetType=e.target.value;focus.goal='';saveFocusState();updateFocusTarget()}
  if(e.target.id==='ymFocusGoal'&&!focus.running&&!focus.finished&&focus.remaining===focus.minutes*60){focus.goal=e.target.value;saveFocusState()}
  if(e.target.id==='ymReviewWeek'){reviewWeek=e.target.value;renderReview();}
 });
 document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
  if(b.id==='ymFocusStart')focusStart();
  if(b.id==='ymFocusReset')focusReset();
  if(b.id==='ymFocusFinish')finishFocus();
  if(b.dataset.ymFocusDelete)deleteFocus(b.dataset.ymFocusDelete);
  if(b.dataset.ymClaim)claimQuest(b.dataset.ymClaim);if(b.dataset.ymUnclaim)unclaimQuest(b.dataset.ymUnclaim);
 });
 timer=setInterval(tick,950);
 render();
 if(window.YawmiCloud?.ready)onAccountReady();
}
window.YawmiFeatures={render,onAccountReady,weeklyBonus,focusXP,weekStats,offerUndo,onSignedOut(){
 const key=focusStoreKey();if(key)try{localStorage.removeItem(key)}catch(_){}
 focus={running:false,endAt:0,remaining:25*60,minutes:25,goal:'',targetType:'general',finished:false,sessionId:''};lastAccountId=null;render();
}};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();
})();