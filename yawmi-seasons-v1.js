/* YAWMI Seasonal League V1: season score, private friend codes, open global ranking, archive. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const ranks=[['برونز',0],['سيلفر',400],['جولد',1200],['بلاتينيوم',2500],['دايموند',4000],['كراون',6000],['آيس',8500],['كونكر',12000]];
let questArchive=[],current=null,scope='global',pending=false,lastUser='',lastLoaded=0,loadPromise=null,toast='',toastTimer=0;
const cloud=()=>window.YawmiCloud,app=()=>window.YawmiExtraAPI;
const ready=()=>Boolean(cloud()?.ready&&cloud()?.currentUser?.id&&cloud()?.sb);
const tell=s=>{toast=String(s||'');clearTimeout(toastTimer);toastTimer=setTimeout(()=>{toast='';render()},5000);render()};
const format=v=>Math.max(0,Number(v)||0).toLocaleString('ar-EG');
const medal=m=>({gold:'🥇',silver:'🥈',bronze:'🥉'})[m]||'🎖️';
const daysUntil=iso=>Math.max(0,Math.ceil((Date.parse(iso)-Date.now())/86400000));
function progress(xp){
 const i=Math.max(0,ranks.findLastIndex(r=>xp>=r[1])),now=ranks[i],next=ranks[i+1];
 const pct=next?Math.min(100,100*(xp-now[1])/(next[1]-now[1])):100;
 return {now:now[0],next:next?.[0]||'الرتبة الأعلى',remaining:next?next[1]-xp:0,pct};
}
function render(){
 const root=$('ymSeasonPanel');if(!root)return;
 if(!ready()){root.innerHTML='<h3>🏆 المنافسة الموسمية</h3><p class="muted">سجّل الدخول لعرض موسمك.</p>';return;}
 const d=current;
 if(!d){root.innerHTML='<div class="ym-league-title"><h3>🏆 المنافسة الموسمية</h3><span>جاري تحميل البيانات الآمنة...</span></div>';return;}
 const mine=d.mine||{xp:0,rank:'برونز',activity_days:0},p=d.profile||{},season=d.season||{};
 const prog=progress(mine.xp||0),leaders=Array.isArray(d.leaders)?d.leaders:[],awards=Array.isArray(d.awards)?d.awards:[],
 req=Array.isArray(d.requests)?d.requests:[],friends=Array.isArray(d.friends)?d.friends:[];
 const myIndex=leaders.findIndex(x=>x.is_me);
 const quests=[{id:'starter',goal:5,title:'البداية القوية',icon:'🌱'},{id:'steady',goal:20,title:'الثبات الذهبي',icon:'🔥'},{id:'legend',goal:60,title:'أسطورة الموسم',icon:'🌟'}];
 const previous=awards[0],delta=previous?Number(mine.xp)-Number(previous.xp):null;
 root.innerHTML='<div class="ym-league-title"><div><small>YAWMI RANKED · '+escape(season.code||'S01')+'</small><h3>🏆 ساحة المنافسة</h3><p class="muted">الموسم ينتهي '+new Date(season.ends).toLocaleDateString('ar-EG',{timeZone:'Asia/Riyadh',year:'numeric',month:'long',day:'numeric'})+' · متبقي '+format(daysUntil(season.ends))+' يوم</p></div>'
 +'<button type="button" class="btn soft" data-league-refresh '+(pending?'disabled':'')+'>↻ تحديث</button></div>'
 +'<div class="ym-league-stats"><div><small>رتبتك الموسمية</small><strong>'+escape(mine.rank)+'</strong></div><div><small>نقاط الموسم</small><strong>'+format(mine.xp)+' XP</strong></div><div><small>مركزك المعروض</small><strong>'+(myIndex>=0?'#'+format(scope==='friends'?myIndex+1:leaders[myIndex].position):(mine.position&&scope==='global'?'#'+format(mine.position):'—'))+'</strong></div></div>'
 +'<p class="muted mini">'+(delta===null?'أول موسم لك. ابدأ سجلك التنافسي الآن.':'مقارنة بالموسم السابق: '+(delta>=0?'+':'−')+format(Math.abs(delta))+' XP')+'</p>'
 +'<div class="ym-league-progress"><div class="progress"><i style="width:'+prog.pct+'%"></i></div><small>'+(prog.remaining?'باقي '+format(prog.remaining)+' XP إلى '+escape(prog.next):'وصلت لأعلى رتبة موسمية')+'</small></div>'
 +'<div class="ym-league-quests"><h4>🎯 إنجازات الموسم</h4><div class="ym-league-quest-grid">'+quests.map(q=>'<div><span>'+q.icon+' '+q.title+'</span><b>'+(questArchive.some(a=>a.season===season.code&&a.quest===q.id)?'🏅 وسام محفوظ':Number(mine.activity_days)>=q.goal?'✓ مكتمل':format(mine.activity_days)+' / '+q.goal+' أيام')+'</b></div>').join('')+'</div></div>'
 +'<div class="ym-league-tabs"><button type="button" data-league-scope="global" class="'+(scope==='global'?'selected':'')+'">🌍 الجميع</button><button type="button" data-league-scope="friends" class="'+(scope==='friends'?'selected':'')+'">👥 الأصدقاء</button></div>'
 +'<div class="ym-league-list">'+(leaders.length?leaders.map((x,i)=>'<div class="ym-league-person '+(x.is_me?'is-me':'')+'"><b>#'+format(scope==='friends'?i+1:x.position)+'</b><span>'+escape(x.name)+'</span><em>'+escape(x.rank)+'</em><strong>'+format(x.xp)+' XP</strong></div>').join(''):'<p class="muted">لا يوجد مستخدمون في هذا القسم بعد. المنافسة مفتوحة للجميع تلقائيًا.</p>')+'</div>'
 +'<details class="ym-league-details"><summary>⚙️ اسمي وكود إضافة الأصدقاء</summary>'
 +'<p class="muted mini">كود إضافة الأصدقاء خاص بك ولا يظهر في الترتيب العام. شاركه فقط مع من تريد إضافته.</p>'
 +'<div class="ym-private-code"><span id="ymPrivateCode" dir="ltr" aria-live="polite">••••••••</span><button type="button" class="ym-small-btn" data-league-reveal>إظهار كودي</button><button type="button" class="ym-small-btn" data-league-copy>نسخ</button><button type="button" class="ym-small-btn" data-league-share>مشاركة</button></div>'
 +'<label>اسم العرض في المنافسة <input id="ymLeagueName" maxlength="32" value="'+escape(p.name||'المستكشف')+'"></label>'
 +'<label class="ym-league-check"><input type="checkbox" id="ymLeagueFriends" '+(p.friends_enabled?'checked':'')+'> السماح بطلبات الإضافة من الأشخاص الذين أشارك معهم كودي</label>'
 +'<button type="button" class="btn" data-league-save>حفظ إعدادات الخصوصية</button><p class="muted mini">البريد ومحتوى مهامك وعاداتك يظل خاصًا. الترتيب العام مفتوح لجميع الحسابات تلقائيًا. البريد وكود الصداقة وتفاصيل المهام لا تُعرض فيه.</p></details>'
 +'<details class="ym-league-details"><summary>🤝 الأصدقاء وطلبات الإضافة ('+req.length+')</summary>'
 +'<div class="ym-friend-add"><input id="ymFriendCode" placeholder="YM-XXXXXXXXXX" maxlength="20" dir="ltr" aria-label="معرف صديق"><button type="button" class="btn soft" data-league-add>إرسال طلب</button></div>'
 +(req.length?'<h4>طلبات واردة</h4>'+req.map(r=>'<div class="ym-friend-request"><b>'+escape(r.name)+'</b><button type="button" data-league-respond="'+escape(r.request_id)+'" data-answer="yes">قبول</button><button type="button" data-league-respond="'+escape(r.request_id)+'" data-answer="no">رفض</button></div>').join(''):'<p class="muted mini">لا توجد طلبات واردة.</p>')
 +(friends.length?'<p class="muted mini">الأصدقاء: '+friends.map(f=>escape(f.name)).join(' · ')+'</p>':'')+'</details>'
 +'<div class="ym-league-archive"><h4>🎖️ أرشيف المواسم والميداليات</h4>'
 +(questArchive.length?'<div class="ym-quest-medals">'+questArchive.map(q=>'<span>🏅 '+escape(q.season)+' · '+escape(({starter:'البداية القوية',steady:'الثبات الذهبي',legend:'أسطورة الموسم'})[q.quest]||q.quest)+'</span>').join('')+'</div>':'')
 +(awards.length?awards.map(a=>'<div><span>'+medal(a.medal)+' '+escape(a.season)+' · '+escape(a.rank)+'</span><b>'+format(a.xp)+' XP</b><small>'+(a.position?'المركز '+format(a.position):'موسم مكتمل')+' · أعلى رتبة: '+escape(a.peak_rank||a.rank)+'</small></div>').join(''):'<p class="muted mini">أوسمة الموسم الأول تُحفظ هنا بعد نهايته. الأرشيف دائم ولا يُصفّر.</p>')+'</div>'
 +(toast?'<p class="ym-league-toast" role="status">'+escape(toast)+'</p>':'')
 +'<p class="muted mini">XP الموسم منفصل عن XP الشخصي، ويُحسب من المهام والعادات والتركيز المسجل بسقف يومي. الإنجازات الأوفلاين تظهر بعد المزامنة. الترتيب لا يثبت أداء النشاط خارج التطبيق.</p>';
 if(window.YawmiRank&&app()?.getScores)window.YawmiRank.render(app().getScores());
}
async function refresh(force=false){
 if(!ready()){current=null;render();return}
 if(loadPromise)return loadPromise;
 const userId=cloud().currentUser.id;if(userId!==lastUser){current=null;lastUser=userId;lastLoaded=0}
 if(!force&&Date.now()-lastLoaded<35000&&current){render();return}
 const work=async()=>{
  pending=true;render();
  try{
   if(navigator.onLine&&cloud().pending&&!cloud().conflict)await cloud().flush();
   if(navigator.onLine&&!cloud().pending&&!cloud().conflict){
    const sync=await cloud().sb.rpc('yawmi_ranked_sync');
    if(sync.error)throw sync.error;
   }
   const {data,error}=await cloud().sb.rpc('yawmi_ranked_dashboard',{p_scope:scope});
   if(error)throw error;
   current=data;lastLoaded=Date.now();
   const qa=await cloud().sb.rpc('yawmi_quest_archive');if(!qa.error)questArchive=qa.data||[];
   try{localStorage.setItem('yawmi_season_cache_'+userId,JSON.stringify({data,quests:questArchive,at:lastLoaded}))}catch(_){}
  }catch(e){
   if(!current){try{const x=JSON.parse(localStorage.getItem('yawmi_season_cache_'+userId)||'null');if(x?.data){current=x.data;questArchive=x.quests||[]}}catch(_){}}
   toast=navigator.onLine?'بيانات الترتيب غير متاحة الآن: '+String(e.message||'تحقق من الاتصال'):'أنت أوفلاين؛ المعروض آخر ترتيب محفوظ';
  }finally{pending=false;render();}
 };
 loadPromise=work().finally(()=>{loadPromise=null});
 return loadPromise;
}
async function call(method,args){
 if(!ready()||!navigator.onLine)return tell('الاتصال بالإنترنت مطلوب لهذا الإجراء');
 if(pending)return;
 pending=true;render();
 try{const {error}=await cloud().sb.rpc(method,args);if(error)throw error;lastLoaded=0;toast='تم تحديث البيانات';}
 catch(e){toast='تعذر الإجراء: '+(e.message||'خطأ غير معروف')}
 finally{pending=false;await refresh(true);}
}
function wire(){
 if(!$('ymSeasonPanel'))return;
 document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b||!$('ymSeasonPanel')?.contains(b))return;
  if(b.hasAttribute('data-league-refresh'))return refresh(true);
  if(b.dataset.leagueScope){scope=b.dataset.leagueScope;lastLoaded=0;return refresh(true)}
  if(b.hasAttribute('data-league-copy'))return navigator.clipboard?.writeText(current?.profile?.code||'').then(()=>tell('تم نسخ كود الإضافة الخاص بك')).catch(()=>tell('لم يتوفر النسخ تلقائيًا. اضغط إظهار كودي لنسخه يدويًا.'));
  if(b.hasAttribute('data-league-reveal')){const span=$('ymPrivateCode');if(!span)return;
   const isHidden=span.dataset.exposed!=='yes';
   span.textContent=isHidden?(current?.profile?.code||'—'):'••••••••';
   span.dataset.exposed=isHidden?'yes':'no';b.textContent=isHidden?'إخفاء كودي':'إظهار كودي';return;}
  if(b.hasAttribute('data-league-share')){
   const code=current?.profile?.code;
   if(!code)return tell('لم يتم إنشاء كود الإضافة بعد');
   const msg='أضفني في تطبيق يومي باستخدام كود الصداقة الخاص بي: '+code;
   if(navigator.share)return navigator.share({text:msg}).catch(()=>{});
   return navigator.clipboard?.writeText(msg).then(()=>tell('تم نسخ رسالة المشاركة')).catch(()=>tell('استخدم زر إظهار كودي'));
  }
  if(b.hasAttribute('data-league-save'))return call('yawmi_profile_save',{p_name:$('ymLeagueName')?.value||'',p_visible:true,p_friends:!!$('ymLeagueFriends')?.checked});
  if(b.hasAttribute('data-league-add'))return call('yawmi_friend_request',{p_code:($('ymFriendCode')?.value||'').trim().toUpperCase()});
  if(b.dataset.leagueRespond)return call('yawmi_friend_respond_by_request',{p_request_id:b.dataset.leagueRespond,p_accept:b.dataset.answer==='yes'});
 });
 window.addEventListener('online',()=>{if(ready())refresh(true)});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&ready())refresh()});
 setInterval(()=>{if(!ready())return;if(lastUser!==cloud().currentUser.id){current=null;lastLoaded=0;refresh(true)}else if(!current||Date.now()-lastLoaded>300000)refresh()},4000);
 render();
 if(ready())refresh(true);
}
window.YawmiSeasons={get current(){return current?.mine||null},refresh,render,onSignedOut(){
 try{if(lastUser)localStorage.removeItem('yawmi_season_cache_'+lastUser)}catch(_){}current=null;questArchive=[];lastUser='';lastLoaded=0;toast='';render();
}};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();
})();
