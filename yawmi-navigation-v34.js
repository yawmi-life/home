/* YAWMI V34: owner-configurable navigation, persisted in the existing synced account document. */
(()=>{'use strict';
const $=id=>document.getElementById(id),api=()=>window.YawmiExtraAPI;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sections=[
 {id:'tasks',icon:'☷',title:'إدارة المهام',group:'الإنتاجية'},
 {id:'habits',icon:'◉',title:'تتبع العادات',group:'الإنتاجية'},
 {id:'journey',icon:'✧',title:'رحلتي والمكافآت',group:'الإنتاجية'},
 {id:'reports',icon:'▥',title:'التحليلات والسجل',group:'الإنتاجية'},
 {id:'calendar',icon:'🗓️',title:'التقويم الذكي',group:'التخطيط'},
 {id:'notes',icon:'✎',title:'الأفكار والملاحظات',group:'التخطيط'},
 {id:'routines',icon:'☀️',title:'روتيني اليومي',group:'التخطيط'},
 {id:'planning',icon:'◎',title:'رؤية السنة وخطة 90 يوم',group:'التخطيط'},
 {id:'goals',icon:'🎯',title:'أهدافي ومشاريعي',group:'التخطيط'},
 {id:'books',icon:'📚',title:'مكتبتي',group:'مساحتي الشخصية'},
 {id:'quran',icon:'📿',title:'القرآن والختمات',group:'مساحتي الشخصية'},
 {id:'money',icon:'💳',title:'ماليتي وميزانيتي',group:'مساحتي الشخصية'},
 {id:'diary',icon:'✍️',title:'يومياتي الخاصة',group:'مساحتي الشخصية'},
 {id:'health',icon:'❤️',title:'صحتي ولياقتي',group:'مساحتي الشخصية'},
 {id:'coach',icon:'✨',title:'المساعد الأسبوعي',group:'مساحتي الشخصية'},
 {id:'privacy',icon:'🔐',title:'الخصوصية والحماية',group:'مساحتي الشخصية'}
];
const known=new Set(sections.map(s=>s.id));
function state(){return api()?.getState?.()||null}
function hiddenList(){const v=state()?.hiddenSections;return Array.isArray(v)?[...new Set(v.filter(k=>typeof k==='string'&&known.has(k)))]:[]}
function apply(){
 const hidden=new Set(hiddenList());
 for(const el of document.querySelectorAll('.sidebar [data-tab],.bottom-nav [data-tab],#yawmiMenuDrawer [data-yam-action]')){
  const key=el.dataset.tab||el.dataset.yamAction;
  if(known.has(key))el.hidden=hidden.has(key);
 }
 for(const node of document.querySelectorAll('[data-ym-hidden-count]'))node.textContent=hidden.size||'0';
 return hidden.size;
}
function dialog(){
 let d=$('ymSectionsDialog');if(d)return d;
 d=document.createElement('dialog');d.id='ymSectionsDialog';d.className='ym-sections-dialog';
 d.setAttribute('aria-label','تخصيص الأقسام الظاهرة والمخفية');
 d.innerHTML='<div id="ymSectionsDialogContent"></div>';
 document.body.appendChild(d);
 return d;
}
function sectionTile(section,isHidden){
 return '<div class="ym-section-tile"><span class="ym-section-tile-icon" aria-hidden="true">'+section.icon+'</span>'+
 '<div><strong>'+esc(section.title)+'</strong><small>'+esc(section.group)+'</small></div>'+
 '<button type="button" class="'+(isHidden?'ym-section-restore':'ym-section-hide')+'" data-ym-section-toggle="'+esc(section.id)+'" aria-label="'+(isHidden?'إظهار':'إخفاء')+' قسم '+esc(section.title)+'">'+
 (isHidden?'↩ إظهار':'− إخفاء')+'</button></div>';
}
function draw(){
 const d=dialog(),hidden=new Set(hiddenList()),visible=sections.filter(s=>!hidden.has(s.id)),inactive=sections.filter(s=>hidden.has(s.id));
 $('ymSectionsDialogContent').innerHTML='<div class="ym-sections-header"><div><span>MY SPACE · مساحتي</span><h2>اختار الأقسام اللي تهمك</h2><p>خلّي القائمة بسيطة على مزاجك. القسم المخفي بيختفي من القائمة الجانبية وقائمة الموبايل، لكن بياناته محفوظة وتقدر ترجّعه في أي وقت.</p></div>'+
 '<button type="button" data-ym-sections-close aria-label="إغلاق">✕</button></div>'+
 '<div class="ym-sections-summary"><span><b>'+visible.length+'</b> قسم ظاهر</span><span><b>'+inactive.length+'</b> قسم مخفي</span><span>⌂ الرئيسية ثابتة علشان تعرف ترجع بسهولة</span></div>'+
 '<div class="ym-sections-scroll"><section class="ym-sections-block"><div><h3>الأقسام الظاهرة</h3><small>اضغط «إخفاء» لنقل القسم لقائمة المخفية</small></div>'+
 (visible.length?visible.map(s=>sectionTile(s,false)).join(''):'<p class="ym-sections-empty">كل الأقسام الإضافية مخفية. تقدر ترجع أي واحد من القسم اللي تحت.</p>')+'</section>'+
 '<section class="ym-sections-block ym-sections-hidden"><div><h3>الأقسام المخفية · '+inactive.length+'</h3><small>المحتوى والإنجازات مش هيتمسحوا</small></div>'+
 (inactive.length?inactive.map(s=>sectionTile(s,true)).join(''):'<p class="ym-sections-empty">مافيش أقسام مخفية لحد دلوقتي.</p>')+'</section></div>'+
 '<div class="ym-sections-footer"><button type="button" data-ym-sections-showall '+(!inactive.length?'disabled':'')+'>↻ إظهار كل الأقسام</button>'+
 '<button type="button" class="ym-sections-done" data-ym-sections-close>تم ✓</button></div>';
}
function open(){
 if(!state()||(window.YawmiCloud?.configured&&(!window.YawmiCloud.ready||!window.YawmiCloud.currentUser))){
  api()?.notify?.('سجّل الدخول أولًا علشان تقدر تحفظ تخصيص الأقسام.');return;
 }
 draw();const d=dialog();if(!d.open)d.showModal();
}
function update(next,changedId){
 const s=state();if(!s)return false;
 if(window.YawmiCloud?.configured&&(!window.YawmiCloud.ready||!window.YawmiCloud.currentUser)){
  api()?.notify?.('بيانات حسابك لسه بتتحمل.');return false;
 }
 const before=s.hiddenSections;
 s.hiddenSections=[...new Set(next.filter(id=>known.has(id)))];
 if(api().save()===false){
  s.hiddenSections=before;api()?.notify?.('تعذر حفظ تخصيص القائمة. راجع المزامنة.');return false;
 }
 apply();draw();
 const key=changedId;
 if(key&&s.hiddenSections.includes(key)&&$('page-'+key)?.classList.contains('on'))api().goHome?.();
 return true;
}
function toggle(id){if(!known.has(id))return;const current=new Set(hiddenList()),wasHidden=current.has(id);
 if(wasHidden)current.delete(id);else current.add(id);
 update([...current],id);
}
function init(){
 document.addEventListener('click',e=>{
  const b=e.target.closest?.('button');if(!b)return;
  if(b.hasAttribute('data-ym-sections')){e.preventDefault();open();return}
  if(b.hasAttribute('data-ym-sections-close')){if(dialog().open)dialog().close();return}
  if(b.hasAttribute('data-ym-sections-showall')){update([]);return}
  if(b.dataset.ymSectionToggle){toggle(b.dataset.ymSectionToggle)}
 });
 apply();
}
window.YawmiNavigation={sections,apply,open,toggle,hiddenList,showAll:()=>update([])};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();