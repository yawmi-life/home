/* YAWMI v19: synced book habits, projects/goals, skill editing, safe history actions */
(()=>{'use strict';
const $=id=>document.getElementById(id),api=()=>window.YawmiExtraAPI;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const N=x=>Math.max(0,Math.floor(Number(x)||0));
const today=()=>api().today(),uid=()=>api().uid(),state=()=>api().getState();
const books=()=>Array.isArray(state().books)?state().books:(state().books=[]);
const goals=()=>Array.isArray(state().goals)?state().goals:(state().goals=[]);
let editingGoal=null,selectedHistory=new Set();
function rec(date=today()){const s=state();return s.daily[date]||(s.daily[date]={habits:{},tasks:{},water:0,mood:0,note:''})}
function habitReader(h,day){
const q=N(recExisting(day).habits?.reading),goal=Math.max(1,N(h.target));const options=books().filter(b=>b.status==='reading'||b.status==='unread'&&N(b.currentPage)<N(b.totalPages));
const sel=state().readingBookId;
let id=options.find(x=>x.id===sel)?.id||options.find(x=>x.status==='reading')?.id||options[0]?.id;
const choices=options.map(b=>'<option value="'+esc(b.id)+'" '+(b.id===id?'selected':'')+'>'+esc(b.title)+' · '+N(b.currentPage)+'/'+N(b.totalPages)+'</option>').join('');
return '<div class="habit-line ym-reading-habit '+(q>=goal?'met':'')+'"><span class="icon-tile">📘</span><div class="habit-copy"><b>'+esc(h.title)+'</b><small>اليوم: '+q+' / '+goal+' صفحة</small><div class="ym-habit-inline">'+(choices?'<select aria-label="الكتاب" class="ym-reading-book">'+choices+'</select><input type="number" aria-label="الصفحات المقروءة" class="ym-reading-pages" min="1" max="1000" value="5"><button class="btn soft" type="button" data-ym-read-book>تسجيل</button>':'<button class="btn soft" type="button" data-ym-open-books>＋ أضف كتابًا لمكتبتك</button>')+'</div></div></div>';
}
function recExisting(day){return state().daily?.[day]||{habits:{}}}
function habitQuran(h,day){
const q=N(recExisting(day).habits?.quran),goal=Math.max(1,N(h.target));
return '<div class="habit-line ym-reading-habit '+(q>=goal?'met':'')+'"><span class="icon-tile">📿</span><div class="habit-copy"><b>'+esc(h.title)+'</b><small>اليوم: '+q+' / '+goal+' صفحة</small><div class="ym-habit-inline"><input type="number" class="ym-quran-pages" aria-label="صفحات القرآن المقروءة" min="1" max="604" value="5"><button type="button" class="btn soft" data-ym-read-quran>تسجيل الورد</button><button type="button" class="btn outline" data-ym-open-quran>التفاصيل</button></div></div></div>';
}
function recordBook(id,pages){
const b=books().find(x=>x.id===id),n=N(pages);
if(!b){api().notify('اختر الكتاب الأول');return false}
if(!n||n>1000){api().notify('أدخل عدد الصفحات المقروءة');return false}
const total=N(b.totalPages),old=N(b.currentPage);
if(!total||old>=total){api().notify('الكتاب مكتمل بالفعل');return false}
const actual=Math.min(n,total-old),end=old+actual;const reading={id:uid(),bookId:b.id,from:old,to:end,pages:actual,date:today()};(state().bookReadings||(state().bookReadings=[])).push(reading);
b.currentPage=end;b.highestPage=Math.max(N(b.highestPage),end);
b.status=end>=total?'done':'reading';b.updatedAt=new Date().toISOString();
if(end>=total&&!b.completedAt)b.completedAt=today();
const r=rec();r.habits=r.habits||{};r.habits.reading=N(r.habits.reading)+actual;
api().activity('book','قرأت '+actual+' صفحة من '+b.title,today());
state().readingBookId=b.id;
api().save();api().render();
api().notify(end>=total?'مبروك خلصت الكتاب! 🏆':'تم تسجيل القراءة ✓');
return true;
}
function undoBook(id){const entries=Array.isArray(state().bookReadings)?state().bookReadings:[],last=entries[entries.length-1],book=books().find(b=>b.id===id);if(!book||!last||last.bookId!==id||N(book.currentPage)!==N(last.to)){api().notify('التراجع متاح لآخر قراءة مسجلة فقط');return}if(!confirm('التراجع عن آخر قراءة '+last.pages+' صفحة من «'+book.title+'»؟ سيتم تصحيح التقدم ونقاط القراءة المرتبطة بها.'))return;const d=state().daily[last.date];if(d?.habits)d.habits.reading=Math.max(0,N(d.habits.reading)-N(last.pages));book.currentPage=N(last.from);book.highestPage=N(last.from);book.status=N(last.from)===0?'unread':'reading';delete book.completedAt;book.updatedAt=new Date().toISOString();entries.pop();api().activity('book','تراجعت عن قراءة '+last.pages+' صفحة من '+book.title,today());api().save();api().render();window.YawmiExtras?.renderBooks();api().notify('تم تصحيح القراءة ✓')}
function addQuran(pages){
const n=N(pages);if(!n||n>604){api().notify('أدخل عدد صفحات صحيحًا');return}
if(window.YawmiQuran?.addPages){window.YawmiQuran.addPages(n);return}
api().goQuran();api().notify('افتح صفحة القرآن لتسجيل الورد');
}
function historyControls(){
if(!$('ymActionControls'))return;
const data=Array.isArray(state().history)?state().history:[];
selectedHistory=new Set([...selectedHistory].filter(x=>data.some(h=>h.id===x)));
$('ymActionCount').textContent=data.length+' إجراء مسجل';
$('ymActionControls').querySelector('[data-ym-remove-selected]').disabled=!selectedHistory.size;
}
function logMarkup(h){
return '<div class="history-line ym-history-row"><label class="ym-log-check"><input type="checkbox" data-ym-history="'+esc(h.id)+'" '+(selectedHistory.has(h.id)?'checked':'')+' aria-label="تحديد هذا الإجراء"></label><div class="history-icon">'+(h.kind==='task'?'✓':h.kind==='habit'?'◉':h.kind==='book'?'📘':h.kind==='quran'?'📿':'✎')+'</div><div class="history-copy"><b>'+esc(h.label)+'</b><small>'+esc(h.date||'')+' · '+(h.at?new Date(h.at).toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'}):'')+'</small></div><button class="ym-trash" type="button" data-ym-remove-log="'+esc(h.id)+'" aria-label="حذف الإجراء من السجل">🗑</button></div>';
}
function renderHistory(){
const list=$('activityLog');if(!list)return;
const history=state().history||[];
list.innerHTML=history.length?history.slice(0,100).map(logMarkup).join(''):'<div class="empty">سجل الإجراءات فارغ.</div>';
historyControls();
}
function deleteLog(ids,all=false){
const h=state().history||[];
const count=all?h.length:ids.length;
if(!count)return;
if(!confirm('هل تريد حذف '+count+' إجراء من السجل؟ حذف السجل لا يلغي المهام أو الصفحات المسجلة.'))return;
const idsSet=new Set(ids);state().history=all?[]:h.filter(x=>!idsSet.has(x.id));selectedHistory.clear();api().save();api().render();api().notify('تم حذف السجلات المحددة');
}
const STATUS={course:'📘 كورس',project:'🛠 مشروع',field:'🎓 مهارة أو مجال',custom:'🎯 هدف شخصي'};
const UNIT=['درس','مرحلة','ساعة','جلسة','مهمة','وحدة'];
function renderGoals(){
if(!$('ymGoalList'))return;
$('ymGoalCount').textContent=goals().length+' هدف';
$('ymGoalList').innerHTML=goals().length?goals().map(g=>{
const p=Math.min(N(g.target),N(g.progress)),t=Math.max(1,N(g.target)),pct=Math.round(p/t*100);
return '<article class="ym-goal-card"><div class="ym-goal-header"><div><small>'+esc(STATUS[g.kind]||STATUS.custom)+'</small><h3>'+esc(g.title)+'</h3></div><button class="btn outline" data-ym-edit-goal="'+esc(g.id)+'">تعديل</button></div><div class="ym-goal-progress"><b>'+pct+'%</b><small>'+p+' / '+t+' '+esc(g.unit)+'</small></div><div class="progress"><i style="width:'+pct+'%"></i></div><div class="ym-goal-actions">'+(p<t?'<input type="number" min="1" max="1000" value="1" class="ym-goal-amount" aria-label="الكمية المنجزة"><button class="btn" data-ym-add-goal="'+esc(g.id)+'">سجل تقدّمك</button>':'<span class="ym-complete">✓ هدف مكتمل</span>')+'</div></article>'
}).join(''):'<div class="ym-empty">ابدأ بكورس أو مشروع أو مهارة تريد متابعتها.</div>';
}
function goalForm(id){
editingGoal=id||null;const g=goals().find(x=>x.id===id);
$('ymGoalDialogTitle').textContent=g?'تعديل الهدف':'هدف جديد';
$('ymGoalForm').reset();
$('ymGoalTitle').value=g?.title||'';
$('ymGoalType').value=g?.kind||'course';
$('ymGoalUnit').value=g?.unit||'درس';
$('ymGoalTarget').value=g?.target||10;
$('ymGoalProgress').value=g?.progress||0;
$('ymGoalDelete').hidden=!g;
$('ymGoalDialog').showModal();
}
function goalAdd(id,amount){
const g=goals().find(x=>x.id===id),n=N(amount);
if(!g||!n)return;
const before=N(g.progress),p=Math.min(N(g.target),before+n);
if(p===before)return;
g.progress=p;
if(p===N(g.target)&&!g.completedAt)g.completedAt=today();
const d=rec(),goalTarget=Math.max(1,N(g.target)),beforePoints=Math.round(110*Math.pow(before/goalTarget,2.32)),afterPoints=Math.round(110*Math.pow(p/goalTarget,2.32));d.goalXp=Math.max(0,N(d.goalXp)+Math.max(0,afterPoints-beforePoints));
api().activity('goal','تقدمت '+(p-before)+' '+g.unit+' في '+g.title,today());
api().save();api().render();renderGoals();
api().notify(p===N(g.target)?'مبروك تحقيق هدفك! 🏆':'إنجاز جديد ✓');
}
function saveGoal(e){
e.preventDefault();const title=$('ymGoalTitle').value.trim().slice(0,140),target=N($('ymGoalTarget').value),progress=N($('ymGoalProgress').value);
if(!title||target<1||target>100000||progress>target){api().notify('راجع اسم الهدف والقيم');return}
let g=goals().find(x=>x.id===editingGoal),prevComplete=Boolean(g?.completedAt),previousProgress=g?N(g.progress):0;
const data={title,kind:$('ymGoalType').value,unit:$('ymGoalUnit').value,target,progress};
if(!g){g={id:uid(),...data};goals().push(g)}else Object.assign(g,data);
if(progress>=target&&!prevComplete)g.completedAt=today();
if(progress<target)delete g.completedAt;
if(g&&previousProgress<progress){const oldPoints=Math.round(110*Math.pow(Math.min(1,previousProgress/target),2.32)),newPoints=Math.round(110*Math.pow(Math.min(1,progress/target),2.32));const d=rec();d.goalXp=Math.max(0,N(d.goalXp)+Math.max(0,newPoints-oldPoints))}
if(g.completedAt)rec();
api().activity('goal','حفظت الهدف: '+title,today());
$('ymGoalDialog').close();api().save();api().render();renderGoals();
}
function renderSkills(){
const box=$('ymSkillManage');if(!box)return;
const s=state(),custom=Array.isArray(s.skillCustom)?s.skillCustom:[],hidden=Array.isArray(s.hiddenSkills)?s.hiddenSkills:[];
box.innerHTML='<div class="ym-goal-header"><h3>إدارة القدرات</h3><button type="button" class="btn soft" data-ym-add-skill>＋ قدرة</button></div><div class="ym-skill-list">'+api().getSkills().map(x=>'<div><b>'+esc(x.icon)+' '+esc(x.name)+'</b>'+ (x.id==='discipline'?'':'<button class="ym-trash" data-ym-remove-skill="'+esc(x.id)+'" title="إزالة القدرة">🗑</button>')+'</div>').join('')+(hidden.length?'<button class="btn soft" data-ym-restore-skills>إظهار القدرات المخفية</button>':'')+'</div>';
}
function skillAdd(){
const n=prompt('اسم القدرة الجديدة (مثل: البرمجة أو اللغات)');if(n===null)return;
const name=n.trim().slice(0,35);if(!name){api().notify('اسم القدرة مطلوب');return}
if((state().skillCustom||[]).length>=15){api().notify('أقصى عدد للقدرات الإضافية 15');return}
if(api().getSkills().some(x=>x.name===name)){api().notify('القدرة موجودة بالفعل');return}
const icon=prompt('رمز مناسب للقدرة','🎯')||'🎯';
(state().skillCustom||(state().skillCustom=[])).push({id:'skill_'+uid(),name,icon:icon.slice(0,4),desc:''});
api().rebuildSkills();api().activity('skill','أضفت قدرة: '+name,today());api().render();renderSkills();
}
function skillRemove(id){
const s=state(),skill=api().getSkills().find(x=>x.id===id);if(!skill||id==='discipline')return;
if(!confirm('إزالة «'+skill.name+'» من قدراتك؟ سيُنقل أي تصنيف مرتبط بها إلى «الانضباط» حفاظًا على مهامك وعاداتك.'))return;
(s.tasks||[]).forEach(t=>{if(t.category===id)t.category='discipline'});
(s.habits||[]).forEach(h=>{if(h.skill===id)h.skill='discipline'});
if((s.skillCustom||[]).some(x=>x.id===id))s.skillCustom=s.skillCustom.filter(x=>x.id!==id);
else{if(!Array.isArray(s.hiddenSkills))s.hiddenSkills=[];if(!s.hiddenSkills.includes(id))s.hiddenSkills.push(id)}
api().rebuildSkills();api().activity('skill','أزلت قدرة: '+skill.name,today());api().render();renderSkills();
}
function wire(){
if(!$('ymGoalList'))return;
$('ymGoalAdd').addEventListener('click',()=>goalForm(null));$('ymGoalCancel').addEventListener('click',()=>$('ymGoalDialog').close());$('ymGoalForm').addEventListener('submit',saveGoal);
$('ymGoalDelete').addEventListener('click',()=>{const g=goals().find(x=>x.id===editingGoal);if(!g||!confirm('حذف هدف «'+g.title+'»؟'))return;state().goals=goals().filter(x=>x.id!==g.id);$('ymGoalDialog').close();api().activity('goal','حذفت هدف: '+g.title,today());api().render();renderGoals()});
document.addEventListener('change',e=>{if(e.target.matches('.ym-reading-book')){state().readingBookId=e.target.value;api().save()}if(e.target.matches('[data-ym-history]')){if(e.target.checked)selectedHistory.add(e.target.dataset.ymHistory);else selectedHistory.delete(e.target.dataset.ymHistory);historyControls()}});
document.addEventListener('click',e=>{
const b=e.target.closest('button');if(!b)return;
if(b.matches('[data-ym-open-books]'))api().goBooks();
if(b.matches('[data-ym-open-quran]'))api().goQuran();
if(b.matches('[data-ym-read-book]')){const row=b.closest('.ym-reading-habit');if(row)recordBook(row.querySelector('.ym-reading-book')?.value,Number(row.querySelector('.ym-reading-pages')?.value))}
if(b.matches('[data-ym-read-quran]')){const row=b.closest('.ym-reading-habit');if(row)addQuran(Number(row.querySelector('.ym-quran-pages')?.value))}
if(b.matches('[data-ym-remove-log]'))deleteLog([b.dataset.ymRemoveLog]);
if(b.matches('[data-ym-remove-selected]'))deleteLog([...selectedHistory]);
if(b.matches('[data-ym-remove-all]'))deleteLog([],true);
if(b.matches('[data-ym-select-history]')){const n=state().history?.slice(0,100)||[];const all=n.every(x=>selectedHistory.has(x.id));n.forEach(x=>all?selectedHistory.delete(x.id):selectedHistory.add(x.id));renderHistory()}
if(b.matches('[data-ym-edit-goal]'))goalForm(b.dataset.ymEditGoal);
if(b.matches('[data-ym-add-goal]')){const row=b.closest('.ym-goal-card');goalAdd(b.dataset.ymAddGoal,Number(row?.querySelector('.ym-goal-amount')?.value))}
if(b.matches('[data-ym-add-skill]'))skillAdd();
if(b.matches('[data-ym-remove-skill]'))skillRemove(b.dataset.ymRemoveSkill);
if(b.matches('[data-ym-restore-skills]')){state().hiddenSkills=[];api().rebuildSkills();api().render();renderSkills();}
});
renderGoals();renderSkills();
}
window.YawmiProgress={habitReader,habitQuran,recordBook,undoBook,renderGoals,renderSkills,renderHistory,goalXP:(date)=>goals().filter(g=>g.completedAt===date).length*360,
bookBonus:(date)=>books().filter(b=>b.completedAt===date).length*420};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();
})();