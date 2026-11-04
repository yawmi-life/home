/* YAWMI V32: private daily diary, offline-synced drafts, moods, prompts, memories, search and export. */
(()=>{'use strict';
const $=id=>document.getElementById(id),api=()=>window.YawmiExtraAPI;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const moods=[['1','😔','صعب'],['2','😕','متعب'],['3','😌','عادي'],['4','🙂','كويس'],['5','🤩','رائع']];
const prompts=[
 ['✨','أجمل لحظة','إيه أجمل حاجة حصلت النهاردة، حتى لو كانت صغيرة؟'],
 ['🌿','الامتنان','اكتب 3 حاجات ممتن ليها النهاردة.'],
 ['🧠','حاجة اتعلمتها','إيه فكرة أو درس جديد خرجت بيه من يومك؟'],
 ['💭','فضفضة هادية','إيه الحاجة اللي شاغلة بالك؟ وإيه ممكن يخفّفها؟'],
 ['🎯','تقدم بسيط','إيه خطوة صغيرة عملتها النهاردة وعايز تفتكرها؟'],
 ['🌙','قبل النوم','إيه اللي عايز تسيبه وراك قبل ما تنام؟'],
 ['💌','رسالة لنفسي','لو هتبعت رسالة لنفسك بعد سنة، هتكتب إيه؟'],
 ['☀️','بداية جديدة','إيه أهم نية أو هدف بسيط عايز تبدأ بيه يومك؟']
];
const timeFmt=date=>{try{return new Intl.DateTimeFormat('ar-EG',{day:'numeric',month:'long',year:'numeric'}).format(new Date(date+'T12:00:00'))}catch(_){return date}};
const monthText=m=>{try{return new Intl.DateTimeFormat('ar-EG',{month:'long',year:'numeric'}).format(new Date(m+'-01T12:00:00'))}catch(_){return m}};
const today=()=>api()?.today?.()||new Date().toISOString().slice(0,10);
const validDate=x=>/^\d{4}-\d{2}-\d{2}$/.test(String(x||''))&&!Number.isNaN(Date.parse(x+'T12:00:00'))&&new Date(x+'T12:00:00').toISOString().slice(0,10)===x;
const countWords=x=>(String(x||'').trim().match(/\S+/g)||[]).length;
const moodOf=n=>moods.find(x=>x[0]===String(n||3))||moods[2];
const normalizeTags=text=>[...new Set(String(text||'').split(/[,،؛]/).map(t=>t.trim().replace(/\s+/g,' ').slice(0,22)).filter(Boolean))].slice(0,8);
const safeEntries=a=>Array.isArray(a)?a.filter(x=>x&&typeof x==='object'&&typeof x.id==='string'&&validDate(x.date)):[];
const newId=()=>api()?.uid?.()||('j'+Date.now().toString(36));
let search='',moodFilter='all',onlyFavorites=false,view='timeline',dateFilter='',currentMonth=today().slice(0,7);
let draftTimer=null,draftStatus='مسودة غير محفوظة بعد',editing=false,selection='',note='';let latestState=null;
function state(){
 const s=api()?.getState?.();if(!s)return null;
 if(!Array.isArray(s.journalEntries))s.journalEntries=[];
 if(s.journalDraft&&!s.journalDraft.draftId)s.journalDraft=null;
 return s;
}
function entries(){return safeEntries(state()?.journalEntries);}
const canWrite=()=>Boolean(state()&&(!window.YawmiCloud?.configured||window.YawmiCloud?.ready));
const save=()=>canWrite()&&api().save()!==false;
const todayEntries=()=>entries().filter(x=>x.date===today());
function summarize(){
 const list=entries(),month=currentMonth;
 const monthList=list.filter(x=>x.date.slice(0,7)===month);
 const words=monthList.reduce((a,e)=>a+countWords(e.body),0);
 const days=new Set(list.map(e=>e.date));
 let streak=0;let d=new Date(today()+'T12:00:00');
 if(!days.has(today()))d.setDate(d.getDate()-1);
 for(let i=0;i<1000;i++){
  const day=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
  if(!days.has(day))break;streak++;d.setDate(d.getDate()-1);
 }
 const avg=monthList.length?Math.round(monthList.reduce((a,x)=>a+Number(x.mood||3),0)/monthList.length*10)/10:null;
 const memories=list.filter(x=>x.date.slice(5)===today().slice(5)&&x.date.slice(0,4)<today().slice(0,4))
  .sort((a,b)=>b.date.localeCompare(a.date));
 return {all:list.length,monthEntries:monthList.length,activeDays:new Set(monthList.map(x=>x.date)).size,words,streak,avg,memories};
}
function calendar(){
 const [year,month]=currentMonth.split('-').map(Number);
 const first=new Date(year,month-1,1,12),length=new Date(year,month,0).getDate();
 const start=(first.getDay()+1)%7;
 const dayMap=new Map();for(const e of entries())dayMap.set(e.date,(dayMap.get(e.date)||0)+1);
 let cells='';
 for(let i=0;i<start;i++)cells+='<span class="ym-diary-calendar-space" aria-hidden="true"></span>';
 for(let i=1;i<=length;i++){
  const key=currentMonth+'-'+String(i).padStart(2,'0'),n=dayMap.get(key)||0;
  cells+='<button type="button" data-diary-date="'+key+'" aria-label="'+esc(key)+'، '+(n?n+' تدوينة':'بدون تدوينات')+'" class="'+(n?'has-entry ':'')+(dateFilter===key?'selected ':'')+(key===today()?'today':'')+'">'+i+(n?'<i aria-hidden="true"></i>':'')+'</button>';
 }
 return '<div class="ym-diary-calendar"><div class="ym-diary-calendar-head"><h3>تقويم الذكريات</h3><div>'+
 '<button type="button" data-diary-month="-1" aria-label="الشهر السابق">‹</button><b>'+esc(monthText(currentMonth))+'</b><button type="button" data-diary-month="1" aria-label="الشهر التالي">›</button></div></div>'+
 '<div class="ym-diary-calendar-grid" role="group" aria-label="تقويم تدوينات '+esc(monthText(currentMonth))+'">'+
 ['س','ح','ن','ث','ر','خ','ج'].map(x=>'<span class="weekday">'+x+'</span>').join('')+cells+'</div>'+
 (dateFilter?'<button type="button" class="ym-diary-clear-date" data-diary-clear-date>عرض كل الأيام ×</button>':'')+'</div>';
}
function filtered(){
 return entries().filter(e=>{
  if(dateFilter&&e.date!==dateFilter)return false;
  if(moodFilter!=='all'&&String(e.mood)!==moodFilter)return false;
  if(onlyFavorites&&!e.favorite)return false;
  const q=search.trim().toLocaleLowerCase();
  return !q||[e.title,e.body,e.gratitude,(e.tags||[]).join(' ')].some(x=>String(x||'').toLocaleLowerCase().includes(q));
 }).sort((a,b)=>b.date.localeCompare(a.date)||String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
}
function truncate(s,max=185){const str=String(s||'').trim();return str.length>max?str.slice(0,max).trim()+'…':str}
function entriesMarkup(list){
 if(!list.length)return '<div class="ym-diary-empty"><span>✦</span><h3>كل يوم بداية حكاية جديدة</h3><p>مفيش تدوينات مطابقة هنا. ابدأ بذكرى صغيرة، أو غيّر الفلاتر.</p><button type="button" class="btn" data-diary-new>＋ اكتب يومياتك</button></div>';
 return '<div class="ym-diary-entry-list">'+list.slice(0,100).map(e=>{
  const m=moodOf(e.mood),tags=Array.isArray(e.tags)?e.tags:[];
  return '<article class="ym-diary-entry">'+
   '<div class="ym-diary-entry-top"><span class="ym-diary-entry-mood" aria-label="المزاج '+esc(m[2])+'">'+m[1]+'</span>'+
   '<div><span class="ym-diary-entry-date">'+esc(timeFmt(e.date))+'</span><h3>'+esc(e.title||'يوم من حياتي')+'</h3></div>'+
   '<button type="button" class="ym-diary-star '+(e.favorite?'is-fav':'')+'" data-diary-fav="'+esc(e.id)+'" aria-label="'+(e.favorite?'إزالة من المفضلة':'إضافة للمفضلة')+'">'+(e.favorite?'★':'☆')+'</button></div>'+
   (e.body?'<p class="ym-diary-preview">'+esc(truncate(e.body))+'</p>':'')+
   (e.gratitude?'<p class="ym-diary-gratitude">🌱 '+esc(truncate(e.gratitude,100))+'</p>':'')+
   '<div class="ym-diary-entry-bottom"><span>'+countWords(e.body)+' كلمة</span>'+
   '<div class="ym-diary-tag-list">'+tags.slice(0,5).map(t=>'<span>#'+esc(t)+'</span>').join('')+'</div>'+
   '<button type="button" data-diary-open="'+esc(e.id)+'">قراءة وتعديل <span aria-hidden="true">↗</span></button></div></article>';
 }).join('')+'</div>'+(list.length>100?'<p class="muted mini">تم عرض أحدث 100 تدوينة من نتائج البحث. ابحث بكلمة محددة للوصول للباقي.</p>':'');
}
function render(){
 const root=$('ymDiaryApp');if(!root)return;
 const s=state();if(!s)return;
 const sum=summarize(),data=filtered();
 const draft=s.journalDraft;
 root.innerHTML='<div class="ym-diary-hero"><div class="ym-diary-hero-copy"><span>MY JOURNAL · يومياتي</span>'+
 '<h2>كل يوم له قصة تستحق تتكتب 🌙</h2><p>مساحتك الهادية للذكريات، الامتنان، الأفكار والمواقف اللي عايز ترجع لها.</p>'+
 '<div class="ym-diary-hero-actions"><button type="button" class="ym-diary-primary" data-diary-new>✎ اكتب يومك</button>'+
 (draft?'<button type="button" class="ym-diary-draft-btn" data-diary-resume>↶ كمّل المسودة</button>':'')+
 '<button type="button" class="ym-diary-ghost" data-diary-export>⇩ تصدير اليوميات</button></div></div>'+
 '<div class="ym-diary-hero-symbol" aria-hidden="true">✧<span>✦</span></div></div>'+
 '<div class="ym-diary-stats"><div><small>كل تدويناتك</small><strong>'+sum.all+'</strong><span>ذكريات محفوظة</span></div>'+
 '<div><small>تدوينات الشهر</small><strong>'+sum.monthEntries+'</strong><span>'+sum.activeDays+' يوم كتابة</span></div>'+
 '<div><small>سلسلة الكتابة</small><strong>'+sum.streak+'</strong><span>من غير عقوبة لو فاتك يوم</span></div>'+
 '<div><small>كلمات الشهر</small><strong>'+sum.words.toLocaleString('ar-EG')+'</strong><span>'+(sum.avg?'متوسط المزاج '+sum.avg+'/5':'خد وقتك في الكتابة')+'</span></div></div>'+
 '<div class="ym-diary-body"><div class="ym-diary-main">'+
 '<section class="ym-diary-surface"><div class="ym-diary-section-title"><div><h3>تدويناتك</h3><small>كل التفاصيل هنا خاصة بحسابك فقط</small></div><button type="button" data-diary-new class="ym-diary-text-link">＋ تدوينة جديدة</button></div>'+
 '<div class="ym-diary-filters"><input id="ymDiarySearch" type="search" aria-label="البحث في اليوميات" placeholder="ابحث بكلمة، ذكرى، أو هاشتاج…" value="'+esc(search)+'">'+
 '<select id="ymDiaryMoodFilter" aria-label="تصفية حسب المزاج"><option value="all">كل الحالات</option>'+moods.map(m=>'<option value="'+m[0]+'" '+(moodFilter===m[0]?'selected':'')+'>'+m[1]+' '+m[2]+'</option>').join('')+'</select>'+
 '<button type="button" class="ym-diary-favorites '+(onlyFavorites?'active':'')+'" data-diary-favorites>'+ (onlyFavorites?'★ المفضلة':'☆ المفضلة')+'</button></div>'+
 '<div id="ymDiaryEntriesList">'+entriesMarkup(data)+'</div></section></div>'+
 '<aside class="ym-diary-side">'+calendar()+
 '<section class="ym-diary-prompt-card"><span>✍️ سؤال يساعدك تبدأ</span><h3>لو مش عارف تكتب إيه…</h3><p id="ymDiaryPromptText">'+esc(prompts[0][2])+'</p><div><button type="button" data-diary-prompt="0">ابدأ بالسؤال</button><button type="button" data-diary-prompt-next>سؤال تاني ↻</button></div></section>'+
 (sum.memories.length?'<section class="ym-diary-memory"><h3>🕰️ في مثل هذا اليوم</h3>'+sum.memories.slice(0,2).map(e=>'<button type="button" data-diary-open="'+esc(e.id)+'"><b>'+esc(e.title||'ذكرى من يومك')+'</b><small>'+esc(timeFmt(e.date))+'</small></button>').join('')+'</section>':
 '<section class="ym-diary-memory"><h3>🕰️ في مثل هذا اليوم</h3><p>لما تكتب سنة ورا سنة، هتبدأ تظهر لك ذكريات اليوم نفسه من السنين اللي فاتت.</p></section>')+
 '</aside></div><p class="ym-diary-footer-note">🔒 يومياتك مش بتظهر في الليدر بورد أو ملفك العام، ومش بتضيف XP. البيانات محفوظة ضمن حسابك ومزامنته، لكنها ليست مشفرة من طرف إلى طرف.</p>';
}
function refreshList(){const box=$('ymDiaryEntriesList');if(box)box.innerHTML=entriesMarkup(filtered())}
function diaryDialog(){
 let d=$('ymDiaryDialog');if(d)return d;
 d=document.createElement('dialog');d.id='ymDiaryDialog';d.className='ym-diary-dialog';d.setAttribute('aria-label','كتابة اليوميات');
 d.innerHTML='<div id="ymDiaryDialogContent"></div><button type="button" class="ym-diary-dialog-close" aria-label="إغلاق نافذة الكتابة" data-diary-close>✕</button>';
 document.body.appendChild(d);
 return d;
}
function draftFrom(e){
 return {draftId:e?.id||newId(),editingId:e?.id||null,date:e?.date||today(),
  title:e?.title||'',body:e?.body||'',gratitude:e?.gratitude||'',mood:Number(e?.mood)||3,
  tags:Array.isArray(e?.tags)?e.tags.join('، '):'',favorite:!!e?.favorite,updatedAt:new Date().toISOString()};
}
function openEditor(id=null,prompt=null){
 if(!canWrite())return api()?.notify?.('سجّل الدخول لحفظ يومياتك الخاصة.');
 const s=state();let d=s.journalDraft;
 if(id){const entry=entries().find(x=>x.id===id);if(!entry)return;
  if(d&&d.editingId!==id&&(d.body||d.title)&&!confirm('عندك مسودة تانية. فتح التدوينة دي هيستبدل المسودة. متأكد؟'))return;
  if(!d||d.editingId!==id)d=draftFrom(entry);
 }else if(!d||!d.draftId)d=draftFrom(null);
 if(prompt&&!d.body)d.body=prompt;
 s.journalDraft=d;save();drawEditor(d);
 const box=diaryDialog();if(!box.open)box.showModal();
}
function drawEditor(d){
 const dialog=diaryDialog(),text=String(d.body||'');
 $('ymDiaryDialogContent').innerHTML='<div class="ym-diary-editor-top"><span>PRIVATE JOURNAL ✦</span><h2>'+(d.editingId?'تدوينتك':'مساحة للكتابة من غير ضغط')+'</h2><p>اكتب بطريقتك. المسودة بتتحفظ تلقائيًا في بيانات حسابك، وممكن تكمّلها بعدين.</p></div>'+
 '<form id="ymDiaryForm"><div class="ym-diary-form-top"><label>التاريخ<input id="ymDiaryDate" type="date" value="'+esc(d.date)+'" required></label><label>عنوان التدوينة<input id="ymDiaryTitle" maxlength="130" value="'+esc(d.title||'')+'" placeholder="مثلاً: يوم هادي بعد أسبوع طويل"></label></div>'+
 '<div class="ym-diary-moods"><span>إحساسك النهاردة؟</span><div role="group" aria-label="اختيار مزاجك">'+moods.map(m=>
 '<button type="button" data-diary-mood="'+m[0]+'" aria-pressed="'+(Number(d.mood)===Number(m[0]))+'" class="'+(Number(d.mood)===Number(m[0])?'selected':'')+'"><span aria-hidden="true">'+m[1]+'</span><small>'+m[2]+'</small></button>').join('')+'</div></div>'+
 '<label class="ym-diary-writing-label" for="ymDiaryBody">حكاية اليوم <span id="ymDiaryWordCount">'+countWords(text)+' كلمة</span></label>'+
 '<textarea id="ymDiaryBody" maxlength="8000" rows="11" placeholder="اكتب اللي عايز تفتكره… كلامك هنا ليك أنت.">'+esc(text)+'</textarea>'+
 '<div class="ym-diary-guides"><button type="button" data-diary-insert-prompt>✧ فكرة للكتابة</button><span>مفيش حد أدنى للكلمات</span></div>'+
 '<label class="ym-diary-writing-label" for="ymDiaryGratitude">🌱 حاجة ممتن ليها</label>'+
 '<textarea id="ymDiaryGratitude" maxlength="1000" rows="2" placeholder="لحظة صغيرة عجبتك؟">'+esc(d.gratitude||'')+'</textarea>'+
 '<div class="ym-diary-form-bottom"><label>الوسوم (افصل بفاصلة)<input id="ymDiaryTags" maxlength="220" value="'+esc(d.tags||'')+'" placeholder="شغل، عيلة، راحة، إنجاز"></label>'+
 '<label class="ym-diary-check"><input id="ymDiaryFavorite" type="checkbox" '+(d.favorite?'checked':'')+'> ★ ذكرى مميزة</label></div>'+
 '<div class="ym-diary-editor-footer"><small id="ymDiaryDraftState" aria-live="polite">'+esc(draftStatus)+'</small>'+
 '<div><button type="button" class="ym-diary-discard" data-diary-discard>مسح المسودة</button>'+
 (d.editingId?'<button type="button" class="ym-diary-danger" data-diary-delete="'+esc(d.editingId)+'">حذف التدوينة</button>':'')+
 '<button type="submit" class="btn">💜 حفظ التدوينة</button></div></div></form>';
}
function updateDraftFromForm(){
 const s=state(),d=s?.journalDraft;if(!d)return;
 d.date=$('ymDiaryDate')?.value||d.date;
 d.title=$('ymDiaryTitle')?.value.slice(0,130)||'';
 d.body=$('ymDiaryBody')?.value.slice(0,8000)||'';
 d.gratitude=$('ymDiaryGratitude')?.value.slice(0,1000)||'';
 d.tags=$('ymDiaryTags')?.value.slice(0,220)||'';
 d.favorite=Boolean($('ymDiaryFavorite')?.checked);d.updatedAt=new Date().toISOString();
 const words=$('ymDiaryWordCount');if(words)words.textContent=countWords(d.body)+' كلمة';
 draftStatus='جاري حفظ المسودة…';const hint=$('ymDiaryDraftState');if(hint)hint.textContent=draftStatus;
 clearTimeout(draftTimer);
 const draftId=d.draftId;
 draftTimer=setTimeout(()=>{if(state()?.journalDraft?.draftId!==draftId)return;
   draftStatus=save()?'المسودة محفوظة في يومي · قد تنتظر مزامنة السحابة':'تعذر الحفظ · راجع الاتصال';
   if($('ymDiaryDraftState'))$('ymDiaryDraftState').textContent=draftStatus;
 },650);
}
function closeEditor(){
 updateDraftFromForm();clearTimeout(draftTimer);
 if(state()?.journalDraft)save();
 const d=diaryDialog();if(d.open)d.close();render();
}
function removeDraft(){
 if(!confirm('مسح مسودة الكتابة غير المحفوظة؟ التدوينات المحفوظة هتفضل موجودة.'))return;
 clearTimeout(draftTimer);
 const s=state();s.journalDraft=null;save();
 const d=diaryDialog();if(d.open)d.close();render();
}
function commit(){
 const s=state(),d=s?.journalDraft;
 if(!d||!canWrite())return;
 updateDraftFromForm();clearTimeout(draftTimer);
 if(!validDate(d.date))return api().notify?.('اختار تاريخًا سليمًا.');
 const title=String(d.title||'').trim().slice(0,130),
 body=String(d.body||'').trim().slice(0,8000),gr=String(d.gratitude||'').trim().slice(0,1000);
 if(!body&&!gr)return api().notify?.('اكتب سطرًا واحدًا على الأقل من يومك أو الامتنان.');
 const existing=s.journalEntries.find(x=>x.id===d.editingId);
 const entry={...(existing||{}),id:existing?.id||d.draftId,date:d.date,
  title:title||'مذكرات '+timeFmt(d.date),body,gratitude:gr,
  mood:Math.max(1,Math.min(5,Number(d.mood)||3)),tags:normalizeTags(d.tags),favorite:!!d.favorite,
  createdAt:existing?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
 if(existing)Object.assign(existing,entry);else s.journalEntries.push(entry);
 s.journalDraft=null;
 if(!save())return api().notify?.('تعذر حفظ التدوينة؛ راجع الاتصال.');
 diaryDialog().close();dateFilter='';currentMonth=d.date.slice(0,7);render();api().notify?.('تدوينتك اتحفظت 💜');
}
function deleteEntry(id){
 const s=state(),entry=s.journalEntries.find(e=>e.id===id);
 if(!entry||!confirm('هل تريد حذف تدوينة «'+entry.title+'»؟ الحذف نهائي بعد المزامنة، ويمكن استعادة نسخك الاحتياطية من الحساب.'))return;
 s.journalEntries=s.journalEntries.filter(e=>e.id!==id);s.journalDraft=null;
 if(!save())return api().notify?.('تعذر الحذف');
 diaryDialog().close();render();
}
function pickMood(v){
 const s=state();if(!s?.journalDraft)return;
 s.journalDraft.mood=Number(v);updateDraftFromForm();
 diaryDialog().querySelectorAll('[data-diary-mood]').forEach(b=>{
  const selected=b.dataset.diaryMood===v;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',selected?'true':'false')});
}
let promptIndex=0;
function insertPrompt(){
 const d=state()?.journalDraft;if(!d)return;
 const text=prompts[promptIndex%prompts.length][2],body=$('ymDiaryBody');
 body.value=(body.value?body.value.trim()+'\n\n':'')+text+'\n';
 updateDraftFromForm();body.focus();
}
function exportJournal(){
 const data=entries().sort((a,b)=>a.date.localeCompare(b.date)),out={
  exportedAt:new Date().toISOString(),format:'YAWMI_JOURNAL_PRIVATE_V32',journalEntries:data
 };
 const blob=new Blob([JSON.stringify(out,null,2)],{type:'application/json;charset=utf-8'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='YAWMI_PRIVATE_DIARY_'+today()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1800);
 api()?.notify?.('تم تجهيز نسخة اليوميات بصيغة JSON. احتفظ بها في مكان آمن.');
}
function clickMonth(offset){
 const [y,m]=currentMonth.split('-').map(Number),d=new Date(y,m-1+offset,1,12);
 currentMonth=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');dateFilter='';
 render();
}
function bind(){
 if(!$('ymDiaryApp'))return;
 document.addEventListener('click',e=>{
  const b=e.target.closest?.('button');if(!b)return;
  if(b.hasAttribute('data-diary-new'))return openEditor();
  if(b.hasAttribute('data-diary-resume'))return openEditor();
  if(b.hasAttribute('data-diary-open'))return openEditor(b.dataset.diaryOpen);
  if(b.hasAttribute('data-diary-fav')){
   const entry=entries().find(x=>x.id===b.dataset.diaryFav);if(!entry)return;
   entry.favorite=!entry.favorite;if(save())render();return;
  }
  if(b.hasAttribute('data-diary-favorites')){onlyFavorites=!onlyFavorites;render();return}
  if(b.hasAttribute('data-diary-month'))return clickMonth(Number(b.dataset.diaryMonth));
  if(b.hasAttribute('data-diary-date')){dateFilter=b.dataset.diaryDate;refreshList();render();return}
  if(b.hasAttribute('data-diary-clear-date')){dateFilter='';render();return}
  if(b.hasAttribute('data-diary-prompt-next')){promptIndex=(promptIndex+1)%prompts.length;const el=$('ymDiaryPromptText');if(el)el.textContent=prompts[promptIndex][2];return}
  if(b.hasAttribute('data-diary-prompt')){promptIndex=Number(b.dataset.diaryPrompt)||0;return openEditor(null,prompts[promptIndex][2])}
  if(b.hasAttribute('data-diary-insert-prompt'))return insertPrompt();
  if(b.hasAttribute('data-diary-close'))return closeEditor();
  if(b.hasAttribute('data-diary-discard'))return removeDraft();
  if(b.hasAttribute('data-diary-mood'))return pickMood(b.dataset.diaryMood);
  if(b.hasAttribute('data-diary-delete'))return deleteEntry(b.dataset.diaryDelete);
  if(b.hasAttribute('data-diary-export'))return exportJournal();
 });
 document.addEventListener('submit',e=>{if(e.target?.id==='ymDiaryForm'){e.preventDefault();commit()}});
 document.addEventListener('input',e=>{
  if(e.target?.id==='ymDiarySearch'){search=e.target.value;refreshList();return}
  if(['ymDiaryTitle','ymDiaryDate','ymDiaryBody','ymDiaryGratitude','ymDiaryTags'].includes(e.target?.id))updateDraftFromForm();
 });
 document.addEventListener('change',e=>{
  if(e.target?.id==='ymDiaryMoodFilter'){moodFilter=e.target.value;refreshList()}
  if(e.target?.id==='ymDiaryFavorite')updateDraftFromForm();
 });
 window.addEventListener('pagehide',()=>{if(state()?.journalDraft){clearTimeout(draftTimer);save()}});
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&state()?.journalDraft){clearTimeout(draftTimer);save()}});
}
window.YawmiDiary={render,summarize,normalizeTags,countWords,entries,openEditor};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
})();