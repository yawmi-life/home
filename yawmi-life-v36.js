/* YAWMI V36 — focused daily home, fast input, rest days, personalized book discovery and safe backup. */
(()=>{'use strict';
const $=id=>document.getElementById(id),api=()=>window.YawmiExtraAPI,cloud=()=>window.YawmiCloud;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const day=()=>api()?.today?.()||new Date().toLocaleDateString('en-CA');
const plusDay=(date,days)=>{const d=new Date(date+'T12:00:00');d.setDate(d.getDate()+days);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
const todayRec=(s,d)=>s?.daily?.[d]||{};
const id=()=>api()?.uid?.()||('v36-'+Date.now()+'-'+Math.random().toString(36).slice(2));
const state=()=>api()?.getState?.();
function canWrite(){return !!state()&&(!cloud()?.configured||!!(cloud().ready&&cloud().currentUser?.id&&!cloud().conflict))}
function notify(x){api()?.notify?.(x)}
function persist(rollback){
 if(!canWrite()||api().save()===false){if(rollback)rollback();notify('التعديل لم يُحفظ. راجع الحساب والمزامنة.');return false}
 return true;
}
const validDate=d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(new Date(d+'T12:00:00').getTime())&&plusDay(d,0)===d;
const validTime=t=>/^([01]\d|2[0-3]):[0-5]\d$/.test(t);
const normalizeNumber=t=>String(t||'').replace(/[٠-٩]/g,x=>String(x.charCodeAt(0)-1632)).replace(/[۰-۹]/g,x=>String(x.charCodeAt(0)-1776));
function parseQuick(input,reference=day()){
 const t=normalizeNumber(input).trim(),notes=t.replace(/\s+/g,' ').slice(0,150);
 let kind=/^(فكرني|ذكرني|ذكرنى|نبهني|تنبيه|ميعاد|موعد)\b|^فكرني|^ذكرني|^نبهني/.test(t)?'reminder':/^(ملاحظة|فكرة|ملحوظة|سجل فكرة)/.test(t)?'note':'task';
 let date=reference;
 if(/بعد بكرة|بعد غد|بعد غداً|بعد غدا/.test(t))date=plusDay(reference,2);
 else if(/بكرة|غد|غداً|غدا/.test(t))date=plusDay(reference,1);
 const explicit=t.match(/\b(20\d{2}-\d{1,2}-\d{1,2})\b/);
 if(explicit){const parts=explicit[1].split('-');const candidate=parts[0]+'-'+parts[1].padStart(2,'0')+'-'+parts[2].padStart(2,'0');if(validDate(candidate))date=candidate}
 const raw=t.match(/(?:الساعة|ساعه|ساعة|الوقت|عند)\s*(\d{1,2})(?::(\d{2}))?\s*(صباحاً|صباحا|ص|مساءً|مساءا|مساء|م|بالليل|ليلا|ليل)?/);
 let time='';
 if(raw){
  let hour=Number(raw[1]),minute=Number(raw[2]||0),pm=/مساء|بالليل|ليلا|ليل|^م$/.test(raw[3]||''),am=/صباح|^ص$/.test(raw[3]||'');
  if(hour<=23&&minute<60&&(!am&&!pm||hour<=12)){if(pm&&hour<12)hour+=12;if(am&&hour===12)hour=0;time=String(hour).padStart(2,'0')+':'+String(minute).padStart(2,'0')}
 }
 const title=notes.replace(/^(فكرني|ذكرني|ذكرنى|نبهني|ملاحظة|فكرة|ملحوظة|تنبيه|ميعاد|موعد)\s*(?:ان|أن|ب|إني|اني)?\s*/,'')
 .replace(/(?:بعد بكرة|بعد غد|بعد غداً|بعد غدا|بكرة|غدًا|غداً|غدا|النهاردة|اليوم)\s*/g,'')
 .replace(/(?:الساعة|ساعه|ساعة|الوقت|عند)\s*\d{1,2}(?::\d{2})?\s*(?:صباحاً|صباحا|ص|مساءً|مساءا|مساء|م|بالليل|ليلا|ليل)?/g,'')
 .replace(/\b20\d{2}-\d{1,2}-\d{1,2}\b/g,'').replace(/\s+/g,' ').trim().slice(0,110);
 return {kind,date,time,title:title||notes||'',input:t};
}
function taskScheduled(t,date){
 if(!t?.title||t.active===false)return false;
 const base=t.date||date,dow=new Date(date+'T12:00:00').getDay();if(date<base)return false;
 if(t.repeat==='daily')return true;
 if(t.repeat==='weekdays')return dow!==5&&dow!==6;
 if(t.repeat==='weekends')return dow===5||dow===6;
 if(t.repeat==='weekly')return new Date(base+'T12:00:00').getDay()===dow;
 if(t.repeat==='custom')return Array.isArray(t.weekDays)&&t.weekDays.includes(dow);
 return date===base;
}
function habitScheduled(h,date){
 if(!h||h.active===false||(Array.isArray(h.pausedDates)&&h.pausedDates.includes(date)))return false;
 const dow=new Date(date+'T12:00:00').getDay();
 if(h.created){const created=new Date(h.created);if(Number.isFinite(+created)){const baseline=[created.getFullYear(),String(created.getMonth()+1).padStart(2,'0'),String(created.getDate()).padStart(2,'0')].join('-');if(date<baseline)return false;}}
 if(h.repeat==='daily'||!h.repeat)return true;
 if(h.repeat==='weekdays')return dow!==5&&dow!==6;
 if(h.repeat==='weekends')return dow===5||dow===6;
 if(h.repeat==='weekly')return Array.isArray(h.weekDays)&&h.weekDays.length?h.weekDays.includes(dow):true;
 if(h.repeat==='custom')return Array.isArray(h.weekDays)&&h.weekDays.includes(dow);
 return false;
}
const taskDone=(s,t,d)=>!!todayRec(s,d).tasks?.[t.id];
function habitProgress(s,h,d){
 if(h.id==='reading')return (s.bookReadings||[]).filter(r=>r.date===d).reduce((n,r)=>n+Math.max(0,Number(r.pages)||0),0);
 if(h.id==='quran')return (s.quran?.readings||[]).filter(r=>r.date===d).reduce((n,r)=>n+Math.max(0,Number(r.pages)||0),0);
 if(h.id==='water')return Math.max(0,Number(todayRec(s,d).waterMl||0),Number(todayRec(s,d).habits?.water||0)*250);
 return Math.max(0,Number(todayRec(s,d).habits?.[h.id]||0));
}
function habitDone(s,h,d){return habitProgress(s,h,d)>=(h.id==='water'?(s.waterPrefs?.goalMl||2000):Math.max(1,Number(h.target)||1))}
function nextCalendar(s,reference){
 // Never mutate the stored reminder when computing its next occurrence.
 const today=new Date(reference+'T00:00:00').getTime(),events=[...(s.lifeCalendar||[]),...(s.lifeReminders||[])],upcoming=[];
 for(const event of events){
  if(!event||!validDate(event.date)||event.hidden||(event.done&&event.repeat!=='yearly'))continue;
  let date=event.date;
  if(event.repeat==='yearly'){
   const monthDay=event.date.slice(5),start=Number(reference.slice(0,4));
   date='';
   for(let year=Math.max(start,Number(event.date.slice(0,4)));year<=start+4;year++){
    const candidate=year+'-'+monthDay;
    if(validDate(candidate)&&new Date(candidate+'T23:59:59').getTime()>=today){date=candidate;break}
   }
   if(!date)continue;
  }
  if(new Date(date+'T'+(validTime(event.time)?event.time:'09:00')+':00').getTime()>=today)
   upcoming.push({...event,date});
 }
 return upcoming.sort((a,b)=>(a.date+' '+(a.time||'')).localeCompare(b.date+' '+(b.time||'')))[0]||null;
}
function syncLabel(){
 const c=cloud();
 if(!c?.configured)return 'تجربة محلية · لا توجد مزامنة سحابية';
 if(c.conflict)return 'تعارض مزامنة · افتح الحساب لحله';
 if(!c.ready)return 'جارٍ تحميل بيانات الحساب';
 if(!navigator.onLine)return 'لا يوجد اتصال بالإنترنت · آخر نسخة سحابية مؤكدة '+String(c.revision||'—');
 if(c.pending||c.working)return 'تعديلات قيد المزامنة مع السحابة';
 return 'تمت مزامنة البيانات · نسخة '+String(c.revision||'—');
}
function getFacts(s,d=day()){
 const tasks=(s.tasks||[]).filter(t=>taskScheduled(t,d));
 const pending=tasks.filter(t=>!taskDone(s,t,d)).sort((a,b)=>({'high':0,'medium':1,'low':2}[a.priority]??1)-({'high':0,'medium':1,'low':2}[b.priority]??1)||(a.time||'99:99').localeCompare(b.time||'99:99'));
 const habits=(s.habits||[]).filter(h=>habitScheduled(h,d));
 const doneTasks=tasks.length-pending.length,doneHabits=habits.filter(h=>habitDone(s,h,d)).length;
 const reading=(s.books||[]).filter(b=>b.status==='reading').sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||''))[0]||null;
 const event=nextCalendar(s,d);
 return {tasks,pending,habits,doneTasks,doneHabits,event,reading,light:!!s.life36Prefs?.lightDays?.[d]};
}
function dashboard(){
 const box=$('ymV36Today'),s=state();if(!box||!s)return;
 const d=day(),f=getFacts(s,d),n=f.light?1:3,h=f.habits.filter(h=>!habitDone(s,h,d)).slice(0,n);
 const button=(name,data)=>'<button type="button" '+data+'>'+name+'</button>';
 const taskHtml=f.pending.length?f.pending.slice(0,n).map(t=>'<div class="ym36-item"><span>☐</span><b>'+esc(t.title)+'</b>'+button('عرض المهمة','data-v36-gotasks')+'</div>').join(''):'<p class="ym36-muted">مفيش مهام متبقية من جدول اليوم.</p>';
 const habitHtml=h.length?h.map(x=>'<div class="ym36-item"><span>'+esc(x.icon||'✦')+'</span><b>'+esc(x.title)+(x.afterHabitId&&s.habits?.some(z=>z.id===x.afterHabitId)?'<small class="ym36-hint"> · بعد '+esc(s.habits.find(z=>z.id===x.afterHabitId).title)+'</small>':'')+'</b>'+button('متابعة','data-v36-gohabits')+'</div>').join(''):'<p class="ym36-muted">مفيش عادات متبقية من جدول اليوم.</p>';
 box.innerHTML='<section class="ym36-panel"><div class="ym36-title"><div><small>MY DAY · أهم حاجة النهارده</small><h2>يومك ببساطة</h2><p>ملخص حقيقي من مهامك وعاداتك المسجلة، من غير نقاط إضافية.</p></div>'+
 '<div class="ym36-controls">'+button('＋ أضف بسرعة','data-v36-openquick')+button(f.light?'↩ ارجع ليومي العادي':'☀️ يوم خفيف','data-v36-light')+'</div></div>'+
 '<div class="ym36-metrics"><span>المهام <strong>'+f.doneTasks+'/'+f.tasks.length+'</strong></span><span>العادات <strong>'+f.doneHabits+'/'+f.habits.length+'</strong></span>'+
 '<span>النظام <strong>'+ (f.light?'خفيف':'عادي')+'</strong></span></div>'+
 (f.light?'<p class="ym36-soft-note">الوضع الخفيف بيقلل العناصر المعروضة هنا فقط. خطتك الأصلية وسجل إنجازاتك وXP زي ما هما.</p>':'')+
 '<div class="ym36-grid"><article><h3>✓ أهم المهام</h3>'+taskHtml+'</article><article><h3>🌱 عادات اليوم</h3>'+habitHtml+'</article></div>'+
 '<div class="ym36-bottom"><span>🗓️ '+(f.event?esc(f.event.title)+' · '+esc(f.event.date)+' '+esc(f.event.time||''):'مفيش موعد قريب')+'</span>'+
 '<span>📚 '+(f.reading?'بتقرأ: '+esc(f.reading.title)+' ('+Number(f.reading.currentPage||0)+'/'+Number(f.reading.totalPages||0)+')':'ابدأ كتابًا من مكتبتك')+'</span></div>'+
 '<div class="ym36-sync"><span aria-live="polite">☁ '+esc(syncLabel())+'</span>'+
 button('إعدادات الحساب والنسخ الاحتياطي','data-v36-openbackup')+'</div></section>';
}
function quickDialog(){
 let d=$('ymV36Dialog');if(d)return d;
 d=document.createElement('dialog');d.id='ymV36Dialog';d.className='ym36-dialog';d.setAttribute('aria-label','إضافة مهمة أو موعد أو ملاحظة بسرعة');
 d.innerHTML='<form id="ymV36Form"><div class="ym36-dialog-head"><h2>＋ إضافة سريعة</h2><button type="button" data-v36-close aria-label="إغلاق">✕</button></div>'+
 '<label>اكتب أو املي اللي في بالك<textarea id="ymV36Text" rows="2" maxlength="150" placeholder="مثال: فكرني أراجع بكرة الساعة 8 مساء"></textarea></label>'+
 '<div class="ym36-controls"><button type="button" data-v36-parse>فهم العبارة</button><button type="button" data-v36-voice>🎙️ إملاء صوتي</button></div>'+
 '<p class="ym36-muted">راجع التفاصيل قبل الإضافة. مفيش إنجاز أو XP بيتسجل تلقائيًا. الإملاء الصوتي قد تستخدم فيه خدمة التعرّف على الصوت التابعة للمتصفح.</p>'+
 '<label>النوع<select id="ymV36Kind"><option value="task">مهمة</option><option value="reminder">تذكير</option><option value="note">ملاحظة</option></select></label>'+
 '<label>العنوان<input id="ymV36Title" maxlength="110" required></label>'+
 '<div class="ym36-fields"><label>التاريخ<input id="ymV36Date" type="date" required></label><label>الساعة (اختياري للمهام)<input id="ymV36Time" type="time"></label></div>'+
 '<p id="ymV36Error" class="ym36-error" role="alert"></p><div class="ym36-controls"><button type="submit" class="ym36-primary">حفظ الإضافة ✓</button><button type="button" data-v36-close>إلغاء</button></div></form>';
 document.body.appendChild(d);return d;
}
function showQuick(query=''){
 if(!canWrite())return notify('سجل الدخول وانتظر اكتمال المزامنة قبل الإضافة.');
 const d=quickDialog(),s=parseQuick(query);$('ymV36Text').value=query;$('ymV36Kind').value=s.kind;$('ymV36Title').value=s.title;$('ymV36Date').value=s.date;$('ymV36Time').value=s.time;$('ymV36Error').textContent='';
 if(!d.open)d.showModal();if(!query)$('ymV36Text').focus();
}
function parseInputs(){const x=parseQuick($('ymV36Text').value);$('ymV36Kind').value=x.kind;$('ymV36Title').value=x.title;$('ymV36Date').value=x.date;$('ymV36Time').value=x.time}
function saveQuick(){
 if(!canWrite())return $('ymV36Error').textContent='البيانات لم تكتمل مزامنتها.';
 const s=state(),kind=$('ymV36Kind').value,title=$('ymV36Title').value.trim().slice(0,110),date=$('ymV36Date').value,time=$('ymV36Time').value;
 if(!title||!validDate(date)||(time&&!validTime(time)))return $('ymV36Error').textContent='راجع العنوان والتاريخ والساعة.';
 if(kind==='reminder'&&!time)return $('ymV36Error').textContent='التذكير محتاج ساعة محددة.';
 let key='',item=null;
 if(kind==='task'){key='tasks';item={id:id(),title,category:'discipline',repeat:'once',weekDays:[],date,time,priority:'medium',difficulty:1,notes:'',subtasks:[]};}
 else if(kind==='reminder'){key='lifeReminders';item={id:id(),title,date,time,lead:0,repeat:'none',done:false,updatedAt:new Date().toISOString()};}
 else if(kind==='note'){key='lifeNotes';item={id:id(),title,body:$('ymV36Text').value.trim().slice(0,1000)||title,tags:[],favorite:false,updatedAt:new Date().toISOString()};}
 else return $('ymV36Error').textContent='اختر نوعًا صحيحًا.';
 if(!Array.isArray(s[key]))s[key]=[];
 s[key].push(item);
 if(!persist(()=>s[key].splice(s[key].indexOf(item),1)))return $('ymV36Error').textContent='فشل حفظ التعديل.';
 quickDialog().close();notify('اتحفظت '+(kind==='task'?'مهمة':kind==='note'?'ملاحظة':'تذكير')+' جديدة، من غير نقاط إضافية ✓');
 api().render();dashboard();
}
function toggleLight(){
 if(!canWrite())return notify('انتظر تحميل حسابك.');
 const s=state();s.life36Prefs=s.life36Prefs||{lightDays:{}};
 s.life36Prefs.lightDays=s.life36Prefs.lightDays||{};
 const d=day(),previous=!!s.life36Prefs.lightDays[d];
 if(previous)delete s.life36Prefs.lightDays[d];else s.life36Prefs.lightDays[d]=true;
 if(persist(()=>{if(previous)s.life36Prefs.lightDays[d]=true;else delete s.life36Prefs.lightDays[d]}))dashboard();
}
function habitPanel(){
 const root=$('page-habits'),s=state();if(!root||!s)return;
 let x=$('ymV36HabitPanel');
 if(!x){x=document.createElement('section');x.id='ymV36HabitPanel';x.className='ym36-panel ym36-habit-panel';const first=root.querySelector('.panel,.page-head,.panel-head');if(first)first.before(x);else root.prepend(x)}
 const choices=(s.habits||[]).filter(h=>h.active!==false);
 const selected=x.dataset.selected||choices[0]?.id||'',h=choices.find(h=>h.id===selected)||choices[0],after=h?.afterHabitId||'';
 if(!h){x.innerHTML='<h3>راحة العادات والروابط</h3><p>أضف عادتك الأولى علشان تنظّمها.</p>';return}
 x.dataset.selected=h.id;
 const date=x.dataset.date&&validDate(x.dataset.date)?x.dataset.date:day(),rest=!!h.pausedDates?.includes(date);
 x.innerHTML='<div class="ym36-title"><div><small>HABIT FLEXIBILITY · بدون XP إضافي</small><h3>خطة عادات مرنة</h3><p>خد راحة من عادة أو اربطها بعادة تانية. إنجازاتك القديمة لا تتغير.</p></div></div>'+
 '<div class="ym36-habit-fields"><label>العادة<select id="ymV36HabitPick">'+choices.map(z=>'<option value="'+esc(z.id)+'" '+(z.id===h.id?'selected':'')+'>'+esc(z.title)+'</option>').join('')+'</select></label>'+
 '<label>اليوم<input id="ymV36HabitDate" type="date" value="'+date+'"></label>'+
 '<label>أعملها بعد<select id="ymV36HabitAfter"><option value="">بدون ربط</option>'+choices.filter(z=>z.id!==h.id).map(z=>'<option value="'+esc(z.id)+'" '+(after===z.id?'selected':'')+'>'+esc(z.title)+'</option>').join('')+'</select></label></div>'+
 '<div class="ym36-controls"><button type="button" data-v36-rest>'+ (rest?'↩ إلغاء يوم الراحة':'☀️ اعتبره يوم راحة')+'</button><button type="button" data-v36-after>حفظ ربط العادتين</button></div>'+
 '<p class="ym36-muted">'+(rest?'العادة مش مطلوبة في اليوم ده، ولا يمنح راحة اليوم نقاطًا.':'أيام الراحة لا تمنح XP، ولا يمكن تسجيل راحة على يوم تم فيه نشاط لهذه العادة.')+' ربط العادة للتذكير بالترتيب فقط، ولا يكملها تلقائيًا.</p>';
}
function toggleHabitRest(){
 if(!canWrite())return notify('انتظر مزامنة حسابك قبل تعديل العادات.');
 const s=state(),h=s.habits?.find(x=>x.id===$('ymV36HabitPick')?.value),d=$('ymV36HabitDate')?.value;
 if(!h||!validDate(d))return notify('اختر عادة ويومًا صحيحين.');
 if(d<day())return notify('ماينفعش تعديل يوم راحة في الماضي؛ التاريخ محفوظ كما هو.');
 h.pausedDates=Array.isArray(h.pausedDates)?h.pausedDates:[];
 const index=h.pausedDates.indexOf(d);
 if(index<0){
  if(habitProgress(s,h,d)>0)return notify('فيه تقدم مسجل لليوم ده. الغِ أو صحّح التقدم أولًا قبل تحديده راحة.');
  h.pausedDates.push(d);
 }else h.pausedDates.splice(index,1);
 if(persist(()=>{if(index<0)h.pausedDates=h.pausedDates.filter(x=>x!==d);else h.pausedDates.push(d)})){api().render();habitPanel();dashboard()}
}
function setAfterHabit(){
 if(!canWrite())return notify('انتظر مزامنة حسابك.');
 const s=state(),h=s.habits?.find(x=>x.id===$('ymV36HabitPick')?.value),newId=$('ymV36HabitAfter')?.value||'';
 if(!h||newId===h.id||newId&&!s.habits.some(x=>x.id===newId))return notify('اختر ربطًا صالحًا.');
 const previous=h.afterHabitId;
 // Prevent cycles: A after B after C after A.
 let node=s.habits.find(x=>x.id===newId),steps=0;
 while(node&&steps++<s.habits.length){if(node.id===h.id)return notify('مش مسموح بربط دائري بين العادات.');node=s.habits.find(x=>x.id===node.afterHabitId)}
 h.afterHabitId=newId;
 if(persist(()=>{h.afterHabitId=previous})){habitPanel();notify('اتحفظ ترتيب عادتك، من غير أي XP ✓')}
}
function booksPanel(){
 const root=$('page-books');if(!root)return;
 let el=$('ymV36Books');if(!el){el=document.createElement('section');el.id='ymV36Books';el.className='ym36-panel';root.appendChild(el)}
 const s=state(),titles=(s?.books||[]).map(b=>b.title||'').join(' ');
 const topics=/مال|استثمار|ريادة|الأب الغني/.test(titles)?['التمويل الشخصي','كتب إدارة الأعمال','الاقتصاد']: /رواية|زيكولا|محفوظ|الأدب/.test(titles)?['روايات عربية','أدب عربي','روايات مترجمة']:['تطوير الذات','كتب عربية عن العادات','علم النفس'];
 el.innerHTML='<div class="ym36-title"><div><small>READING DISCOVERY · ترشيحات مبنية على اهتماماتك</small><h3>اكتشف كتابك الجاي</h3><p>توصيات للبحث في الفهرس، وليست كتبًا تم التحقق من توافرها أو قراءتها.</p></div></div>'+
 '<div class="ym36-controls">'+topics.map(t=>'<button type="button" data-v36-booktopic="'+esc(t)+'">🔎 '+esc(t)+'</button>').join('')+'</div>'+
 '<p class="ym36-muted">مش لاقي كتابك؟ زر «إضافة كتاب» الموجود في مكتبتك بيخليك تضيفه يدويًا بدون ما تتمنح أي نقاط قراءة.</p>';
}
function coachPanel(){
 const root=$('page-coach');if(!root)return;
 let x=$('ymV36Coach');if(!x){x=document.createElement('section');x.id='ymV36Coach';x.className='ym36-panel';root.appendChild(x)}
 const s=state();if(!s)return;
 const since=plusDay(day(),-6),days=Object.keys(s.daily||{}).filter(d=>d>=since&&d<=day());
 const taskIds=new Set();for(const d of days)for(const [key,val] of Object.entries(s.daily[d]?.tasks||{}))if(val)taskIds.add(key);
 const weekly=days.length,done=taskIds.size;
 const overloaded=getFacts(s).pending.length>=5;
 const suggested=overloaded?'خطوة صغيرة من أهم مهمة مؤجلة':'مراجعة خطة الأسبوع القادم 10 دقائق';
 x.innerHTML='<div class="ym36-title"><div><h3>اقتراح عملي للأسبوع القادم</h3><p>من بياناتك المحلية: '+weekly+' يوم فيه تسجيل، و'+done+' مهام مميزة اتسجل إنجازها خلال الأسبوع. من غير ادعاء متابعة أو تعديل تلقائي.</p></div></div>'+
 '<p class="ym36-muted">'+(overloaded?'عندك مهام كثيرة متبقية لليوم. جرّب مهمة صغيرة واحدة بدل مضاعفة القائمة.':'الحفاظ على مراجعة قصيرة أسبوعية ممكن يساعدك على الاستمرار.')+'</p>'+
 '<button type="button" class="ym36-primary" data-v36-coachtask="'+esc(suggested)+'">＋ اقترح إضافة المهمة لخطة بكرة</button>';
}
function syncDialog(){
 let d=$('ymV36BackupDialog');if(d)return d;
 d=document.createElement('dialog');d.id='ymV36BackupDialog';d.className='ym36-dialog';
 d.innerHTML='<div class="ym36-dialog-head"><h2>☁ حالة الحساب والنسخ الاحتياطي</h2><button type="button" data-v36-backupclose>✕</button></div>'+
 '<p id="ymV36SyncStatus" role="status"></p><p class="ym36-muted">النسخة الاحتياطية ممكن تحتوي بياناتك الشخصية والمالية واليوميات. خزّنها في مكان خاص وآمن، وما تبعتهاش لحد.</p>'+
 '<div class="ym36-controls"><button type="button" data-v36-backupexport>⇩ تنزيل نسخة من بياناتي</button>'+
 '<button type="button" data-v36-backupsync>↻ مزامنة الآن</button><button type="button" data-v36-backupimport>⇧ استعادة نسخة</button></div>'+
 '<input type="file" id="ymV36Import" accept=".json,application/json" hidden>'+
 '<p id="ymV36BackupError" class="ym36-error" role="status"></p>';
 document.body.appendChild(d);return d;
}
function openBackup(){
 const d=syncDialog();$('ymV36SyncStatus').textContent=syncLabel();$('ymV36BackupError').textContent='';
 if(!d.open)d.showModal();
}
function exportBackup(){
 const s=state();if(!s)return;
 const c=cloud();
 if(c?.configured&&!c.ready)return $('ymV36BackupError').textContent='انتظر تحميل الحساب قبل تنزيل النسخة.';
 const data={app:'YAWMI LifeOS',format:36,owner:c?.currentUser?.id||null,exportedAt:new Date().toISOString(),snapshot:structuredClone(s)};
 const b=new Blob([JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'});
 const url=URL.createObjectURL(b),a=document.createElement('a');a.href=url;a.download='YAWMI-private-backup-'+day()+'.json';a.click();
 setTimeout(()=>URL.revokeObjectURL(url),1500);
}
async function importBackup(file){
 if(!file||file.size>15*1024*1024)return $('ymV36BackupError').textContent='اختر ملف JSON صالحًا أصغر من 15 ميجابايت.';
 if(!canWrite())return $('ymV36BackupError').textContent='انتظر اكتمال مزامنة حسابك أولًا.';
 let payload;try{payload=JSON.parse(await file.text())}catch(_){return $('ymV36BackupError').textContent='ملف JSON غير صالح.'}
 const current=state(),u=cloud()?.currentUser?.id||null,from=payload?.owner,v=payload?.snapshot;
 if(payload?.app!=='YAWMI LifeOS'||payload.format!==36||!v||v.version!==7||!Array.isArray(v.tasks)||!Array.isArray(v.habits)||!Array.isArray(v.books)||!Array.isArray(v.rewards)||!v.daily||typeof v.daily!=='object'||Array.isArray(v.daily))
  return $('ymV36BackupError').textContent='صيغة النسخة الاحتياطية غير متوافقة مع حساب يومي.';
 if((u||from)&&u!==from)return $('ymV36BackupError').textContent='هذه نسخة حساب مختلف؛ منعنا استيرادها لحماية خصوصية المستخدمين.';
 function unsafe(x,depth=0){
  if(depth>25)return true;
  if(x&&typeof x==='object'){
   for(const key of Object.keys(x)){
    if(['__proto__','constructor','prototype'].includes(key)||unsafe(x[key],depth+1))return true;
   }
  }
  return false;
 }
 if(unsafe(v))return $('ymV36BackupError').textContent='النسخة الاحتياطية تحتوي مفاتيح غير مسموحة؛ لن يتم استيرادها.';
 if(cloud()?.pending||cloud()?.conflict)return $('ymV36BackupError').textContent='احسم التعديلات المعلقة أو تعارض المزامنة قبل الاستعادة.';
 if(!confirm('تحذير: استعادة النسخة تستبدل البيانات الموجودة في حسابك بهذا الملف، وقد تعيد سجل مهام أقدم. هل أنت متأكد؟'))return;
 const before=structuredClone(current),next=structuredClone(v);
 // Keep reference identity so existing pages read the updated object without a sign-out.
 for(const k of Object.keys(current))delete current[k];Object.assign(current,next);
 if(!persist(()=>{for(const k of Object.keys(current))delete current[k];Object.assign(current,before)}))
  return $('ymV36BackupError').textContent='تعذر حفظ الاستعادة، وتم التراجع محليًا.';
 $('ymV36BackupError').textContent='تم إرسال الاستعادة للمزامنة. راجع حالة حسابك قبل غلق التطبيق.';
 api().render();dashboard();
}
function voice(){
 const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!Recognition)return $('ymV36Error').textContent='الإملاء الصوتي مش مدعوم في المتصفح الحالي. تقدر تكتب العبارة يدويًا.';
 try{const sr=new Recognition();sr.lang='ar-SA';sr.interimResults=false;sr.maxAlternatives=1;
 sr.onresult=e=>{const heard=e.results?.[0]?.[0]?.transcript;if(heard){$('ymV36Text').value=heard;parseInputs()}};
 sr.onerror=()=>{$('ymV36Error').textContent='تعذّر الإملاء. اكتب بدلًا منه.'};sr.start()}
 catch(_){$('ymV36Error').textContent='متصفحك رفض تشغيل الميكروفون.'}
}
let usedDeepLink=false;
function handleDeepLink(){
 if(usedDeepLink||!canWrite())return;
 let url;try{url=new URL(window.location.href)}catch(_){return}
 const quick=url.searchParams.get('quick');
 if(!['tasks','habits','calendar'].includes(quick))return;
 usedDeepLink=true;
 url.searchParams.delete('quick');
 try{window.history.replaceState(null,'',url.pathname+url.search+url.hash)}catch(_){}
 window.setTimeout(()=>api()?.goPage?.(quick),0);
}
function render(){
 if(!$('ymV36Today'))return;
 dashboard();handleDeepLink();
 if($('page-habits')?.classList.contains('on'))habitPanel();
 if($('page-books')?.classList.contains('on'))booksPanel();
 if($('page-coach')?.classList.contains('on'))coachPanel();
}
function init(){
 const home=$('page-home');if(home&&!$('ymV36Today')){
  const root=document.createElement('div');root.id='ymV36Today';
  const anchor=$('ymEnhancementsHome');if(anchor)anchor.after(root);else home.prepend(root);
 }
 if(!$('ymV36QuickFab')){
  const b=document.createElement('button');b.id='ymV36QuickFab';b.type='button';b.className='ym36-fab';b.setAttribute('aria-label','إضافة سريعة لمهمة أو تذكير أو ملاحظة');b.setAttribute('data-v36-openquick','');b.textContent='＋';
  document.body.appendChild(b);
 }
 document.addEventListener('click',e=>{
  const b=e.target.closest?.('button');if(!b)return;
  if(b.hasAttribute('data-v36-openquick'))return showQuick();
  if(b.hasAttribute('data-v36-parse'))return parseInputs();
  if(b.hasAttribute('data-v36-voice'))return voice();
  if(b.hasAttribute('data-v36-close'))return quickDialog().close();
  if(b.hasAttribute('data-v36-light'))return toggleLight();
  if(b.hasAttribute('data-v36-gotasks'))return api()?.goPage?.('tasks');
  if(b.hasAttribute('data-v36-gohabits'))return api()?.goPage?.('habits');
  if(b.hasAttribute('data-v36-rest'))return toggleHabitRest();
  if(b.hasAttribute('data-v36-after'))return setAfterHabit();
  if(b.hasAttribute('data-v36-openbackup'))return openBackup();
  if(b.hasAttribute('data-v36-backupclose'))return syncDialog().close();
  if(b.hasAttribute('data-v36-backupexport'))return exportBackup();
  if(b.hasAttribute('data-v36-backupimport'))return $('ymV36Import')?.click();
  if(b.hasAttribute('data-v36-backupsync')){const c=cloud();if(!c?.ready)return notify('المزامنة مش جاهزة.');void(c.pending?c.flush?.():c.refresh?.());$('ymV36SyncStatus').textContent='بدأ طلب المزامنة. راجع حالة الحساب.';return}
  if(b.dataset.v36Booktopic){api()?.goPage?.('books');const el=$('ymCatalogQuery');if(el){el.value=b.dataset.v36Booktopic;el.closest('form')?.requestSubmit()}return}
  if(b.dataset.v36Coachtask){if(!canWrite())return notify('بيانات الحساب لم تجهز.');
   if(!confirm('تضيف مهمة صغيرة جديدة لبكرة؟ مش هيتحسب أي XP إلا لما تنجزها.'))return;
   const s=state(),task={id:id(),title:b.dataset.v36Coachtask.slice(0,110),category:'discipline',priority:'low',repeat:'once',date:plusDay(day(),1),time:'',difficulty:1,notes:'اقتراح من مراجعة الأسبوع',subtasks:[],weekDays:[]};
   s.tasks.push(task);if(persist(()=>s.tasks.splice(s.tasks.indexOf(task),1))){notify('أضفنا المهمة لبكرة ✓');api().render()}return;
  }
 });
 document.addEventListener('change',e=>{
  if(e.target?.id==='ymV36HabitPick'){const p=$('ymV36HabitPanel');p.dataset.selected=e.target.value;habitPanel()}
  if(e.target?.id==='ymV36HabitDate'){const p=$('ymV36HabitPanel');p.dataset.date=e.target.value;habitPanel()}
  if(e.target?.id==='ymV36Import'){const file=e.target.files?.[0];if(file)void importBackup(file);e.target.value=''}
  if(e.target?.id==='ymV36Kind'&&e.target.value==='note')$('ymV36Time').required=false;
 });
 document.addEventListener('submit',e=>{if(e.target?.id==='ymV36Form'){e.preventDefault();saveQuick()}});
 window.addEventListener('online',()=>dashboard());document.addEventListener('visibilitychange',()=>{if(!document.hidden)dashboard()});
 render();
}
window.YawmiLifeV36={render,parseQuick,getFacts,habitScheduled,taskScheduled,showQuick,toggleLight,exportBackup,importBackup,syncLabel};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();