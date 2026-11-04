/* YAWMI V30: invitation-only friend challenges with server-verified, per-day progress. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const e=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const numbers=x=>Math.max(0,Number(x)||0).toLocaleString('ar-EG');
const types={days:'أيام نشاط',tasks:'مهام مكتملة',habits:'عادات مكتملة',focus:'دقائق تركيز'};
const states={pending:'بانتظار الموافقة',active:'جاري',declined:'تم الرفض',completed:'🏅 وسام مشترك',expired:'انتهى'};
let items=[],friends=[],busy=false,loadedAt=0,lastAccount='',message='',timer=0,promise=null;
const cloud=()=>window.YawmiCloud,ready=()=>Boolean(cloud()?.ready&&cloud()?.sb&&cloud()?.currentUser?.id);
function render(){
 let root=$('ymChallengesPanel');if(!root)return;
 if(!ready()){root.innerHTML='<h3>🤝 تحديات الأصدقاء</h3><p class="muted mini">سجّل الدخول علشان تبدأ تحدّيًا مع صديق.</p>';return}
 let options=friends.filter(x=>x?.friend_ref&&x?.name);
 root.innerHTML='<div class="ym-challenge-heading"><div><h3>🤝 تحديات الأصدقاء</h3><p class="muted mini">اتفقوا على هدف واحد، والوسام يتحفظ لما الاتنين يحققوه. من غير احتساب XP مرتين.</p></div><button type="button" class="btn soft" data-ym-challenge-refresh '+(busy?'disabled':'')+'>↻ تحديث</button></div>'
 +(options.length?'<div class="ym-challenge-create"><label>الصديق<select id="ymChallengeFriend">'+options.map(x=>'<option value="'+e(x.friend_ref)+'">'+e(x.name)+'</option>').join('')+'</select></label>'
 +'<label>نوع التحدي<select id="ymChallengeMetric"><option value="days">أيام نشاط</option><option value="tasks">مهام</option><option value="habits">عادات</option><option value="focus">دقائق تركيز</option></select></label>'
 +'<label>الهدف<input id="ymChallengeGoal" type="number" min="1" max="150" value="5" inputmode="numeric"></label>'
 +'<label>المدة<select id="ymChallengeDuration"><option value="7">7 أيام</option><option value="14">14 يومًا</option><option value="21">21 يومًا</option><option value="28">28 يومًا</option></select></label>'
 +'<button type="button" class="btn" data-ym-challenge-create '+(busy?'disabled':'')+'>إرسال التحدي</button></div>'
 :'<p class="muted mini">أضف صديقًا أولًا من قسم «الأصدقاء وطلبات الإضافة» في ساحة المنافسة، ثم اختَر التحدي المناسب.</p>')
 +'<div class="ym-challenge-rows">'+(items.length?items.map(x=>{
 const target=Math.max(1,Number(x.target)||1),me=Math.min(100,100*Number(x.mine||0)/target),
 peer=Math.min(100,100*Number(x.theirs||0)/target);
 const when=x.ends?' · حتى '+new Date(x.ends).toLocaleDateString('ar-EG',{timeZone:'Asia/Riyadh'}):'';
 return '<div class="ym-challenge-card"><div class="ym-challenge-card-title"><strong>'+e(x.peer)+'</strong><span>'+e(states[x.state]||x.state)+when+'</span></div>'
  +'<p>'+e(types[x.metric]||x.metric)+' · المطلوب لكل شخص '+numbers(target)+'</p>'
  +'<div class="ym-challenge-bar-label">أنت <b>'+numbers(x.mine||0)+' / '+numbers(target)+'</b></div><div class="ym-challenge-bar"><i style="width:'+me+'%"></i></div>'
  +'<div class="ym-challenge-bar-label">صديقك <b>'+numbers(x.theirs||0)+' / '+numbers(target)+'</b></div><div class="ym-challenge-bar"><i style="width:'+peer+'%"></i></div>'
  +(x.badge?'<p class="ym-challenge-badge">🏅 وسام التحدي محفوظ لكما</p>':'')
  +(x.state==='pending'&&x.incoming?'<div class="ym-challenge-actions"><button data-ym-challenge-reply="'+e(x.id)+'" data-answer="yes" '+(busy?'disabled':'')+'>✓ قبول</button><button data-ym-challenge-reply="'+e(x.id)+'" data-answer="no" '+(busy?'disabled':'')+'>رفض</button></div>':'')
  +'</div>'}).join(''):'<p class="muted mini">مفيش تحديات حتى الآن. ابعت أول دعوة لصديقك.</p>')+'</div>'
 +(message?'<p class="ym-challenge-message" role="status">'+e(message)+'</p>':'')
 +'<p class="muted mini">التحديات تستخدم النقاط اليومية المعتمدة على الخادم. سجل الإنجاز الشخصي يظل خاصًا.</p>';
}
function note(s){message=String(s||'');clearTimeout(timer);timer=setTimeout(()=>{message='';render()},6000);render()}
async function reload(force=false){
 if(!ready()){items=[];friends=[];lastAccount='';render();return}
 const u=cloud().currentUser.id;
 if(lastAccount!==u){lastAccount=u;items=[];friends=[];loadedAt=0}
 if(!force&&Date.now()-loadedAt<90000){render();return}
 if(promise)return promise;
 promise=(async()=>{
 busy=true;render();
 try{
  const [a,b]=await Promise.all([
   cloud().sb.rpc('yawmi_challenges_dashboard'),
   cloud().sb.rpc('yawmi_ranked_dashboard',{p_scope:'friends'})
  ]);
  if(a.error)throw a.error;if(b.error)throw b.error;
  items=Array.isArray(a.data)?a.data:[];
  friends=Array.isArray(b.data?.friends)?b.data.friends:[];
  loadedAt=Date.now();
 }catch(err){note('تعذّر تحديث التحديات: '+(err?.message||'تأكد من الاتصال'))}
 finally{busy=false;render();}
 })().finally(()=>{promise=null});
 return promise;
}
async function action(fn,args){
 if(!ready()||!navigator.onLine)return note('الاتصال بالإنترنت مطلوب لإرسال أو قبول التحديات.');
 if(busy)return;
 busy=true;render();
 try{
  const {data,error}=await cloud().sb.rpc(fn,args);
  if(error)throw error;
  message=fn==='yawmi_challenge_create'?'تم إرسال دعوة التحدي':'تم تحديث الدعوة';
  loadedAt=0;
 }catch(err){message='تعذّر الإجراء: '+(err?.message||'خطأ غير معروف')}
 finally{busy=false;await reload(true);}
}
function wire(){
 if(!$('ymChallengesPanel'))return;
 document.addEventListener('click',ev=>{
  const b=ev.target.closest?.('button');
  if(!b||!$('ymChallengesPanel')?.contains(b))return;
  if(b.hasAttribute('data-ym-challenge-refresh'))return reload(true);
  if(b.hasAttribute('data-ym-challenge-create')){
   const ref=$('ymChallengeFriend')?.value;
   const metric=$('ymChallengeMetric')?.value;
   const target=Number($('ymChallengeGoal')?.value);
   const duration=Number($('ymChallengeDuration')?.value);
   if(!ref||!types[metric]||!Number.isInteger(target)||target<1||target>150||![7,14,21,28].includes(duration)||metric==='days'&&target>duration)
    return note('راجع نوع التحدي والهدف والمدة.');
   return action('yawmi_challenge_create',{p_friend_ref:ref,p_metric:metric,p_target:target,p_duration_days:duration});
  }
  if(b.dataset.ymChallengeReply)return action('yawmi_challenge_respond',{p_challenge_id:b.dataset.ymChallengeReply,p_accept:b.dataset.answer==='yes'});
 });
 window.addEventListener('online',()=>reload(true));
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)reload()});
 setInterval(()=>{if(ready()&&(!items.length||Date.now()-loadedAt>180000||lastAccount!==cloud().currentUser.id))reload()},30000);
 render();if(ready())reload(true);
}
window.YawmiChallenges={refresh:reload,render};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();
})();