/* YAWMI V33 — calendar, reminders, quick notes. Private records use the existing account document. */
(()=>{'use strict';
const $=id=>document.getElementById(id),api=()=>window.YawmiExtraAPI;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const day=()=>api()?.today?.()||[new Date().getFullYear(),String(new Date().getMonth()+1).padStart(2,'0'),String(new Date().getDate()).padStart(2,'0')].join('-');
const toDate=d=>new Date(d+'T12:00:00');
const ymd=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
const add=(d,n)=>{let v=toDate(d);v.setDate(v.getDate()+n);return ymd(v)};
const validDay=x=>/^\d{4}-\d\d-\d\d$/.test(String(x||''))&&Number.isFinite(toDate(x).getTime())&&ymd(toDate(x))===x;
const validTime=x=>/^([01]\d|2[0-3]):[0-5]\d$/.test(String(x||''));
const monthOf=d=>String(d||'').slice(0,7);
const shortDay=d=>new Intl.DateTimeFormat('ar-EG-u-ca-gregory',{weekday:'long',day:'numeric',month:'short'}).format(toDate(d));
const monthName=d=>new Intl.DateTimeFormat('ar-EG-u-ca-gregory',{month:'long',year:'numeric'}).format(toDate(d+'-01'));
const id=()=>api()?.uid?.()||('l'+Date.now().toString(36)+Math.random().toString(36).slice(2));
let last=null,calDay=day(),calView='month',noteQuery='',noteFav=false,editing=null,activeModal='',notifyBusy=false,alertTimer=null;
function state(){
 const s=api()?.getState?.();if(!s)return null;
 if(last!==s){last=s;calDay=day();calView='month';noteQuery='';noteFav=false;clearTimeout(alertTimer)}
 for(const key of ['lifeCalendar','lifeReminders','lifeNotes','lifeHealth','lifeRoutines','lifeRoutineChecks','lifePlans','lifeYearly','lifeNotificationSeen'])
  if(!Array.isArray(s[key]))s[key]=[];
 if(!s.lifeNotificationPrefs||typeof s.lifeNotificationPrefs!=='object')s.lifeNotificationPrefs={enabled:false};
 if(!s.lifePrivacy||typeof s.lifePrivacy!=='object')s.lifePrivacy={};
 return s;
}
function canWrite(){return !!api()?.getState?.()&&(!window.YawmiCloud?.configured||Boolean(window.YawmiCloud.ready&&window.YawmiCloud.currentUser))}
function save(){if(!canWrite()){api()?.notify?.('سجّل الدخول وانتظر فتح بيانات حسابك.');return false}return api().save()!==false}
const root=x=>$('ymLife'+x[0].toUpperCase()+x.slice(1));
const empty=(label,desc)=>'<div class="yl-empty"><span>✧</span><h3>'+esc(label)+'</h3><p>'+esc(desc)+'</p></div>';
const field=(name,html)=>'<label class="yl-field"><span>'+esc(name)+'</span>'+html+'</label>';
const btn=(label,attr,variant='soft')=>'<button type="button" class="yl-action '+variant+'" '+attr+'>'+label+'</button>';
const input=(id,value='',type='text',extra='')=>'<input id="'+id+'" type="'+type+'" value="'+esc(value)+'" '+extra+'>';
function dialog(){
 let d=$('ymLifeDialog');if(d)return d;
 d=document.createElement('dialog');d.id='ymLifeDialog';d.className='yl-dialog';d.setAttribute('aria-label','تعديل بيانات يومي');
 d.innerHTML='<button type="button" class="yl-close" data-life-close aria-label="إغلاق">✕</button><div id="ymLifeDialogBody"></div>';
 document.body.appendChild(d);return d;
}
function show(html){const d=dialog();$('ymLifeDialogBody').innerHTML=html;if(!d.open)d.showModal()}
function close(){if(dialog().open)dialog().close();editing=null;activeModal='';}
function formTitle(eyebrow,title){return '<div class="yl-form-heading"><span>'+eyebrow+'</span><h2>'+title+'</h2></div>'}
const actions=(label='حفظ')=>'<p class="yl-error" id="ylFormError" role="alert"></p><div class="yl-form-actions"><button type="submit" class="yl-action primary">'+label+'</button>'+btn('إلغاء','data-life-close')+'</div>';
function error(message){const x=$('ylFormError');if(x)x.textContent=message;else api()?.notify?.(message)}
function done(message){close();renderCurrent();api()?.notify?.(message||'تم حفظ التغييرات ✓')}
function renderCurrent(){const view=document.querySelector('#page-calendar.on,#page-reminders.on,#page-notes.on,#page-health.on,#page-routines.on,#page-planning.on,#page-privacy.on,#page-coach.on');if(view)window.YawmiLife?.render(view.id.replace('page-',''))}
function localDayEvent(e,d){return e?.date===d||(e?.repeat==='yearly'&&e?.date?.slice(5)===d.slice(5)&&e.date<=d)}
function taskActive(t,d){
 if(!t?.title||t.active===false)return false;
 const base=t.date||day(),dow=toDate(d).getDay();
 if(d<base)return false;
 switch(t.repeat){
 case 'daily':return true;
 case 'weekdays':return dow!==5&&dow!==6;
 case 'weekends':return dow===5||dow===6;
 case 'weekly':return toDate(base).getDay()===dow;
 case 'custom':return Array.isArray(t.weekDays)&&t.weekDays.includes(dow);
 default:return d===base;
 }
}
function habitActive(h,d){
 if(!h?.title||h.active===false)return false;
 const dow=toDate(d).getDay(),base=h.created?ymd(new Date(h.created)):null;
 if(base&&d<base)return false;
 switch(h.repeat){
 case 'daily':return true;
 case 'weekdays':return dow!==5&&dow!==6;
 case 'weekends':return dow===5||dow===6;
 case 'weekly':return Array.isArray(h.weekDays)&&h.weekDays.length?h.weekDays.includes(dow):(!base||toDate(base).getDay()===dow);
 case 'custom':return Array.isArray(h.weekDays)&&h.weekDays.includes(dow);
 default:return !h.repeat;
 }
}
function financeBillVisible(){return window.YawmiLife?.isPrivacyLocked?.('money')!==true}
function itemsOn(d){
 const s=state();if(!s||!validDay(d))return [];
 const out=[];
 for(const e of s.lifeCalendar){if(localDayEvent(e,d))out.push({id:e.id,type:e.type||'event',date:d,time:e.time||'',end:e.end||'',title:e.title,note:e.note||'',source:'event',editable:true})}
 for(const t of s.tasks||[])if(taskActive(t,d))out.push({id:t.id,type:'task',date:d,time:t.time||'',title:t.title,done:!!s.daily?.[d]?.tasks?.[t.id],source:'task'});
 const active=(s.habits||[]).filter(h=>habitActive(h,d));
 if(active.length){const completed=active.filter(h=>Number(s.daily?.[d]?.habits?.[h.id]||0)>=(Number(h.target)||1)).length;
  out.push({id:'habits',type:'habit',title:'العادات ('+completed+'/'+active.length+')',date:d,source:'habit',time:'',done:completed===active.length})}
 for(const r of s.finance?.recurring||[]){
  if(!r||!Number.isInteger(Number(r.day)))continue;
  const [yy,mm]=d.slice(0,7).split('-').map(Number),lastDate=new Date(yy,mm,0).getDate();
  const due=d.slice(0,7)+'-'+String(Math.max(1,Math.min(lastDate,Number(r.day)))).padStart(2,'0');
  if(d===due)out.push({id:r.id,type:'bill',title:financeBillVisible()?r.title:'موعد التزام مالي خاص',date:d,time:'09:00',source:'bill',
  done:(s.finance?.transactions||[]).some(t=>t.recurringId===r.id&&monthOf(t.date)===monthOf(d))});
 }
 for(const r of s.lifeReminders){if(localDayEvent(r,d)&&!r.hidden)out.push({id:r.id,type:'reminder',date:d,time:r.time||'',title:r.title,source:'reminder',done:!!r.done&&r.repeat!=='yearly'})}
 return out.sort((a,b)=>String(a.time||'99:99').localeCompare(String(b.time||'99:99'))||a.type.localeCompare(b.type));
}
const typeStyle={event:['📅','موعد'],appointment:['📍','مقابلة'],timeblock:['⏳','حجز وقت'],task:['☑','مهمة'],habit:['◉','عادات'],bill:['🧾','التزام'],reminder:['🔔','تذكير']};
function itemMarkup(x){
 const k=typeStyle[x.type]||typeStyle.event;
 return '<div class="yl-agenda-item"><span class="yl-agenda-icon">'+k[0]+'</span><div class="yl-agenda-info"><b>'+esc(x.title)+'</b><small>'+esc(k[1])+(x.time?' · '+esc(x.time)+(x.end?' – '+esc(x.end):''):'')+(x.done?' · ✓ مكتمل':'')+'</small>'+(x.note?'<p>'+esc(x.note)+'</p>':'')+'</div>'+
 (x.source==='event'?btn('تعديل','data-life-event-edit="'+esc(x.id)+'"'):x.source==='reminder'?btn('عرض','data-life-open-reminder="'+esc(x.id)+'"'):'')+'</div>';
}
function calendar(){
 const rootEl=root('calendar');if(!rootEl)return;const s=state();if(!s)return;
 const [y,m]=monthOf(calDay).split('-').map(Number);
 const now=day(),first=new Date(y,m-1,1,12),start=(first.getDay()+1)%7,days=new Date(y,m,0).getDate();
 let viewHtml='';
 if(calView==='month'){
  const cells=[];for(let i=0;i<start;i++)cells.push('<span class="yl-calendar-pad" aria-hidden="true"></span>');
  for(let i=1;i<=days;i++){
   const d=monthOf(calDay)+'-'+String(i).padStart(2,'0'),items=itemsOn(d);
   const visible=items.slice(0,2).map(x=>'<span>'+esc((typeStyle[x.type]||typeStyle.event)[0])+' '+esc(x.title)+'</span>').join('');
   cells.push('<button type="button" class="yl-cal-cell '+(calDay===d?'selected ':'')+(now===d?'today':'')+'" data-life-pick-day="'+d+'" aria-label="'+esc(shortDay(d))+'، '+items.length+' أحداث"><strong>'+i+'</strong>'+visible+
   (items.length>2?'<small>+'+(items.length-2)+' أحداث</small>':'')+'</button>');
  }
  viewHtml='<div class="yl-cal-grid">'+['س','ح','ن','ث','ر','خ','ج'].map(x=>'<span class="yl-cal-weekday">'+x+'</span>').join('')+cells.join('')+'</div>';
 }else if(calView==='week'){
  const d=toDate(calDay),weekStart=add(calDay,-((d.getDay()+1)%7));
  viewHtml='<div class="yl-week-grid">'+Array.from({length:7},(_,i)=>{const date=add(weekStart,i),items=itemsOn(date);
  return '<button type="button" data-life-pick-day="'+date+'" class="'+(calDay===date?'selected':'')+'"><b>'+esc(shortDay(date))+'</b><small>'+items.length+' عناصر</small></button>'}).join('')+'</div>';
 }else viewHtml='<p class="yl-callout">عرض اليوم يركز على جدول المواعيد والمهام والعادات في التاريخ المحدد.</p>';
 const agenda=itemsOn(calDay);
 rootEl.innerHTML='<div class="yl-hero"><div><span>CALENDAR · التقويم الموحد</span><h2>كل يومك، في مكان واحد</h2><p>شوف المواعيد والمهام والعادات والفواتير، ونظّم ساعات يومك من غير تكرار سجلاتك.</p></div><div>'+btn('＋ موعد أو حجز وقت','data-life-event-new','primary')+'</div></div>'+
 '<div class="yl-surface"><div class="yl-toolbar"><div class="yl-calendar-nav">'+btn('‹','data-life-cal-prev')+'<b>'+esc(monthName(monthOf(calDay)))+'</b>'+btn('›','data-life-cal-next')+btn('اليوم','data-life-cal-today')+'</div>'+
 '<div class="yl-segment">'+['month','week','day'].map((v,i)=>'<button type="button" data-life-cal-view="'+v+'" class="'+(calView===v?'active':'')+'">'+['شهر','أسبوع','يوم'][i]+'</button>').join('')+'</div></div>'+
 viewHtml+'</div><div class="yl-surface"><div class="yl-toolbar"><div><h3>جدول '+esc(shortDay(calDay))+'</h3><small>من المهام والعادات الموجودة، والمواعيد الجديدة</small></div>'+btn('＋ موعد','data-life-event-new','primary')+'</div>'+
 (agenda.length?'<div class="yl-agenda-list">'+agenda.map(itemMarkup).join('')+'</div>':empty('اليوم ده هادي','أضف موعدًا، أو ارجع للمهام لتوزيع أعمالك.'))+'</div>'+
 '<p class="yl-disclaimer">العادات والمهام معروضة من بياناتك الأصلية. التقويم لا يمنح XP ولا يُكمل مهمة تلقائيًا.</p>';
}
function shiftCalendar(n){if(calView==='day')calDay=add(calDay,n);else if(calView==='week')calDay=add(calDay,7*n);
 else{const d=toDate(calDay);d.setDate(1);d.setMonth(d.getMonth()+n);calDay=ymd(d)}calendar()}
function eventForm(idValue){
 if(!canWrite())return api()?.notify?.('سجّل الدخول أولاً.');
 const v=state(),x=v.lifeCalendar.find(a=>a.id===idValue);editing=idValue||null;activeModal='event';
 show('<form id="ylEventForm">'+formTitle('PERSONAL PLANNER',x?'تعديل الموعد':'موعد جديد أو حجز وقت')+
 '<div class="yl-form-grid">'+field('اسم الموعد',input('ylEventTitle',x?.title||'','text','maxlength="100" required placeholder="اجتماع، درس، موعد مهم"'))+
 field('التاريخ',input('ylEventDate',x?.date||calDay,'date','required'))+
 field('النوع','<select id="ylEventType">'+[['event','موعد'],['appointment','مقابلة / زيارة'],['timeblock','حجز وقت للتركيز']].map(z=>'<option value="'+z[0]+'" '+(x?.type===z[0]?'selected':'')+'>'+z[1]+'</option>').join('')+'</select>')+
 field('الساعة',input('ylEventTime',x?.time||'09:00','time','required'))+
 field('نهاية الموعد (اختياري)',input('ylEventEnd',x?.end||'','time'))+
 field('يتكرر','<select id="ylEventRepeat"><option value="none">مرة واحدة</option><option value="yearly" '+(x?.repeat==='yearly'?'selected':'')+'>سنويًا</option></select>')+
 field('ذكّرني','<select id="ylEventRemind">'+[['none','بدون تنبيه'],['0','وقت الموعد'],['10','قبل 10 دقائق'],['60','قبل ساعة'],['1440','قبل يوم']].map(z=>'<option value="'+z[0]+'" '+(String(x?.remind??'none')===z[0]?'selected':'')+'>'+z[1]+'</option>').join('')+'</select>')+
 field('ملاحظات',input('ylEventNote',x?.note||'','text','maxlength="260" placeholder="اختياري"'))+'</div>'+
 (x?btn('حذف الموعد','data-life-event-delete="'+esc(x.id)+'"','danger'):'')+
 actions()+'</form>');
}
function saveEvent(){
 const s=state(),title=$('ylEventTitle').value.trim().slice(0,100),date=$('ylEventDate').value,time=$('ylEventTime').value,end=$('ylEventEnd').value;
 if(!title||!validDay(date)||!validTime(time)||(end&&!validTime(end)))return error('اكتب اسمًا وتاريخًا ووقتًا صحيحًا.');
 if(end&&end<=time)return error('وقت النهاية لازم يكون بعد البداية.');
 const remind=$('ylEventRemind').value,repeat=$('ylEventRepeat').value;
 const hasConflict=s.lifeCalendar.some(existing=>{
  if(existing.id===editing||!localDayEvent(existing,date)||!validTime(existing.time))return false;
  const existingEnd=validTime(existing.end)?existing.end:existing.time;
  const newEnd=end||time;
  return time===existing.time||(end&&existingEnd&&time<existingEnd&&newEnd>existing.time);
 });
 if(hasConflict&&!confirm('فيه موعد تاني في نفس الوقت أو فترة متداخلة. تحب تحفظ الموعد الجديد رغم التداخل؟'))return;
 const item={id:editing||id(),title,date,time,end,type:$('ylEventType').value,repeat:repeat==='yearly'?'yearly':'none',remind,
 note:$('ylEventNote').value.trim().slice(0,260),updatedAt:new Date().toISOString()};
 const old=s.lifeCalendar.find(x=>x.id===editing);if(old)Object.assign(old,item);else s.lifeCalendar.push(item);
 if(!save())return error('تعذر حفظ الموعد.');calDay=date;done();
}
function deleteItem(arrayName,target,label){const s=state(),item=s?.[arrayName]?.find(x=>x.id===target);if(!item||!confirm('حذف '+label+' «'+item.title+'»؟'))return false;s[arrayName]=s[arrayName].filter(x=>x.id!==target);if(!save())return false;done('تم الحذف');return true}
function repeatDate(x,nowDay){
 if(x.repeat!=='yearly')return x.date;
 if(!validDay(x.date))return '';
 const todayMonth=nowDay.slice(5),eventMonth=x.date.slice(5),base=nowDay.slice(0,4)+'-'+eventMonth;
 if(!validDay(base))return '';
 return eventMonth>=todayMonth?base:(Number(nowDay.slice(0,4))+1)+'-'+eventMonth;
}
function potentialNotifications(){
 const s=state();if(!s)return [];const out=[];
 for(const e of s.lifeCalendar){
  if(!e.remind||e.remind==='none'||!validTime(e.time))continue;
  const date=repeatDate(e,day());if(!validDay(date))continue;
  const lead=Number(e.remind)||0;
  out.push({key:'evt-'+e.id+'-'+date,due:new Date(date+'T'+e.time+':00').getTime()-lead*60000,label:e.title,origin:'موعد'});
 }
 for(const r of s.lifeReminders){
  if(r.done&&r.repeat!=='yearly'||!validTime(r.time))continue;
  const date=repeatDate(r,day());if(!validDay(date))continue;
  out.push({key:'rem-'+r.id+'-'+date,due:new Date(date+'T'+r.time+':00').getTime()-(Number(r.lead)||0)*60000,label:r.title,origin:'تذكير'});
 }
 for(const r of s.finance?.recurring||[]){
  const y=Number(day().slice(0,4)),m=Number(day().slice(5,7));if(!Number.isInteger(Number(r.day)))continue;
  const dueDay=Math.min(new Date(y,m,0).getDate(),Math.max(1,Number(r.day)));
  const date=day().slice(0,7)+'-'+String(dueDay).padStart(2,'0');
  const done=(s.finance?.transactions||[]).some(t=>t.recurringId===r.id&&monthOf(t.date)===monthOf(date));
  if(!done)out.push({key:'bill-'+r.id+'-'+date,due:new Date(date+'T09:00:00').getTime(),
  label:financeBillVisible()?r.title:'التزام مالي خاص',origin:'فاتورة'});
 }
 return out.filter(x=>Number.isFinite(x.due)).sort((a,b)=>a.due-b.due);
}
function reminderForm(reminderId){
 if(!canWrite())return;const s=state(),e=s.lifeReminders.find(x=>x.id===reminderId);
 editing=reminderId||null;activeModal='reminder';
 show('<form id="ylReminderForm">'+formTitle('NOTIFICATIONS',e?'تعديل التذكير':'تذكير جديد')+
 '<div class="yl-form-grid">'+field('اسم التذكير',input('ylRemTitle',e?.title||'','text','maxlength="100" required placeholder="موعد، مناسبة، حاجة لازم أفتكرها"'))+
 field('التاريخ',input('ylRemDate',e?.date||day(),'date','required'))+
 field('الوقت',input('ylRemTime',e?.time||'09:00','time','required'))+
 field('قبل الموعد','<select id="ylRemLead">'+[['0','وقت التذكير'],['10','10 دقائق'],['60','ساعة'],['1440','يوم']].map(z=>'<option value="'+z[0]+'" '+(String(e?.lead||0)===z[0]?'selected':'')+'>'+z[1]+'</option>').join('')+'</select>')+
 field('التكرار','<select id="ylRemRepeat"><option value="none">مرة واحدة</option><option value="yearly" '+(e?.repeat==='yearly'?'selected':'')+'>كل سنة (مناسبات وأعياد ميلاد)</option></select>')+
 '</div>'+actions()+(e?btn('حذف التذكير','data-life-rem-delete="'+esc(e.id)+'"','danger'):'')+'</form>');
}
function saveReminder(){
 const s=state(),date=$('ylRemDate').value,time=$('ylRemTime').value,title=$('ylRemTitle').value.trim().slice(0,100);
 if(!title||!validDay(date)||!validTime(time))return error('اكتب تاريخ ووقت ووصف التذكير.');
 const v={id:editing||id(),date,title,time,lead:Number($('ylRemLead').value)||0,repeat:$('ylRemRepeat').value,done:false,updatedAt:new Date().toISOString()};
 const old=s.lifeReminders.find(x=>x.id===editing);if(old)Object.assign(old,v);else s.lifeReminders.push(v);
 if(!save())return error('تعذر حفظ التذكير');done();
}
async function enableNotifications(){
 if(!('Notification' in window)||!window.isSecureContext){api()?.notify?.('إشعارات الجهاز غير متاحة في المتصفح ده. التذكيرات داخل التطبيق ستظل موجودة.');return}
 let perm=Notification.permission;try{if(perm==='default')perm=await Notification.requestPermission()}catch(_){}
 const s=state();if(!s)return;
 s.lifeNotificationPrefs.enabled=perm==='granted';save();render('reminders');
 api()?.notify?.(perm==='granted'?'تم تفعيل إذن الإشعارات، بشرط بقاء التطبيق مفتوحًا.':'إذن الإشعارات غير مفعّل.');
}
async function showNativeNotification(key){
 const title='تذكير من يومي';
 const options={body:'افتح يومي لمراجعة تذكيراتك الخاصة',tag:key,icon:'./icon-192.png'};
 if(navigator.serviceWorker?.ready){try{const sw=await navigator.serviceWorker.ready;await sw.showNotification(title,options);return true}catch(_){}}
 try{new Notification(title,options);return true}catch(_){return false}
}
async function checkNotifications(){
 const s=state();if(!s||!s.lifeNotificationPrefs.enabled||!('Notification' in window)||Notification.permission!=='granted'||document.hidden||notifyBusy||!canWrite())return;
 notifyBusy=true;
 try{
 const now=Date.now(),fired=new Set(s.lifeNotificationSeen);
 const pending=potentialNotifications().filter(x=>x.due<=now&&x.due>=now-5*60000&&!fired.has(x.key)).slice(0,3);
 for(const x of pending){
  const sent=await showNativeNotification(x.key);
  if(sent){s.lifeNotificationSeen.push(x.key);s.lifeNotificationSeen=s.lifeNotificationSeen.slice(-250);save()}
 }
 }finally{notifyBusy=false}
}
function reminders(){
 const el=root('reminders');if(!el)return;const s=state(),now=Date.now();
 const all=potentialNotifications().filter(x=>x.due>=now-86400000).slice(0,40);
 const stored=s.lifeReminders.slice().sort((a,b)=>b.date.localeCompare(a.date));
 const permission=('Notification' in window)?Notification.permission:'unsupported';
 el.innerHTML='<div class="yl-hero"><div><span>REMINDERS · مركز التذكيرات</span><h2>افتكر المهم من غير توتر</h2><p>مواعيدك، مناسباتك والالتزامات الشهرية مع تذكيرات مخصصة.</p></div>'+
 btn('＋ تذكير','data-life-rem-new','primary')+'</div>'+
 '<div class="yl-surface yl-callout"><b>إشعارات المتصفح: '+(permission==='granted'?'مسموح بها':permission==='denied'?'مرفوضة':'غير مفعّلة')+'</b>'+
 '<p>الإشعارات المجانية هنا تعمل أثناء فتح التطبيق فقط؛ لا نضمن وصولها بعد إغلاق المتصفح أو إيقاف الجهاز. راجع التذكيرات داخل يومي دائمًا.</p>'+
 btn('تفعيل إذن الإشعارات','data-life-ask-notify','primary')+'</div>'+
 '<div class="yl-twocol"><section class="yl-surface"><h3>التنبيهات القادمة</h3>'+
 (all.length?all.map(x=>'<div class="yl-record"><div><b>🔔 '+esc(x.label)+'</b><small>'+esc(x.origin)+' · '+new Date(x.due).toLocaleString('ar-EG-u-ca-gregory')+'</small></div></div>').join(''):empty('مافيش تذكيرات قريبة','أضف تذكيرًا أو موعدًا من التقويم.'))+'</section>'+
 '<section class="yl-surface"><div class="yl-toolbar"><h3>التذكيرات المحفوظة</h3>'+btn('＋ جديد','data-life-rem-new')+'</div>'+
 (stored.length?stored.map(x=>'<div class="yl-record"><div><b>'+esc(x.title)+'</b><small>'+esc(x.date)+' · '+esc(x.time)+' · '+(x.repeat==='yearly'?'سنوي':'مرة واحدة')+'</small></div>'+
 btn('تعديل','data-life-open-reminder="'+esc(x.id)+'"')+'</div>').join(''):empty('ابدأ بتذكيرك الأول','مناسبة أو تجديد اشتراك أو امتحان.'))+'</section></div>';
}
function tags(text){return [...new Set(String(text||'').split(/[,،]/).map(x=>x.trim()).filter(Boolean))].slice(0,8).map(x=>x.slice(0,25))}
function filteredNotes(){
 const s=state();if(!s)return [];
 return s.lifeNotes.filter(x=>!noteFav||x.favorite).filter(x=>[x.title,x.body,(x.tags||[]).join(' ')].join(' ').toLocaleLowerCase().includes(noteQuery.trim().toLocaleLowerCase()))
 .slice().sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));
}
function notes(){
 const el=root('notes');if(!el)return;const data=filteredNotes();
 el.innerHTML='<div class="yl-hero"><div><span>IDEA VAULT · بنك الأفكار</span><h2>ولا فكرة تضيع منك ✨</h2><p>ملاحظات سريعة واقتباسات وروابط، مع بحث ووسوم وتحويل إلى مهام أو أهداف.</p></div>'+
 btn('＋ ملاحظة','data-life-note-new','primary')+'</div>'+
 '<section class="yl-surface"><div class="yl-toolbar"><input class="yl-search" id="ylNoteSearch" type="search" placeholder="ابحث داخل الملاحظات والوسوم…" aria-label="بحث في الملاحظات" value="'+esc(noteQuery)+'">'+btn(noteFav?'★ المفضلة فقط':'☆ المفضلة','data-life-notes-fav')+'</div>'+
 (data.length?'<div class="yl-notes-grid">'+data.map(x=>'<article class="yl-note"><div><small>'+esc(x.updatedAt?.slice(0,10)||'')+'</small>'+
 btn(x.favorite?'★':'☆','data-life-note-fav="'+esc(x.id)+'"')+'</div><h3>'+esc(x.title)+'</h3>'+
 '<p>'+esc(x.body.length>240?x.body.slice(0,240)+'…':x.body)+'</p>'+
 '<div class="yl-tags">'+(x.tags||[]).map(t=>'<span>#'+esc(t)+'</span>').join('')+'</div>'+
 '<footer>'+btn('تعديل','data-life-note-edit="'+esc(x.id)+'"')+
 btn(x.convertedTaskId?'✓ تحوّلت لمهمة':'↗ إلى مهمة','data-life-note-to-task="'+esc(x.id)+'"','soft')+
 btn(x.convertedGoalId?'✓ تحوّلت لهدف':'◎ إلى هدف','data-life-note-to-goal="'+esc(x.id)+'"','soft')+'</footer></article>').join('')+'</div>':
 empty('مساحتك للأفكار','احفظ فكرة مشروع، رابط أو اقتباس، واسترجعها وقت ما تحتاج.'))+'</section>';
}
function noteForm(idValue){
 if(!canWrite())return;const s=state(),n=s.lifeNotes.find(x=>x.id===idValue);editing=idValue||null;activeModal='note';
 show('<form id="ylNoteForm">'+formTitle('IDEA VAULT',n?'تعديل الملاحظة':'التقط فكرتك')+
 field('العنوان',input('ylNoteTitle',n?.title||'','text','maxlength="100" required placeholder="عنوان يساعدك تفتكر"'))+
 field('التفاصيل','<textarea id="ylNoteBody" maxlength="5000" rows="8" placeholder="اكتب فكرتك أو رابط الموقع أو المعلومة…">'+esc(n?.body||'')+'</textarea>')+
 field('وسوم (افصل بفاصلة)',input('ylNoteTags',(n?.tags||[]).join('، '),'text','maxlength="250" placeholder="شغل، فكرة، ملخص"'))+
 '<label class="yl-inline-check"><input type="checkbox" id="ylNoteFavorite" '+(n?.favorite?'checked':'')+'> ملاحظة مفضلة</label>'+
 (n?btn('حذف الملاحظة','data-life-note-delete="'+esc(n.id)+'"','danger'):'')+actions()+'</form>');
}
function saveNote(){
 const s=state(),title=$('ylNoteTitle').value.trim().slice(0,100),body=$('ylNoteBody').value.trim().slice(0,5000);
 if(!title)return error('اسم الملاحظة مطلوب.');
 const n=s.lifeNotes.find(x=>x.id===editing);
 const data={id:n?.id||id(),title,body,tags:tags($('ylNoteTags').value),favorite:$('ylNoteFavorite').checked,
  createdAt:n?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
 if(n)Object.assign(n,data);else s.lifeNotes.push(data);if(!save())return error('تعذر حفظ الملاحظة.');
 done();
}
function convertNote(idValue,kind){
 const s=state(),n=s.lifeNotes.find(x=>x.id===idValue);if(!n)return;
 const field=kind==='task'?'convertedTaskId':'convertedGoalId',array=kind==='task'?'tasks':'goals';
 if(n[field]&&s[array]?.some(x=>x.id===n[field])){api()?.notify?.('تم تحويل الملاحظة من قبل. تقدر تلاقيها في قسم '+(kind==='task'?'المهام':'الأهداف'));return}
 if(!confirm('تحويل «'+n.title+'» إلى '+(kind==='task'?'مهمة':'هدف')+' جديد؟ مش هتتحسب منجزة تلقائيًا.'))return;
 const ref=id();
 if(kind==='task'){
  if(!Array.isArray(s.tasks))return;
  s.tasks.push({id:ref,title:n.title.slice(0,140),category:'discipline',repeat:'once',date:day(),time:'',difficulty:1,priority:'medium',
  notes:n.body.slice(0,900),subtasks:[],weekDays:[]});
 }else{
  if(!Array.isArray(s.goals))s.goals=[];
  s.goals.push({id:ref,title:n.title.slice(0,140),kind:'custom',unit:'مرحلة',target:1,progress:0,progressEntries:[]});
 }
 n[field]=ref;if(save()){notes();api()?.notify?.('تمت الإضافة لقسم '+(kind==='task'?'المهام':'الأهداف'))}
}
function handleClick(e){
 const b=e.target.closest?.('button');if(!b)return;
 if(b.hasAttribute('data-life-close'))return close();
 if(b.hasAttribute('data-life-cal-prev'))return shiftCalendar(-1);
 if(b.hasAttribute('data-life-cal-next'))return shiftCalendar(1);
 if(b.hasAttribute('data-life-cal-today')){calDay=day();return calendar()}
 if(b.dataset.lifeCalView){calView=b.dataset.lifeCalView;return calendar()}
 if(b.dataset.lifePickDay){calDay=b.dataset.lifePickDay;return calendar()}
 if(b.hasAttribute('data-life-event-new'))return eventForm(null);
 if(b.dataset.lifeEventEdit)return eventForm(b.dataset.lifeEventEdit);
 if(b.dataset.lifeEventDelete)return deleteItem('lifeCalendar',b.dataset.lifeEventDelete,'الموعد');
 if(b.hasAttribute('data-life-rem-new'))return reminderForm(null);
 if(b.dataset.lifeOpenReminder)return reminderForm(b.dataset.lifeOpenReminder);
 if(b.dataset.lifeRemDelete)return deleteItem('lifeReminders',b.dataset.lifeRemDelete,'التذكير');
 if(b.hasAttribute('data-life-ask-notify'))return enableNotifications();
 if(b.hasAttribute('data-life-note-new'))return noteForm(null);
 if(b.dataset.lifeNoteEdit)return noteForm(b.dataset.lifeNoteEdit);
 if(b.dataset.lifeNoteDelete)return deleteItem('lifeNotes',b.dataset.lifeNoteDelete,'الملاحظة');
 if(b.dataset.lifeNoteFav){const n=state().lifeNotes.find(x=>x.id===b.dataset.lifeNoteFav);if(n){n.favorite=!n.favorite;if(save())notes()}return}
 if(b.hasAttribute('data-life-notes-fav')){noteFav=!noteFav;return notes()}
 if(b.dataset.lifeNoteToTask)return convertNote(b.dataset.lifeNoteToTask,'task');
 if(b.dataset.lifeNoteToGoal)return convertNote(b.dataset.lifeNoteToGoal,'goal');
}
function handleSubmit(e){
 if(!['ylEventForm','ylReminderForm','ylNoteForm'].includes(e.target?.id))return;
 e.preventDefault();if(e.target.id==='ylEventForm')saveEvent();
 if(e.target.id==='ylReminderForm')saveReminder();
 if(e.target.id==='ylNoteForm')saveNote();
}
function init(){
 document.addEventListener('click',handleClick);
 document.addEventListener('submit',handleSubmit);
 document.addEventListener('input',e=>{if(e.target?.id==='ylNoteSearch'){noteQuery=e.target.value;notes();const box=$('ylNoteSearch');if(box){box.focus();box.setSelectionRange(noteQuery.length,noteQuery.length)}}});
 window.setInterval(checkNotifications,30000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkNotifications()});
}
function render(tab){if(tab==='calendar')calendar();if(tab==='reminders')reminders();if(tab==='notes')notes();
 if(['health','routines','planning','coach'].includes(tab))window.YawmiLifeGrowth?.render(tab);
 if(tab==='privacy')window.YawmiLifePrivacy?.render();
}
window.YawmiLife={render,state,save,canWrite,esc,day,add,ymd,validDay,validTime,shortDay,monthName,itemsOn,taskActive,habitActive,
 root,dialog,show,close,formTitle,field,input,btn,actions,error,done,empty,id,
 privacyGate:()=>true,isPrivacyLocked:()=>false,notifications:potentialNotifications,checkNotifications};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();