/* YAWMI V33: private health records, flexible routines, 90-day/yearly plans, local weekly coach. */
(()=>{'use strict';
const L=()=>window.YawmiLife,$=id=>document.getElementById(id),s=()=>L()?.state(),api=()=>window.YawmiExtraAPI;
const e=x=>L().esc(x),btn=(label,attrs='',variant='soft')=>L().btn(label,attrs,variant);
const field=(label,html)=>L().field(label,html),input=(key,value,type='text',attrs='')=>L().input(key,value,type,attrs);
let healthDate=null,routineDate=null,yearShown=new Date().getFullYear(),editing=null,editingType='',coachPeriod='week';
const today=()=>L().day();
const timeNow=()=>new Date().toISOString();
const safeInt=(n,min,max)=>Number.isInteger(Number(n))&&Number(n)>=min&&Number(n)<=max?Number(n):null;
const dec=(x,min,max,places=1)=>{const v=String(x??'').trim();if(v===''||!/^\d+(\.\d{1,2})?$/.test(v))return null;const n=Number(v);return Number.isFinite(n)&&n>=min&&n<=max?Math.round(n*Math.pow(10,places))/Math.pow(10,places):null};
const opts=(list,selected)=>list.map(([k,v])=>'<option value="'+e(k)+'" '+(String(selected)===String(k)?'selected':'')+'>'+e(v)+'</option>').join('');
const pct=(n,total)=>total?Math.max(0,Math.min(100,Math.round(n/total*100))):0;
const eventDate=(date,n)=>L().add(date,n);
const localDate=d=>L().shortDay(d);
function makeTitle(k,title,copy){return '<div class="yl-hero"><div><span>'+k+'</span><h2>'+title+'</h2><p>'+copy+'</p></div></div>'}
function getHealth(date){return s().lifeHealth.find(x=>x.date===date)}
function healthStats(){
 const todayDate=today(),days=Array.from({length:14},(_,i)=>eventDate(todayDate,i-13));
 const logs=days.map(d=>getHealth(d)).filter(Boolean);
 const sum=(key)=>logs.reduce((n,x)=>n+(Number(x[key])||0),0);
 const stepTotal=sum('steps'),exerciseTotal=sum('exerciseMin');
 const sleepers=logs.filter(x=>Number.isInteger(x.sleepMin)&&x.sleepMin>0);
 const avgSleep=sleepers.length?Math.round(sleepers.reduce((n,x)=>n+x.sleepMin,0)/sleepers.length):null;
 const energy=logs.filter(x=>safeInt(x.energy,1,5)!==null);
 return {days,logs,stepTotal,exerciseTotal,avgSleep,
  avgEnergy:energy.length?(energy.reduce((n,x)=>n+Number(x.energy),0)/energy.length).toFixed(1):null};
}
function health(){
 const root=L().root('health');if(!root)return;const h=healthStats();healthDate=healthDate||today();
 const selected=getHealth(healthDate),latest=s().lifeHealth.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,8);
 const maxSteps=Math.max(1000,...h.days.map(d=>getHealth(d)?.steps||0));
 root.innerHTML=makeTitle('HEALTH & ENERGY · صحتي','متابعة بسيطة، من غير ضغط','سجّل نومك وحركتك وتمارينك وطاقتك، وشوف العادات اللي بتفيدك. البيانات خاصة بحسابك، ولا تضيف XP.')+
 '<div class="yl-stats">'+
 '<div><small>أيام المتابعة · 14 يوم</small><b>'+h.logs.length+'</b><span>يوم سُجّل فيه نشاط</span></div>'+
 '<div><small>الخطوات المسجلة</small><b>'+h.stepTotal.toLocaleString('ar-EG')+'</b><span>مجموع المدخلات</span></div>'+
 '<div><small>وقت التمارين</small><b>'+h.exerciseTotal+'</b><span>دقيقة مسجلة</span></div>'+
 '<div><small>متوسط النوم</small><b>'+(h.avgSleep!==null?(h.avgSleep/60).toFixed(1)+' ساعة':'—')+'</b><span>في الأيام المدخلة فقط</span></div></div>'+
 '<div class="yl-twocol"><section class="yl-surface"><div class="yl-toolbar"><h3>سجل يومك</h3><div><input id="ylHealthDate" aria-label="تاريخ سجل الصحة" type="date" value="'+e(healthDate)+'"></div></div>'+
 '<div class="yl-health-detail">'+(selected?'<p>🚶 '+Number(selected.steps||0).toLocaleString('ar-EG')+' خطوة · 🏃 '+Number(selected.exerciseMin||0)+' دقيقة تمرين'+
 ' · 😌 الطاقة '+(selected.energy||'—')+'/5</p>'+
 '<p>🌙 النوم '+(selected.sleepMin?(selected.sleepMin/60).toFixed(1)+' ساعة':'غير مسجل')+
 (selected.weightKg?' · ⚖️ '+selected.weightKg+' كجم':'')+'</p>'+
 (selected.note?'<blockquote>'+e(selected.note)+'</blockquote>':''):'<p class="muted">مافيش سجل صحي للتاريخ ده. أضف أرقامك لو تحب.</p>')+'</div>'+
 btn(selected?'✎ تعديل سجل اليوم':'＋ تسجيل اليوم','data-life-health-edit="'+e(healthDate)+'"','primary')+
 '</section><section class="yl-surface"><h3>الخطوات خلال 14 يوم</h3><div class="yl-health-bars" role="img" aria-label="عدد الخطوات المسجلة لكل يوم من الأيام الأربعة عشر الأخيرة">'+h.days.map(d=>{
 const n=getHealth(d)?.steps||0;return '<div title="'+e(d)+' · '+n+' خطوة"><i style="height:'+(n?pct(n,maxSteps):0)+'%"></i><small>'+e(d.slice(8))+'</small></div>'
 }).join('')+'</div><small class="muted">يتم عرض الأيام التي سجّلت فيها بيانات فقط؛ الصفر لا يعني عدم المشي.</small></section></div>'+
 '<section class="yl-surface"><h3>تاريخ المتابعة</h3>'+(latest.length?'<div class="yl-health-list">'+latest.map(x=>
 '<button type="button" data-life-health-edit="'+e(x.date)+'"><b>'+e(localDate(x.date))+'</b><span>🚶 '+(x.steps||0)+' خطوة</span><span>🌙 '+(x.sleepMin?(x.sleepMin/60).toFixed(1)+' ساعة':'—')+'</span><span>⚡ '+(x.energy||'—')+'/5</span></button>'
 ).join('')+'</div>':L().empty('ابدأ بمتابعة بسيطة','مش محتاج تسجّل كل حاجة؛ سجّل اللي يفيدك فقط.'))+'</section>'+
 '<p class="yl-disclaimer">بياناتك مدخلة يدويًا، وليس لدينا اتصال بأجهزة قياس الصحة. هذا ليس تقييمًا طبيًا أو تشخيصًا. معلوماتك لا تظهر في المنافسات أو تقارير الأصدقاء.</p>';
}
function healthForm(date){
 if(!L().canWrite())return;healthDate=L().validDay(date)?date:today();
 const old=getHealth(healthDate);editing=old?.id||null;editingType='health';
 L().show('<form id="ylHealthForm">'+L().formTitle('HEALTH CHECK-IN','متابعة '+e(localDate(healthDate)))+
 field('التاريخ',input('ylHealthFormDate',healthDate,'date','required'))+
 '<div class="yl-form-grid">'+
 field('ساعات النوم (0 إلى 20)',input('ylHealthSleep',old?.sleepMin!==null&&old?.sleepMin!==undefined?(old.sleepMin/60).toFixed(1):'','text','inputmode="decimal" placeholder="7.5"'))+
 field('عدد الخطوات',input('ylHealthSteps',old?.steps??'','number','min="0" max="200000" placeholder="5000"'))+
 field('دقائق التمرين',input('ylHealthExercise',old?.exerciseMin??'','number','min="0" max="600" placeholder="30"'))+
 field('الوزن بالكيلو (اختياري)',input('ylHealthWeight',old?.weightKg||'','text','inputmode="decimal" placeholder="70.5"'))+
 field('مستوى الطاقة','<select id="ylHealthEnergy">'+opts([['','لم أحدد'],['1','1 · منخفضة'],['2','2 · قليلة'],['3','3 · متوسطة'],['4','4 · جيدة'],['5','5 · عالية']],old?.energy??'')+'</select>')+
 '</div>'+field('ملاحظة خاصة','<textarea id="ylHealthNote" maxlength="320" rows="3" placeholder="كيف كان يومك؟">'+e(old?.note||'')+'</textarea>')+
 (old?btn('حذف السجل','data-life-health-delete="'+e(old.id)+'"','danger'):'')+
 L().actions()+'</form>');
}
function saveHealth(){
 const x=s(),date=$('ylHealthFormDate').value,sleepText=$('ylHealthSleep').value.trim(),weightText=$('ylHealthWeight').value.trim();
 if(!L().validDay(date))return L().error('التاريخ غير صحيح.');
 const sleep=sleepText?dec(sleepText,0,20):null,
 steps=$('ylHealthSteps').value===''?null:safeInt($('ylHealthSteps').value,0,200000),
 exercise=$('ylHealthExercise').value===''?null:safeInt($('ylHealthExercise').value,0,600),
 weight=weightText?dec(weightText,1,500):null,
 energy=$('ylHealthEnergy').value===''?null:safeInt($('ylHealthEnergy').value,1,5);
 if((sleepText&&sleep===null)||(weightText&&weight===null)||($('ylHealthSteps').value!==''&&steps===null)||
 ($('ylHealthExercise').value!==''&&exercise===null)||($('ylHealthEnergy').value!==''&&energy===null))
 return L().error('راجع القيم: النوم 0–20 ساعة، والخطوات 0–200 ألف، والتمرين 0–600 دقيقة.');
 const same=x.lifeHealth.find(h=>h.date===date&&h.id!==editing);
 if(same)return L().error('فيه تسجيل للتاريخ ده بالفعل. افتحه وعدّل بياناته بدل إضافة تكرار.');
 const old=x.lifeHealth.find(v=>v.id===editing);
 const rec={id:old?.id||L().id(),date,sleepMin:sleep===null?null:Math.round(sleep*60),steps:steps??null,
  exerciseMin:exercise??null,weightKg:weight,energy,note:$('ylHealthNote').value.trim().slice(0,320),updatedAt:timeNow()};
 if(old)Object.assign(old,rec);else x.lifeHealth.push(rec);
 if(!L().save())return L().error('تعذر الحفظ');healthDate=date;L().done();
}
function routineChecks(r,date){
 const x=s().lifeRoutineChecks.find(z=>z.routineId===r.id&&z.date===date);
 return x?.done||[];
}
function routineProgress(r,date){
 const validIds=new Set(r.steps.map(x=>x.id)),done=routineChecks(r,date).filter(z=>validIds.has(z));
 return {done:done.length,total:r.steps.length,pct:pct(done.length,r.steps.length)};
}
function routineTemplate(kind){
 if(!L().canWrite())return;const presets=kind==='morning'?['شرب كوب ماء','مراجعة أولويات اليوم','حركة خفيفة أو تمدد']:['ترتيب احتياجات الغد','مراجعة إنجازات اليوم','تهيئة وقت هادئ قبل النوم'];
 const title=kind==='morning'?'روتيني الصباحي':'روتيني المسائي';
 if(s().lifeRoutines.some(x=>x.title===title)){api()?.notify?.('الروتين ده موجود بالفعل، تقدر تعدّله.');return}
 s().lifeRoutines.push({id:L().id(),title,part:kind,steps:presets.map(title=>({id:L().id(),title})),createdAt:timeNow()});
 if(L().save())routines();
}
function routines(){
 const root=L().root('routines');if(!root)return;const x=s();routineDate=routineDate||today();
 root.innerHTML='<div class="yl-hero"><div><span>ROUTINES · روتينك</span><h2>خطوات صغيرة، يوم أهدى</h2><p>ابني روتين صباحي أو مسائي، واربط خطواته بعاداتك الحالية أو خطوات خاصة.</p></div>'+
 btn('＋ روتين جديد','data-life-routine-new','primary')+'</div>'+
 '<section class="yl-surface"><div class="yl-toolbar"><div><h3>روتين يوم <span>'+e(localDate(routineDate))+'</span></h3><small>إكمال خطوة هنا لا يكمل العادة أو يمنح XP مرتين.</small></div>'+
 '<input type="date" id="ylRoutineDate" aria-label="تاريخ تسجيل الروتين" value="'+e(routineDate)+'"></div>'+
 (x.lifeRoutines.length?'<div class="yl-routine-grid">'+x.lifeRoutines.map(r=>{
 const pr=routineProgress(r,routineDate),done=routineChecks(r,routineDate);
 return '<article class="yl-routine"><div class="yl-routine-top"><div><small>'+e(r.part==='morning'?'☀️ صباحي':r.part==='evening'?'🌙 مسائي':'✦ خاص')+'</small><h3>'+e(r.title)+'</h3></div>'+
 btn('تعديل','data-life-routine-edit="'+e(r.id)+'"')+'</div>'+
 '<div class="yl-progress"><i style="width:'+pr.pct+'%"></i></div><p>'+pr.done+' من '+pr.total+' خطوات مكتملة · '+pr.pct+'%</p>'+
 r.steps.map(step=>'<label class="yl-routine-step"><input type="checkbox" data-life-routine-check="'+e(r.id)+'" data-life-step-id="'+e(step.id)+'" '+(done.includes(step.id)?'checked':'')+'>'+
 '<span>'+e(step.title)+(step.habitId?'<small>مرتبط بعادة، بدون تغيير سجلها</small>':'')+'</span></label>').join('')+
 '</article>';
 }).join('')+'</div>':L().empty('روتينك يبدأ بخطوة','اختار قالب صباحي أو مسائي، أو صمّم روتينك بنفسك.'))+
 '<div class="yl-toolbar">'+btn('☀️ قالب صباحي','data-life-routine-template="morning"')+btn('🌙 قالب مسائي','data-life-routine-template="evening"')+'</div></section>'+
 '<p class="yl-disclaimer">كل روتين مرن، ويمكن تغييره دون حذف إنجازات العادات الحالية. لا XP إضافي من مربعات الروتين.</p>';
}
function routineForm(routineId){
 if(!L().canWrite())return;const x=s(),r=x.lifeRoutines.find(z=>z.id===routineId);
 editing=r?.id||null;editingType='routine';
 const linked=(r?.steps||[]).filter(st=>st.habitId).map(st=>st.habitId);
 const custom=(r?.steps||[]).filter(st=>!st.habitId).map(st=>st.title).join('\n');
 L().show('<form id="ylRoutineForm">'+L().formTitle('BUILD YOUR ROUTINE',r?'تعديل الروتين':'روتين جديد')+
 field('اسم الروتين',input('ylRoutineTitle',r?.title||'','text','maxlength="75" required placeholder="روتين هادي قبل النوم"'))+
 field('نوع الروتين','<select id="ylRoutinePart">'+opts([['morning','صباحي'],['evening','مسائي'],['custom','خاص']],r?.part||'morning')+'</select>')+
 field('خطواتك الخاصة (كل سطر خطوة)','<textarea id="ylRoutineSteps" rows="5" maxlength="1200" placeholder="تجهيز ملابس الغد&#10;قراءة 10 دقائق">'+e(custom)+'</textarea>')+
 '<div class="yl-habit-picker"><b>اربط عاداتك الحالية (اختياري)</b><p class="muted">التأشير على روتين مرتبط لا يسجل إنجاز العادة بشكل تلقائي.</p>'+
 (x.habits||[]).filter(h=>h.active!==false).map(h=>
 '<label><input type="checkbox" data-life-routine-habit="'+e(h.id)+'" '+(linked.includes(h.id)?'checked':'')+'> '+e(h.title)+'</label>').join('')+'</div>'+
 (r?btn('حذف الروتين','data-life-routine-delete="'+e(r.id)+'"','danger'):'')+
 L().actions()+'</form>');
}
function saveRoutine(){
 const x=s(),title=$('ylRoutineTitle').value.trim().slice(0,75),custom=$('ylRoutineSteps').value.split('\n').map(z=>z.trim()).filter(Boolean).slice(0,15),
 habits=[...L().dialog().querySelectorAll('[data-life-routine-habit]:checked')].map(z=>z.dataset.lifeRoutineHabit);
 if(!title||!custom.length&&!habits.length)return L().error('الروتين لازم يكون له اسم وخطوة واحدة على الأقل.');
 const r=x.lifeRoutines.find(v=>v.id===editing),steps=[];
 const oldMap=new Map((r?.steps||[]).map(z=>[(z.habitId?'habit:'+z.habitId:'text:'+z.title),z.id]));
 for(const val of custom)steps.push({id:oldMap.get('text:'+val)||L().id(),title:val.slice(0,120)});
 for(const hid of habits.slice(0,20)){
  const h=(x.habits||[]).find(z=>z.id===hid);if(!h)continue;
  steps.push({id:oldMap.get('habit:'+hid)||L().id(),title:h.title,habitId:hid});
 }
 if(!steps.length||steps.length>35)return L().error('الحد 35 خطوة للروتين الواحد.');
 const data={id:r?.id||L().id(),title,part:$('ylRoutinePart').value,steps,updatedAt:timeNow()};
 if(r)Object.assign(r,data);else x.lifeRoutines.push(data);
 if(!L().save())return L().error('تعذر الحفظ');L().done();
}
function toggleRoutine(routineId,stepId,checked){
 const x=s(),r=x.lifeRoutines.find(z=>z.id===routineId);if(!r||!r.steps.some(st=>st.id===stepId))return;
 let row=x.lifeRoutineChecks.find(z=>z.routineId===routineId&&z.date===routineDate);
 if(!row){row={id:L().id(),routineId,date:routineDate,done:[]};x.lifeRoutineChecks.push(row)}
 if(checked&&!row.done.includes(stepId))row.done.push(stepId);
 if(!checked)row.done=row.done.filter(z=>z!==stepId);
 if(L().save())routines();
}
function planning(){
 const root=L().root('planning');if(!root)return;const x=s();
 const yearly=x.lifeYearly.filter(g=>g.year===yearShown),plans=x.lifePlans.filter(p=>p.start?.slice(0,4)===String(yearShown)||p.end?.slice(0,4)===String(yearShown));
 const baseGoals=Array.isArray(x.goals)?x.goals:[];
 root.innerHTML='<div class="yl-hero"><div><span>YEAR VISION · رؤية السنة</span><h2>حوّل حلم السنة إلى 90 يوم</h2><p>حدد اتجاه السنة، قسّمه لخطة 90 يوم، وحدّث مراحلها من غير تغيير تقدّم أهدافك الأصلية.</p></div>'+
 btn('＋ خطة 90 يوم','data-life-plan-new','primary')+'</div>'+
 '<section class="yl-surface"><div class="yl-toolbar"><div><h3>رؤية السنة</h3><small>أهداف سنوية قابلة للربط بأهداف «الكورسات والمشاريع» الحالية</small></div>'+
 '<div class="yl-calendar-nav">'+btn('‹','data-life-plan-year="-1"')+'<b>'+yearShown+'</b>'+btn('›','data-life-plan-year="1"')+btn('＋ رؤية','data-life-year-new','primary')+'</div></div>'+
 (yearly.length?'<div class="yl-cards">'+yearly.map(g=>{
 const link=baseGoals.find(z=>z.id===g.goalId);return '<article class="yl-card"><small>🎯 '+e(g.year)+'</small><h3>'+e(g.title)+'</h3><p>'+e(g.description||'')+'</p>'+
 (link?'<small>مرتبط بهدف حالي: '+e(link.title)+' · '+pct(Number(link.progress)||0,Number(link.target)||1)+'%</small>':'')+
 '<footer>'+btn('تعديل','data-life-year-edit="'+e(g.id)+'"')+'</footer></article>'}).join('')+'</div>':
 L().empty('لسه محددتش اتجاه السنة','اكتب هدفًا عامًا للسنة، وابدأ بتحويله إلى خطوات واضحة.'))+'</section>'+
 '<section class="yl-surface"><div class="yl-toolbar"><h3>خطط الـ90 يوم</h3>'+btn('＋ خطة جديدة','data-life-plan-new','primary')+'</div>'+
 (plans.length?'<div class="yl-plan-list">'+plans.map(p=>{
 const complete=(p.milestones||[]).filter(m=>m.done).length,ratio=pct(complete,p.milestones?.length||1);
 const link=baseGoals.find(z=>z.id===p.goalId);
 return '<article class="yl-plan"><div class="yl-toolbar"><div><small>'+e(p.start)+' ⇢ '+e(p.end)+'</small><h3>'+e(p.title)+'</h3></div>'+btn('تعديل','data-life-plan-edit="'+e(p.id)+'"')+'</div>'+
 (link?'<p>🔗 الهدف الحالي: '+e(link.title)+' · تقدمه '+pct(Number(link.progress)||0,Number(link.target)||1)+'%</p>':'')+
 '<div class="yl-progress"><i style="width:'+ratio+'%"></i></div><small>'+complete+'/'+p.milestones.length+' مراحل · '+ratio+'%</small>'+
 (p.milestones||[]).map(m=>'<label class="yl-routine-step"><input type="checkbox" data-life-plan-check="'+e(p.id)+'" data-life-milestone="'+e(m.id)+'" '+(m.done?'checked':'')+'>'+
 '<span>'+e(m.title)+'</span></label>').join('')+'</article>'
 }).join('')+'</div>':L().empty('فكّر في الـ90 يوم الجايين','كل خطة تتقسم لمراحل وتتابعها خطوة بخطوة.'))+'</section>'+
 '<p class="yl-disclaimer">إكمال مرحلة في خطة 90 يوم لا يكمل الهدف القديم تلقائيًا ولا يمنح XP. للتقدم في هدف موجود، سجّله من قسم الأهداف الأصلي.</p>';
}
function yearForm(val){
 if(!L().canWrite())return;const x=s(),g=x.lifeYearly.find(a=>a.id===val);
 editing=g?.id||null;editingType='year';
 const goals=Array.isArray(x.goals)?x.goals:[];
 L().show('<form id="ylYearForm">'+L().formTitle('YEARLY VISION',g?'تعديل الرؤية':'رؤية سنوية جديدة')+
 field('السنة',input('ylYearNumber',g?.year||yearShown,'number','min="2000" max="2100" required'))+
 field('عنوان الرؤية',input('ylYearTitle',g?.title||'','text','maxlength="105" placeholder="تطوير لغتي الإنجليزية" required'))+
 field('المعنى / السبب','<textarea id="ylYearDescription" maxlength="500" rows="3">'+e(g?.description||'')+'</textarea>')+
 field('ربط بهدف موجود (اختياري)','<select id="ylYearGoal">'+opts([['','بدون ربط'],...goals.map(q=>[q.id,q.title])],g?.goalId||'')+'</select>')+
 (g?btn('حذف الرؤية','data-life-year-delete="'+e(g.id)+'"','danger'):'')+L().actions()+'</form>');
}
function saveYear(){
 const x=s(),year=safeInt($('ylYearNumber').value,2000,2100),title=$('ylYearTitle').value.trim().slice(0,105);
 if(!year||!title)return L().error('حدد سنة وعنوانًا صالحين.');
 const old=x.lifeYearly.find(z=>z.id===editing),data={id:old?.id||L().id(),year,title,description:$('ylYearDescription').value.trim().slice(0,500),
 goalId:$('ylYearGoal').value||null,updatedAt:timeNow()};
 if(old)Object.assign(old,data);else x.lifeYearly.push(data);
 if(!L().save())return L().error('تعذر الحفظ');yearShown=year;L().done();
}
function planForm(planId){
 if(!L().canWrite())return;const x=s(),p=x.lifePlans.find(z=>z.id===planId),yearly=x.lifeYearly,goals=Array.isArray(x.goals)?x.goals:[];
 editing=p?.id||null;editingType='plan';
 L().show('<form id="ylPlanForm">'+L().formTitle('90 DAY PLANNING',p?'تعديل خطة':'خطة 90 يوم')+
 field('اسم الخطة',input('ylPlanTitle',p?.title||'','text','maxlength="105" required placeholder="أخلص 12 فصل من كورسي"'))+
 '<div class="yl-form-grid">'+field('تبدأ من',input('ylPlanStart',p?.start||today(),'date','required'))+
 field('ترتبط برؤية سنة (اختياري)','<select id="ylPlanYear">'+opts([['','بدون ربط'],...yearly.map(g=>[g.id,g.title])],p?.yearlyId||'')+'</select>')+
 field('ترتبط بهدف موجود (اختياري)','<select id="ylPlanGoal">'+opts([['','بدون ربط'],...goals.map(g=>[g.id,g.title])],p?.goalId||'')+'</select>')+'</div>'+
 field('مراحل الخطة (كل سطر مرحلة)','<textarea id="ylPlanMilestones" rows="7" maxlength="1400" placeholder="إنهاء الوحدة الأولى&#10;تطبيق عملي&#10;مراجعة ومشروع">'+e((p?.milestones||[]).map(z=>z.title).join('\n'))+'</textarea>')+
 (p?btn('حذف الخطة','data-life-plan-delete="'+e(p.id)+'"','danger'):'')+L().actions()+'</form>');
}
function savePlan(){
 const x=s(),title=$('ylPlanTitle').value.trim().slice(0,105),start=$('ylPlanStart').value;
 const parts=[...new Set($('ylPlanMilestones').value.split('\n').map(z=>z.trim()).filter(Boolean))].slice(0,15);
 if(!title||!L().validDay(start)||!parts.length)return L().error('اكتب اسمًا وتاريخًا وبندًا واحدًا على الأقل.');
 const old=x.lifePlans.find(z=>z.id===editing),milestones=parts.map(t=>{
  const original=old?.milestones?.find(z=>z.title===t);return {id:original?.id||L().id(),title:t.slice(0,120),done:!!original?.done};
 });
 const data={id:old?.id||L().id(),title,start,end:L().add(start,89),
 milestones,yearlyId:$('ylPlanYear').value||null,goalId:$('ylPlanGoal').value||null,updatedAt:timeNow()};
 if(old)Object.assign(old,data);else x.lifePlans.push(data);
 if(!L().save())return L().error('تعذر الحفظ');yearShown=Number(start.slice(0,4));L().done();
}
function markPlan(planId,milestoneId,checked){
 const x=s(),p=x.lifePlans.find(z=>z.id===planId),m=p?.milestones?.find(z=>z.id===milestoneId);if(!m)return;
 m.done=checked;if(L().save())planning();
}
function dashboardFacts(){
 const x=s(),todayDate=today(),last7=Array.from({length:7},(_,i)=>L().add(todayDate,i-6));
 let possible=0,done=0;
 for(const d of last7){
  for(const h of x.habits||[])if(L().habitActive(h,d)){
   possible++;if((Number(x.daily?.[d]?.habits?.[h.id])||0)>=(Number(h.target)||1))done++;
  }
 }
 const overdue=(x.tasks||[]).filter(t=>!t.repeat||t.repeat==='once')
 .filter(t=>t.date&&t.date<todayDate&&!x.daily?.[t.date]?.tasks?.[t.id]).slice(0,12);
 const futureEvents=Array.from({length:7},(_,i)=>L().add(todayDate,i)).flatMap(d=>L().itemsOn(d))
 .filter(z=>['event','appointment','timeblock','bill'].includes(z.type));
 const weekHealth=x.lifeHealth.filter(z=>last7.includes(z.date));
 const eligibleSleep=weekHealth.filter(z=>Number(z.sleepMin)>0);
 const avgSleep=eligibleSleep.length?Math.round(eligibleSleep.reduce((n,z)=>n+z.sleepMin,0)/eligibleSleep.length):null;
 const f=x.finance;
 const month=monthOf(todayDate),rows=f?.transactions?.filter(z=>z.date?.slice(0,7)===month)||[];
 const financeLocked=window.YawmiLife?.isPrivacyLocked?.('money')===true;
 const income=rows.filter(z=>z.type==='income').reduce((a,z)=>a+(Number(z.amount)||0),0);
 const spent=rows.filter(z=>z.type==='expense').reduce((a,z)=>a+(Number(z.amount)||0),0);
 const budget=Number(f?.budgets?.__total)||0;
 const completedPlans=x.lifePlans.filter(p=>(p.milestones||[]).length&&p.milestones.every(m=>m.done)).length;
 return {possible,done,habitRate:pct(done,possible),overdue,futureEvents,weekHealth,avgSleep,financeLocked,spent,income,budget,
  completedPlans,totalPlans:x.lifePlans.length,notes:x.lifeNotes.length,routines:x.lifeRoutines.length,healthDays:weekHealth.length};
}
function monthOf(x){return String(x||'').slice(0,7)}
function localRecommendations(facts){
 const x=s(),suggestions=[];
 if(facts.overdue.length)suggestions.push({icon:'☑',level:'medium',title:'ابدأ بمهمة متأخرة واحدة',
 text:'عندك '+facts.overdue.length+' مهام مرة واحدة مسجلة قبل اليوم ولم تكتمل. اختار الأهم وحط له وقتًا محددًا.',
 task:'مراجعة أهم مهمة متأخرة'});
 if(facts.possible&&facts.habitRate<65)suggestions.push({icon:'◉',title:'خفّف هدف عادة صعبة',
 text:'إكمال العادات خلال آخر 7 أيام: '+facts.done+'/'+facts.possible+'. راجع وقت العادات وهدفها بدل زيادة الضغط.',
 task:'مراجعة وقت العادات والأهداف'});
 if(facts.possible&&facts.habitRate>=65)suggestions.push({icon:'🌿',title:'حافظ على الاستمرارية',
 text:'مستوى تسجيل إكمال العادات هذا الأسبوع '+facts.habitRate+'%. اختار عادة تستمر عليها الأسبوع القادم.',
 task:'تثبيت عادة مناسبة للأسبوع القادم'});
 if(facts.futureEvents.length>=4)suggestions.push({icon:'📅',title:'رتّب المواعيد المهمة',
 text:'لديك '+facts.futureEvents.length+' مواعيد والتزامات خلال الأيام السبعة المقبلة. خصص وقتًا للتحضير.',
 task:'تجهيز مواعيد الأسبوع القادم'});
 if(!facts.financeLocked&&facts.budget>0&&facts.spent>=facts.budget*.8)suggestions.push({icon:'💳',title:'راجع ميزانية الشهر',
 text:'المصروفات المسجلة وصلت إلى '+Math.round(facts.spent/facts.budget*100)+'% من الحد الإجمالي الشهري.',
 task:'مراجعة ميزانية المصروفات'});
 if(facts.healthDays>=3&&facts.avgSleep!==null)suggestions.push({icon:'🌙',title:'راقب نمط النوم',
 text:'متوسط ساعات النوم في الأيام المسجلة هذا الأسبوع حوالي '+(facts.avgSleep/60).toFixed(1)+' ساعة. الأرقام مدخلة يدويًا ولا تمثل تقييمًا طبيًا.',
 task:'مراجعة جدول النوم'});
 if(x.lifePlans.length&&!facts.completedPlans)suggestions.push({icon:'🎯',title:'خطوة من خطة 90 يوم',
 text:'عندك '+facts.totalPlans+' خطط 90 يوم. اختر مرحلة واحدة وابدأ فيها خلال الأسبوع.',
 task:'إنجاز مرحلة من خطة الـ90 يوم'});
 if(!facts.possible)suggestions.push({icon:'🌱',title:'ابدأ بحركة صغيرة',
 text:'لم يتم العثور على سجل عادات نشطة في الأيام السبعة الماضية. جرب اختيار عادة واحدة مناسبة ليومك.',
 task:'اختيار عادة صغيرة للأسبوع'});
 if(!x.lifeCalendar.length)suggestions.push({icon:'🗓️',title:'رتّب موعدًا مهمًا',
 text:'التقويم ليس به مواعيد مضافة بشكل يدوي بعد. ممكن تخصّص فترة لأولويات الأسبوع.',
 task:'تحديد مواعيد الأسبوع'});
 if(!facts.notes)suggestions.push({icon:'✍️',title:'دوّن الأفكار بسرعة',
 text:'بنك الأفكار فارغ. حاول حفظ فكرة مهمة بدل ما تضيع وسط مهام اليوم.',
 task:'جمع أفكار الأسبوع في بنك الأفكار'});
 return suggestions.slice(0,7);
}
function coach(){
 const root=L().root('coach');if(!root)return;const f=dashboardFacts(),sug=localRecommendations(f);
 const finance=f.financeLocked?'الأرقام المالية مخفية حتى تفتح القفل':f.budget>0?'الميزانية '+Math.round(f.spent/f.budget*100)+'% مستخدمة':'لم تحدد ميزانية إجمالية';
 root.innerHTML=makeTitle('PRIVATE INSIGHTS · مساعد يومي','مراجعة ذكية… من بياناتك أنت','تقرير أسبوعي محلي يربط العادات والمهام والتقويم والمالية والصحة، ويقترح خطوات عملية بدون إرسال بياناتك إلى أي خدمة AI.')+
 '<div class="yl-stats"><div><small>العادات آخر 7 أيام</small><b>'+f.habitRate+'%</b><span>'+f.done+'/'+f.possible+' فرص مكتملة</span></div>'+
 '<div><small>المهام المتأخرة</small><b>'+f.overdue.length+'</b><span>مهام لم تنجز مرة واحدة</span></div>'+
 '<div><small>المواعيد القريبة</small><b>'+f.futureEvents.length+'</b><span>خلال 7 أيام</span></div>'+
 '<div><small>الميزانية</small><b>'+(f.financeLocked?'🔒':f.budget?Math.round(f.spent/f.budget*100)+'%':'—')+'</b><span>'+e(finance)+'</span></div></div>'+
 '<section class="yl-surface"><div class="yl-toolbar"><div><h3>أفكار للأسبوع القادم</h3><small>اقتراحات من قواعد تحليل محلية — لا يوجد اتصال بخدمة ذكاء اصطناعي خارجية.</small></div>'+
 btn('↻ تحديث التقرير','data-life-coach-refresh')+'</div>'+
 '<div class="yl-coach-grid">'+(sug.length?sug.map((z,i)=>'<article class="yl-coach-card"><span>'+z.icon+'</span><h3>'+e(z.title)+'</h3><p>'+e(z.text)+'</p>'+
 btn('＋ أضف خطوة للمهام','data-life-coach-task="'+i+'"')+'</article>').join(''):
 L().empty('أنت جاهز للأسبوع الجديد','ابدأ بتنظيم خطوة صغيرة وستظهر اقتراحات أكثر تحديدًا.'))+'</div></section>'+
 '<div class="yl-surface yl-callout"><h3>الخصوصية أولًا</h3><p>المساعد ده محلي ويستخدم قواعد واضحة، وليس نموذجًا يولّد نصًا من محتوى يومياتك. لا يقرأ نص اليوميات، ولا يظهر تفاصيل المالية إذا كان قفلها مفعّلًا. لا يتم إنشاء مهام أو منح XP إلا عند طلبك الصريح.</p></div>';
}
function coachToTask(index){
 const result=localRecommendations(dashboardFacts())[index],x=s();if(!result)return;
 if(!confirm('إضافة مهمة «'+result.task+'» لقائمة مهام اليوم؟'))return;
 const exists=(x.tasks||[]).some(t=>t.title===result.task&&t.date===today());
 if(exists){api()?.notify?.('المهمة دي موجودة بالفعل لهذا اليوم.');return}
 x.tasks.push({id:L().id(),title:result.task,category:'discipline',repeat:'once',date:today(),time:'',difficulty:1,priority:'medium',
 notes:'خطوة اقترحها التقرير الأسبوعي المحلي.',subtasks:[],weekDays:[]});
 if(L().save()){coach();api()?.notify?.('تمت إضافة المهمة، بدون احتسابها منجزة.')}
}
function deleteRecord(type,idValue){
 const x=s(),map={health:'lifeHealth',routine:'lifeRoutines',year:'lifeYearly',plan:'lifePlans'};
 const name=map[type],v=x?.[name]?.find(z=>z.id===idValue);if(!v||!confirm('هل تريد حذف هذا السجل؟ لا يتم حذف سجل العادات أو الأهداف الأخرى.'))return;
 x[name]=x[name].filter(z=>z.id!==idValue);if(!L().save())return;
 L().done('تم حذف السجل');
}
function click(e){
 const b=e.target.closest?.('button');if(!b)return;
 if(b.dataset.lifeHealthEdit)return healthForm(b.dataset.lifeHealthEdit);
 if(b.dataset.lifeHealthDelete)return deleteRecord('health',b.dataset.lifeHealthDelete);
 if(b.hasAttribute('data-life-routine-new'))return routineForm();
 if(b.dataset.lifeRoutineEdit)return routineForm(b.dataset.lifeRoutineEdit);
 if(b.dataset.lifeRoutineTemplate)return routineTemplate(b.dataset.lifeRoutineTemplate);
 if(b.dataset.lifeRoutineDelete)return deleteRecord('routine',b.dataset.lifeRoutineDelete);
 if(b.hasAttribute('data-life-year-new'))return yearForm();
 if(b.dataset.lifeYearEdit)return yearForm(b.dataset.lifeYearEdit);
 if(b.dataset.lifeYearDelete)return deleteRecord('year',b.dataset.lifeYearDelete);
 if(b.hasAttribute('data-life-plan-new'))return planForm();
 if(b.dataset.lifePlanEdit)return planForm(b.dataset.lifePlanEdit);
 if(b.dataset.lifePlanDelete)return deleteRecord('plan',b.dataset.lifePlanDelete);
 if(b.dataset.lifePlanYear){yearShown=Math.max(2000,Math.min(2100,yearShown+Number(b.dataset.lifePlanYear)));return planning()}
 if(b.hasAttribute('data-life-coach-refresh'))return coach();
 if(b.dataset.lifeCoachTask)return coachToTask(Number(b.dataset.lifeCoachTask));
}
function change(e){
 const el=e.target;
 if(el?.id==='ylHealthDate'&&L().validDay(el.value)){healthDate=el.value;health();return}
 if(el?.id==='ylRoutineDate'&&L().validDay(el.value)){routineDate=el.value;routines();return}
 if(el?.hasAttribute('data-life-routine-check'))return toggleRoutine(el.dataset.lifeRoutineCheck,el.dataset.lifeStepId,el.checked);
 if(el?.hasAttribute('data-life-plan-check'))return markPlan(el.dataset.lifePlanCheck,el.dataset.lifeMilestone,el.checked);
}
function submit(e){const id=e.target?.id;if(!['ylHealthForm','ylRoutineForm','ylYearForm','ylPlanForm'].includes(id))return;
 e.preventDefault();
 if(id==='ylHealthForm')saveHealth();
 if(id==='ylRoutineForm')saveRoutine();
 if(id==='ylYearForm')saveYear();
 if(id==='ylPlanForm')savePlan();
}
function init(){document.addEventListener('click',click);document.addEventListener('change',change);document.addEventListener('submit',submit)}
function render(tab){if(tab==='health')health();if(tab==='routines')routines();if(tab==='planning')planning();if(tab==='coach')coach()}
window.YawmiLifeGrowth={render,healthStats,routineProgress,dashboardFacts,localRecommendations};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();