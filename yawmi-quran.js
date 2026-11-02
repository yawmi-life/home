/* YAWMI Quran tracker v15 — 604 page mushaf, 114 surahs, reflections. */
(()=>{'use strict';
const $=id=>document.getElementById(id),esc=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'" :'&#39;'}[c]));
const app=()=>window.YawmiExtraAPI;const API='https://api.alquran.cloud/v1';
let surahs=[],selectedSurah=1,verses=[],lastLoaded=0,busy=false,search='';
function state(){let s=app()?.getState();if(!s)return null;if(!s.quran||typeof s.quran!=='object')s.quran={page:0,khatmas:[],readings:[],reflections:[]};for(let key of ['khatmas','readings','reflections'])if(!Array.isArray(s.quran[key]))s.quran[key]=[];s.quran.page=Math.max(0,Math.min(604,Number(s.quran.page)||0));return s.quran}
function date(){return app().today()}
function pagesReadToday(){return state().readings.filter(r=>r.date===date()).reduce((a,r)=>a+(+r.pages||0),0)}
function readableDate(iso){try{return new Intl.DateTimeFormat('ar-EG',{day:'numeric',month:'long',year:'numeric'}).format(new Date(iso+'T12:00:00'))}catch{return iso}}
function render(){
const q=state();if(!q||!$('yawmiQuranStats'))return;
const count=q.khatmas.length,byYear={};q.khatmas.forEach(k=>{const y=String(k.date||'').slice(0,4);byYear[y]=(byYear[y]||0)+1});
let years=[...new Set([String(new Date().getFullYear()),...Object.keys(byYear)])].sort((a,b)=>b.localeCompare(a));
const current=String(new Date().getFullYear()),annual=byYear[current]||0;
const panel=$('yawmiQuranStats');
panel.innerHTML='<div class="yq-stat"><small>المصحف الحالي</small><strong>صفحة '+q.page+' / 604</strong><div class="progress"><i style="width:'+(q.page/604*100)+'%"></i></div></div>'
+'<div class="yq-stat"><small>الختمات المسجلة</small><strong>'+count+'</strong><span>ختمة '+annual+' خلال '+current+'</span></div>'
+'<div class="yq-stat"><small>صفحات اليوم</small><strong>'+pagesReadToday()+'</strong><span>معدل '+(q.readings.length?(q.readings.reduce((a,r)=>a+(+r.pages||0),0)/Math.max(1,new Set(q.readings.map(r=>r.date)).size)).toFixed(1):'0')+' صفحة في يوم قراءة</span></div>';
$('yqCurrentPage').value=q.page;
const chosen=$('yqAnnualYear');const before=chosen.value;chosen.innerHTML=years.map(y=>'<option value="'+y+'">'+y+'</option>').join('');chosen.value=years.includes(before)?before:current;
const yearly=chosen.value;
$('yqYearTotal').textContent=(byYear[yearly]||0)+' ختمة في '+yearly;
$('yqKhatmaList').innerHTML=q.khatmas.filter(k=>String(k.date).startsWith(yearly)).slice().reverse().map((k,i)=>'<div class="yq-log">🏅 ختمة · '+readableDate(k.date)+' <span>رقم '+(q.khatmas.indexOf(k)+1)+'</span><button type="button" class="ym-trash" data-yq-delete-khatma="'+esc(k.id)+'" aria-label="حذف هذه الختمة">🗑</button></div>').join('')||'<p class="muted">لا توجد ختمات مسجلة لهذه السنة.</p>';
$('yqReadingHistory').innerHTML=q.readings.slice(-14).reverse().map(r=>'<div class="yq-log">📖 '+readableDate(r.date)+' <span>+'+r.pages+' صفحات'+(r.endPage?' · وصول إلى '+r.endPage:'')+'</span>'+(q.readings[q.readings.length-1]===r?'<button type="button" class="ym-trash" data-yq-delete-reading="'+esc(r.id)+'" aria-label="التراجع عن آخر قراءة">🗑</button>':'')+'</div>').join('')||'<p class="muted">ابدأ بتسجيل أول قراءة.</p>';
$('yqReflections').innerHTML=q.reflections.slice().reverse().map(r=>'<article class="yq-reflection"><div><b>'+esc(r.surahName)+' · '+(r.selection==='all'?'السورة كاملة':r.from===r.to?'آية '+r.from:'من آية '+r.from+' إلى '+r.to)+'</b><small>'+readableDate(r.date)+'</small></div><p>'+esc(r.note)+'</p><button class="btn soft" type="button" data-yq-remove="'+esc(r.id)+'">حذف الملاحظة</button></article>').join('')||'<p class="muted">اكتب أول معنى تدبرته واحتفظ به في حسابك.</p>';
}
async function getChapters(){
if(surahs.length)return surahs;
let found=null;try{found=JSON.parse(sessionStorage.getItem('yawmi_quran_chapters_v1'))}catch(_){}
if(Array.isArray(found)&&found.length===114){surahs=found;return surahs}
const res=await fetch(API+'/surah',{cache:'force-cache'});if(!res.ok)throw Error('تعذر تحميل قائمة السور');
const obj=await res.json();if(obj.code!==200||obj.data?.length!==114)throw Error('رد غير مكتمل لقائمة السور');
surahs=obj.data.map(s=>({number:s.number,name:s.name,ayats:s.numberOfAyahs,english:s.englishName}));
try{sessionStorage.setItem('yawmi_quran_chapters_v1',JSON.stringify(surahs))}catch(_){}
return surahs;
}
function norm(s){return String(s||'').normalize('NFKD').replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g,'').replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').toLowerCase()}
function renderChapters(){
const list=$('yqSurahResults');if(!list)return;
const q=norm($('yqSurahSearch').value);const filtered=surahs.filter(s=>!q||norm(s.name).includes(q)||String(s.number)===q||norm(s.english).includes(q));
list.innerHTML=filtered.slice(0,114).map(s=>'<button type="button" data-yq-chapter="'+s.number+'" class="'+(s.number===selectedSurah?'selected':'')+'">'+s.number+' · '+esc(s.name)+' <small>'+s.ayats+' آية</small></button>').join('')||'<p>لم نعثر على سورة بهذا الاسم.</p>';
}
async function loadVerses(id){
if(!surahs.length)return;
selectedSurah=Number(id);if(lastLoaded===id&&verses.length){renderVerses();renderChapters();return;}
const status=$('yqVerseStatus');status.textContent='جاري تحميل آيات السورة...';
try{
let result=null;try{result=JSON.parse(sessionStorage.getItem('yawmi_quran_surah_'+id))}catch(_){}
if(!Array.isArray(result)){
 const res=await fetch(API+'/surah/'+id,{cache:'force-cache'});if(!res.ok)throw Error('تعذر الاتصال بمصدر النص');
 const obj=await res.json();if(obj.code!==200||obj.data?.ayahs?.length!==surahs[id-1]?.ayats)throw Error('لم يكتمل النص القرآني');
 result=obj.data.ayahs.map(a=>({number:a.numberInSurah,text:a.text,page:a.page}));
 try{sessionStorage.setItem('yawmi_quran_surah_'+id,JSON.stringify(result))}catch(_){}
}
verses=result;lastLoaded=id;renderVerses();renderChapters();status.textContent='عدد الآيات: '+verses.length+' · المصدر: Al Quran Cloud';
}catch(err){verses=[];lastLoaded=0;status.textContent='تعذر تحميل الآيات. تأكد من الإنترنت ثم أعد اختيار السورة. '+err.message;$('yqVerseList').textContent='';}
}
function renderVerses(){
const type=$('yqSelectionType').value;const from=$('yqFrom'),to=$('yqTo');let f=Number(from.value)||1,t=Number(to.value)||1;
const max=verses.length;from.innerHTML=verses.map(a=>'<option value="'+a.number+'">'+a.number+'</option>').join('');
to.innerHTML=from.innerHTML;from.value=Math.min(f,max)||1;to.value=Math.min(t,max)||1;
const all=type==='all',single=type==='single';
from.closest('label').hidden=all;to.closest('label').hidden=all||single;
$('yqSelectionType').disabled=!max;
updatePreview();
}
function updatePreview(){
const type=$('yqSelectionType').value;let from=Number($('yqFrom').value)||1,to=Number($('yqTo').value)||1;
if(to<from)to=from;
const shown=type==='all'?verses:type==='single'?verses.filter(v=>v.number===from):verses.filter(v=>v.number>=from&&v.number<=to);
$('yqVerseList').innerHTML=shown.map(v=>'<div class="yq-verse"><span class="yq-verse-no">﴿'+v.number+'﴾</span> '+esc(v.text)+'</div>').join('');
}
function addPages(value){
const q=state(),n=Number(value);if(!Number.isInteger(n)||n<1||n>604){app().notify('أدخل عدد صفحات من 1 إلى 604');return false}
let left=n,at=q.page,finished=0;const readId=app().uid(),startPage=at;
while(left>0){
 const before=at===604?0:at,take=Math.min(left,604-before);
 at=before+take;left-=take;
 if(at===604){q.khatmas.push({date:date(),at:new Date().toISOString(),id:app().uid(),readId});finished++}
}
q.page=at;
q.readings.push({date:date(),at:new Date().toISOString(),pages:n,startPage,endPage:at,id:readId});
const a=app().getState(),d=a.daily[date()]||(a.daily[date()]={habits:{},tasks:{},water:0,mood:0,note:''});
d.habits=d.habits||{};d.habits.quran=Math.max(0,Number(d.habits.quran)||0)+n;
app().activity('quran','قرأت '+n+' صفحة '+(finished?'وأتممت '+finished+' ختمة':'')+' من القرآن',date());
$('yqPagesAdd').value='';app().save();app().render();app().notify(finished?'مبارك إتمام الختمة! 🌿':'تم تسجيل الورد ✓');
return true;
}
function recordPages(){addPages(Number($('yqPagesAdd').value))}
function deleteKhatma(id){
const q=state(),k=q.khatmas.find(x=>x.id===id);if(!k)return;
if(!confirm('حذف الختمة بتاريخ '+readableDate(k.date)+'؟ سيتم إلغاء مكافأة الختمة من رصيد XP، بينما تظل الصفحات المقروءة مسجلة.'))return;
q.khatmas=q.khatmas.filter(x=>x.id!==id);
app().activity('quran','حذفت ختمة مسجلة بتاريخ '+k.date,date());
app().save();app().render();app().notify('تم حذف الختمة');
}
function undoLatestReading(id){
const q=state(),r=q.readings[q.readings.length-1];if(!r||r.id!==id)return;
if(!confirm('التراجع عن آخر قراءة ('+r.pages+' صفحة)؟ سيُخصم سجل الصفحات ومكافآت الختمات الناتجة عن هذه القراءة.'))return;
q.readings.pop();const all=q.khatmas.length;
q.khatmas=q.khatmas.filter(x=>x.readId!==r.id);
if(Number.isInteger(+r.startPage))q.page=Math.max(0,Math.min(604,+r.startPage));
const d=app().getState().daily[r.date];if(d?.habits)d.habits.quran=Math.max(0,(Number(d.habits.quran)||0)-(Number(r.pages)||0));
app().activity('quran','تراجعت عن آخر قراءة: '+r.pages+' صفحة',date());
app().save();app().render();app().notify('تم التراجع عن القراءة');
}
function setPage(){
const val=Number($('yqCurrentPage').value);if(!Number.isInteger(val)||val<0||val>604){app().notify('رقم الصفحة لازم يكون من 0 إلى 604');return}
const q=state();q.page=val;app().activity('quran','تصحيح موضع المصحف إلى صفحة '+val,date());app().save();app().render();app().notify('تم تحديث موضع القراءة بدون إضافة صفحات أو XP');
}
function saveReflection(){
const txt=$('yqReflectionText').value.trim();if(!txt){app().notify('اكتب المعنى أو التدبر أولًا');return}
const chapter=surahs.find(s=>s.number===selectedSurah);if(!chapter||!verses.length){app().notify('اختر سورة وانتظر ظهور الآيات');return}
const sel=$('yqSelectionType').value,from=sel==='all'?1:Number($('yqFrom').value),to=sel==='all'?verses.length:sel==='single'?from:Number($('yqTo').value);
if(!from||!to||to<from){app().notify('اختيار الآية أو النطاق غير صحيح');return}
state().reflections.push({id:app().uid(),date:date(),surah:chapter.number,surahName:chapter.name,selection:sel,from,to,note:txt.slice(0,5000)});
$('yqReflectionText').value='';app().activity('quran','حفظت تدبرًا: '+chapter.name,date());app().save();render();app().notify('تم حفظ التدبر في حسابك ✓');
}
function wire(){
$('yqPagesSubmit').addEventListener('click',recordPages);
$('yqSetPage').addEventListener('click',setPage);
$('yqAnnualYear').addEventListener('change',render);
$('yqSurahSearch').addEventListener('input',renderChapters);
$('yqSurahResults').addEventListener('click',e=>{const b=e.target.closest('[data-yq-chapter]');if(b)loadVerses(Number(b.dataset.yqChapter))});
$('yqSelectionType').addEventListener('change',renderVerses);
$('yqFrom').addEventListener('change',updatePreview);$('yqTo').addEventListener('change',updatePreview);
$('yqReflectionSave').addEventListener('click',saveReflection);
$('yqReflections').addEventListener('click',e=>{const btn=e.target.closest('[data-yq-remove]');if(btn&&confirm('حذف التدبر؟')){const q=state();q.reflections=q.reflections.filter(x=>x.id!==btn.dataset.yqRemove);app().save();render()}});$('yqKhatmaList').addEventListener('click',e=>{const btn=e.target.closest('[data-yq-delete-khatma]');if(btn)deleteKhatma(btn.dataset.yqDeleteKhatma)});$('yqReadingHistory').addEventListener('click',e=>{const btn=e.target.closest('[data-yq-delete-reading]');if(btn)undoLatestReading(btn.dataset.yqDeleteReading)});
render();
getChapters().then(()=>{renderChapters();loadVerses(1)}).catch(err=>{$('yqVerseStatus').textContent='تحتاج اتصالًا بالإنترنت لعرض سور القرآن وآياتها: '+err.message});
}
window.YawmiQuran={render,addPages};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();
})();