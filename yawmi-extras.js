/* YAWMI v14: navigation drawer and personal book library. */
(()=>{'use strict';
const $=id=>document.getElementById(id), esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const api=()=>window.YawmiExtraAPI,state=()=>api()?.getState(),library=()=>{const s=state();if(!s)return [];if(!Array.isArray(s.books))s.books=[];return s.books};
let filter='all',editId=null;
const statusLabel={unread:'لم أقرأه بعد',reading:'أقرأه حاليًا',done:'تمت القراءة'};
function drawer(){
if($('yawmiMenuDrawer'))return;
const shade=document.createElement('div');shade.className='ym-menu-shade';shade.id='ymMenuShade';shade.hidden=true;
const side=document.createElement('aside');side.id='yawmiMenuDrawer';side.className='ym-menu-drawer';side.hidden=true;side.setAttribute('role','dialog');side.setAttribute('aria-modal','true');side.setAttribute('aria-label','قائمة التطبيق');
side.innerHTML='<header class="ym-menu-head"><div><b>يومي LifeOS</b><small>كل يوم تقدم جديد</small></div><button id="ymClose" aria-label="إغلاق">✕</button></header>'
+'<div class="ym-menu-body"><div class="ym-menu-identity" id="ymMenuIdentity"></div><button class="ym-menu-link" data-yam-action="account">👤 <span>الاسم والحساب</span></button><button class="ym-menu-link" data-yam-action="books">📚 <span>مكتبتي وكتبي</span></button><button class="ym-menu-link" data-yam-action="quran">📿 <span>القرآن والختمات والتدبر</span></button>'
+'<label class="ym-menu-label" for="ymSkin">تصميم التطبيق</label><select id="ymSkin"><option value="01_ATLAS_Executive.html">ATLAS · لوحة القيادة</option><option value="02_JOURNAL_Editorial.html">JOURNAL · المفكرة</option><option value="03_QUEST_RPG.html">QUEST · المستويات</option></select>'
+'<label class="ym-menu-label">الوضع</label><div class="ym-seg"><button data-yam-mode="light">☀ فاتح</button><button data-yam-mode="dark">☾ داكن</button><button data-yam-mode="auto">◐ تلقائي</button></div>'
+'<button class="ym-menu-link" data-yam-action="goals">🎯 <span>أهدافي وكورساتي ومشاريعي</span></button><button class="ym-menu-link" data-yam-action="install">📲 <span>تثبيت التطبيق</span></button><button class="ym-menu-link" data-yam-action="settings">⚙️ <span>الإعدادات</span></button><button class="ym-menu-link" data-yam-action="home">⌂ <span>الرئيسية</span></button>'
+'<p id="ymInstallHelp" class="ym-help" hidden>على أندرويد افتح Chrome ثم ⋮ ثم «إضافة إلى الشاشة الرئيسية» أو «تثبيت التطبيق».</p></div>';
document.body.append(shade,side);
const close=()=>{side.hidden=true;shade.hidden=true;document.body.classList.remove('ym-menu-open')};
const open=()=>{const name=String(api()?.getState()?.profile?.name||'المستخدم');$('ymMenuIdentity').textContent='👤 '+name+' · حسابك الشخصي';$('ymSkin').value=$('skinSwitch').value;document.querySelectorAll('[data-yam-mode]').forEach(b=>b.classList.toggle('is-selected',b.dataset.yamMode===api().getState().theme.mode));side.hidden=false;shade.hidden=false;document.body.classList.add('ym-menu-open');$('ymClose').focus()};
$('yawmiMenuBtn').addEventListener('click',open);$('ymClose').addEventListener('click',close);shade.addEventListener('click',close);document.addEventListener('keydown',ev=>{if(ev.key==='Escape'&&!side.hidden)close()});
$('ymSkin').addEventListener('change',ev=>{close();const s=$('skinSwitch');s.value=ev.target.value;s.dispatchEvent(new Event('change',{bubbles:true}))});
side.addEventListener('click',ev=>{const b=ev.target.closest('button');if(!b)return;if(b.dataset.yamMode){api().getState().theme.mode=b.dataset.yamMode;api().applyTheme();api().save();document.querySelectorAll('[data-yam-mode]').forEach(x=>x.classList.toggle('is-selected',x===b));return}
const action=b.dataset.yamAction;if(!action)return;if(action==='install'){if(window.YawmiInstall?.install)window.YawmiInstall.install('ymInstallHelp');else $('ymInstallHelp').hidden=!$('ymInstallHelp').hidden;return}close();if(action==='account')$('yawmiAccountBtn').click();if(action==='settings')api().openSettings();if(action==='books')api().goBooks();if(action==='quran')api().goQuran();if(action==='goals')api().goGoals();if(action==='home')api().goHome()});
}
function renderBooks(){
if(!api()||!$('ymBooksGrid'))return;
const books=library();$('ymBooksCount').textContent=books.length+' كتاب';
const filters=[['all','كل الكتب'],['reading','أقرأه حاليًا'],['unread','لم أقرأه بعد'],['done','تمت القراءة'],['favorite','المفضلة']];
$('ymBooksFilters').innerHTML=filters.map(([k,t])=>'<button type="button" data-book-filter="'+k+'" class="'+(filter===k?'chosen':'')+'">'+t+'</button>').join('');
const show=books.filter(b=>filter==='all'||filter==='favorite'&&b.favorite||b.status===filter);
$('ymBooksGrid').innerHTML=show.length?show.map(b=>{
const total=Math.max(1,Number(b.totalPages)||1),page=Math.max(0,Math.min(total,Number(b.currentPage)||0)),pct=Math.round(page/total*100),latest=Array.isArray(state().bookReadings)?state().bookReadings[state().bookReadings.length-1]:null,canUndo=latest?.bookId===b.id&&Number(latest.to)===page;
return '<article class="ym-book-card"><div class="ym-book-top"><div class="ym-book-cover">📖</div><div class="ym-book-text"><h3>'+esc(b.title)+'</h3><span>'+statusLabel[b.status]+'</span></div><button class="ym-favorite '+(b.favorite?'yes':'')+'" data-book-fav="'+esc(b.id)+'" aria-label="المفضلة">'+(b.favorite?'★':'☆')+'</button></div>'
+'<div class="ym-book-progress"><div class="ym-book-numbers"><b>'+pct+'% مكتمل</b><span>'+page+' / '+total+' صفحة</span></div><div class="progress"><i style="width:'+pct+'%"></i></div></div>'
+'<div class="ym-book-bottom"><div class="ym-book-stars">'+[1,2,3,4,5].map(n=>'<button data-book-rate="'+esc(b.id)+'" data-stars="'+n+'" class="'+(n<=b.rating?'lit':'')+'" aria-label="'+n+' نجوم">★</button>').join('')+'</div><button type="button" class="btn soft" data-book-edit="'+esc(b.id)+'">تعديل وتسجيل صفحات</button>'+(canUndo?'<button class="btn soft" type="button" data-ym-undo-book="'+esc(b.id)+'">↶ التراجع عن آخر قراءة</button>':'')+'</div>'
+(b.notes?'<p class="ym-book-notes">'+esc(b.notes)+'</p>':'')+'</article>';
}).join(''):'<div class="ym-empty">'+(books.length?'فيه '+books.length+' كتاب محفوظ، لكن مفيش نتائج في التصنيف ده. <button class="btn soft" type="button" data-ym-all-books>عرض كل الكتب</button>':'مفيش كتب محفوظة في الحساب المفتوح حاليًا. تأكد إنك مسجل بنفس حسابك على الكمبيوتر، أو أضف كتابًا جديدًا.')+'</div>';
}
function openBook(id){
const b=library().find(x=>x.id===id);editId=b?.id||null;$('ymBookForm').reset();$('ymBookFormError').textContent='';
$('ymBookDialogTitle').textContent=b?'تعديل الكتاب':'إضافة كتاب';
$('ymBookTitle').value=b?.title||'';$('ymBookPages').value=b?.totalPages||'';$('ymBookCurrent').value=b?.currentPage||0;
$('ymBookStatus').value=b?.status||'unread';$('ymBookRating').value=b?.rating||0;$('ymBookFavorite').checked=!!b?.favorite;$('ymBookNotes').value=b?.notes||'';$('ymBookDelete').hidden=!b;$('ymBookDialog').showModal();
}
function saveBook(ev){
ev.preventDefault();const a=api(),books=library(),title=$('ymBookTitle').value.trim().slice(0,160),total=Math.floor(Number($('ymBookPages').value));let page=Math.floor(Number($('ymBookCurrent').value));
if(!title||!Number.isFinite(total)||total<1||total>100000||!Number.isFinite(page)||page<0||page>total){$('ymBookFormError').textContent='أدخل عنوان الكتاب وصفحاته، وتأكد من صحة رقم الصفحة الحالية.';return}
const old=books.find(x=>x.id===editId),previousPage=Number(old?.currentPage)||0,highest=Math.max(0,Number(old?.highestPage??old?.currentPage)||0);
let status=$('ymBookStatus').value;if(status==='done')page=total;if(page===total)status='done';else if(page>0&&status==='unread')status='reading';if(old&&page<previousPage)window.YawmiProgress?.reduceBook(old.id,previousPage-page,true);const delta=old?Math.max(0,page-previousPage):0;const completedNow=!!old&&page>=total&&!old.completedAt;
const item={id:old?.id||a.uid(),title,totalPages:total,currentPage:page,highestPage:old&&page<previousPage?page:Math.max(highest,page),status,rating:Math.max(0,Math.min(5,Number($('ymBookRating').value)||0)),favorite:$('ymBookFavorite').checked,notes:$('ymBookNotes').value.trim().slice(0,4000),completedAt:page>=total?(old?.completedAt||(completedNow?a.today():undefined)):undefined,updatedAt:new Date().toISOString()};
if(old)Object.assign(old,item);else books.push(item);
if(delta>0){const s=a.getState(),today=a.today(),r=s.daily[today]||(s.daily[today]={habits:{},tasks:{},water:0,mood:0,note:''});r.habits=r.habits||{};(s.bookReadings||(s.bookReadings=[])).push({id:a.uid(),bookId:old.id,from:previousPage,to:page,pages:delta,date:today});r.habits.reading=(Number(r.habits.reading)||0)+delta;a.activity('book','قرأت '+delta+' صفحة من '+title,today)}else a.activity('book',(old?'عدلت: ':'أضفت: ')+title,a.today());
a.save();$('ymBookDialog').close();a.render();renderBooks();a.notify('تم حفظ الكتاب ✓');
}
function setup(){
if(!api())return;drawer();
$('ymAddBook').addEventListener('click',()=>openBook(null));$('ymBookCancel').addEventListener('click',()=>$('ymBookDialog').close());$('ymBookForm').addEventListener('submit',saveBook);
$('ymBookDelete').addEventListener('click',()=>{const books=library(),i=books.findIndex(b=>b.id===editId);if(i>=0&&confirm('حذف «'+books[i].title+'»؟ سيتم حذف سجل قراءاته المسجلة ومكافأة إكماله من نقاطك، ولا يمكن التراجع عن الحذف.')){const target=books[i],a=api(),s=a.getState();const logs=Array.isArray(s.bookReadings)?s.bookReadings:[];for(const entry of logs.filter(x=>x.bookId===target.id)){const d=s.daily?.[entry.date];if(d?.habits)d.habits.reading=Math.max(0,(Number(d.habits.reading)||0)-(Number(entry.pages)||0))}s.bookReadings=logs.filter(x=>x.bookId!==target.id);books.splice(i,1);if(!books.length){for(const d of Object.values(s.daily||{})){if(d?.habits)d.habits.reading=0;}s.readingBookId=null}else if(s.readingBookId===target.id)s.readingBookId=books[0]?.id||null;a.activity('book','حذفت كتاب: '+target.title,a.today());a.save();$('ymBookDialog').close();a.render();renderBooks()}});
document.addEventListener('click',ev=>{const b=ev.target.closest('button');if(!b)return;
if(b.dataset.bookFilter){filter=b.dataset.bookFilter;renderBooks()}if(b.hasAttribute('data-ym-all-books')){filter='all';renderBooks()}
if(b.dataset.bookEdit)openBook(b.dataset.bookEdit);if(b.dataset.ymUndoBook)window.YawmiProgress?.undoBook(b.dataset.ymUndoBook);
if(b.dataset.bookFav){const x=library().find(x=>x.id===b.dataset.bookFav);if(x){x.favorite=!x.favorite;api().save();renderBooks()}}
if(b.dataset.bookRate){const x=library().find(x=>x.id===b.dataset.bookRate);if(x){x.rating=Number(b.dataset.stars);api().save();renderBooks()}}
});
}
window.YawmiExtras={renderBooks,showAll:()=>{filter='all';renderBooks()}};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
})();