/* YAWMI V30: per-habit strength and trend analytics; private, offline-first, no new XP. */
(()=>{'use strict';
const $=id=>document.getElementById(id),api=()=>window.YawmiExtraAPI;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
let chosen='';
const n=x=>Math.max(0,Number(x)||0);
function shift(day,delta){const d=new Date(day+'T12:00:00');d.setDate(d.getDate()+delta);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
function today(){return api()?.today?.()||new Date().toISOString().slice(0,10)}
function completed(h,day,s){const value=s.daily?.[day]?.habits?.[h.id];if(value===true)return 1>=Math.max(1,n(h.target)||1);
return n(value)>=Math.max(1,n(h.target)||1)}
function calculate(h,s,now){
 const days=Array.from({length:90},(_,i)=>shift(now,i-89)),status=days.map(d=>completed(h,d,s)?1:0);
 let strength=0,current=0,best=0,count7=0,count30=0,prev7=0;
 for(let i=0;i<90;i++){
  strength=Math.round(strength*.9+status[i]*10);
  current=status[i]?current+1:0;best=Math.max(best,current);
  if(i>=83)count7+=status[i];
  if(i>=60)count30+=status[i];
  if(i>=76&&i<83)prev7+=status[i];
 }
 let streak=0;for(let i=89;i>=0;i--){if(status[i])streak++;else break;}
 const best30=status.slice(60).reduce((a,v)=>{a.c=v?a.c+1:0;a.max=Math.max(a.max,a.c);return a},{c:0,max:0}).max;
 return {days,status,strength,streak,best,best30,count7,count30,prev7,rate7:Math.round(count7/7*100),
 rate30:Math.round(count30/30*100),delta:count7-prev7};
}
function render(){
 const box=$('ymHabitInsights'),s=api()?.getState?.();
 if(!box||!s)return;
 const hs=(s.habits||[]).filter(h=>h&&h.active!==false);
 if(!hs.length){box.innerHTML='<h3>📈 قوة العادات</h3><p class="muted">أضف عادة نشطة علشان تشوف قوتها وتطورها.</p>';return}
 if(!hs.some(h=>h.id===chosen))chosen=hs[0].id;
 const h=hs.find(x=>x.id===chosen),a=calculate(h,s,today());
 const tip=a.strength>=85?'ثبات ممتاز':a.strength>=55?'عادتك بتتقوّى':a.strength>=25?'في طريقك للثبات':'خطوات صغيرة تصنع عادة ثابتة';
 const heat=a.days.slice(-30).map((d,i)=>'<span class="ym-habit-day '+(a.status[i+60]?'done':'')+'" title="'+esc(d)+' '+(a.status[i+60]?'✓':'—')+'" aria-label="'+esc(d)+(a.status[i+60]?' مكتمل':' غير مكتمل')+'"></span>').join('');
 box.innerHTML='<div class="ym-habit-insights-heading"><div><h3>📈 قوة العادة</h3><p class="muted mini">تحليل آخر 90 يومًا، ونتائج آخر 30 يومًا. عدم الالتزام بيقلّل القوة تدريجيًا، مش بيصفرها.</p></div>'
 +'<select id="ymHabitInsightPick" aria-label="اختيار العادة">'+hs.map(x=>'<option value="'+esc(x.id)+'" '+(x.id===chosen?'selected':'')+'>'+esc(x.icon||'✦')+' '+esc(x.title)+'</option>').join('')+'</select></div>'
 +'<div class="ym-habit-insight-grid"><div><small>قوة العادة</small><b>'+a.strength+'%</b><span>'+tip+'</span></div>'
 +'<div><small>التزام 7 أيام</small><b>'+a.rate7+'%</b><span>'+a.count7+' / 7 أيام</span></div>'
 +'<div><small>التزام 30 يومًا</small><b>'+a.rate30+'%</b><span>'+a.count30+' / 30 يوم</span></div>'
 +'<div><small>سلسلة اليوم</small><b>'+a.streak+' يوم</b><span>أفضل سلسلة في 30 يومًا: '+a.best30+'</span></div></div>'
 +'<div class="ym-habit-strength-track"><i style="width:'+a.strength+'%"></i></div>'
 +'<div class="ym-habit-trend"><span>آخر 30 يومًا</span><strong>'+(a.delta>0?'↗ +':a.delta<0?'↘ ':'→ ')+Math.abs(a.delta)+' يوم مقارنة بالأسبوع السابق</strong></div>'
 +'<div class="ym-habit-heat" role="group" aria-label="نشاط العادة آخر 30 يومًا">'+heat+'</div>'
 +'<p class="muted mini">هذه الإحصائيات شخصية، ولا تضيف XP إضافية إلى رصيدك. تغييراتك تظهر فورًا حتى دون إنترنت.</p>';
}
function wire(){document.addEventListener('change',e=>{if(e.target?.id==='ymHabitInsightPick'){chosen=e.target.value;render()}});render();}
window.YawmiHabitInsights={render,calculate};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();
})();
