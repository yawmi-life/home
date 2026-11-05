/* YAWMI V35: public metadata from Google Books + Open Library, with Arabic edition validation. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const safe=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cats=[
['self','تطوير الذات','self-help'],['fiction','أدب وروايات','fiction'],['psychology','علم النفس','psychology'],
['business','إدارة الأعمال وريادة الأعمال','business'],['money','المال والاستثمار','personal_finance'],
['philosophy','الفلسفة والفكر','philosophy'],['history','التاريخ والحضارات','history'],['science','العلوم الطبيعية','science'],
['programming','البرمجة والتقنية','computer_science'],['ai','الذكاء الاصطناعي','artificial_intelligence'],
['economics','الاقتصاد','economics'],['biography','السير والتراجم','biography'],
['religion','الدين والدراسات الإسلامية','religion'],['family','الأسرة والتربية','parenting'],
['health','الصحة واللياقة','health'],['medicine','الطب','medicine'],['education','التعليم وتطوير المهارات','education'],
['languages','تعلم اللغات','language_learning'],['poetry','الشعر','poetry'],['scifi','الخيال العلمي','science_fiction'],
['fantasy','الفانتازيا','fantasy'],['mystery','الجريمة والغموض','mystery'],['art','الفنون والتصميم','art'],
['politics','السياسة والمجتمع','political_science'],['travel','السفر والجغرافيا','travel'],
['children','الأطفال واليافعون','juvenile_fiction'],['engineering','الهندسة','engineering'],
['environment','البيئة والطبيعة','environmental_science'],['law','القانون','law'],['cooking','الطبخ','cooking'],
['sports','الرياضة','sports']];
const fields='key,title,author_name,cover_i,ratings_average,ratings_count,number_of_pages_median,edition_count,first_publish_year,language,ebook_access,public_scan_b,want_to_read_count,already_read_count,currently_reading_count';
const Arabic=/[\u0600-\u06FF]/;
const normalizedTitle=x=>String(x||'').normalize('NFKC').toLowerCase().replace(/[\u064B-\u065F\u0670\u0640]/g,'').replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[^\u0621-\u064Aa-z0-9]+/g,' ').trim();
const aliases=[['العادات الذرية','Atomic Habits'],['فن اللامبالاة','The Subtle Art of Not Giving a F'],['قوة العادات','The Power of Habit'],['العادات السبع','The 7 Habits of Highly Effective People'],['الأب الغني والأب الفقير','Rich Dad Poor Dad'],['العمل العميق','Deep Work']];
function aliasOf(q){let z=normalizedTitle(q);for(const [ar,en] of aliases){if(z===normalizedTitle(ar))return en;if(z===normalizedTitle(en))return ar}return ''}
function imageOf(b){if(b.coverUrl)return b.coverUrl;return cover(b.coverId)}
function externalBookUrl(b){return b.googleId?'https://books.google.com/books?id='+encodeURIComponent(b.googleId):'https://openlibrary.org'+b.key}
function googleImage(x){try{const u=new URL(x);if(u.protocol==='http:')u.protocol='https:';return u.protocol==='https:'&&['books.google.com','books.googleusercontent.com'].includes(u.hostname)?u.href:''}catch(_){return ''}}
function googleBook(d){
 const v=d?.volumeInfo||{},gid=String(d?.id||''),title=String(v.title||'').trim();
 if(!/^[A-Za-z0-9_-]{6,40}$/.test(gid)||!title)return null;
 const reviews=count(v.ratingsCount),rating=Number(v.averageRating),language=String(v.language||'').toLowerCase();
 const desc=String(v.description||'').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim().slice(0,1500);
 return {key:'gb:'+gid,googleId:gid,source:'Google Books',title:title.slice(0,190),
  author:Array.isArray(v.authors)?v.authors.slice(0,3).map(x=>String(x).slice(0,100)).join('، '):'',
  coverId:0,coverUrl:googleImage(v.imageLinks?.thumbnail||v.imageLinks?.smallThumbnail||''),
  pages:Math.min(100000,count(v.pageCount)),rating:reviews&&rating>=1&&rating<=5?Number(rating.toFixed(2)):null,reviews,
  year:count(String(v.publishedDate||'').slice(0,4)),editions:1,wants:0,read:0,reading:0,
  langs:language==='ar'?['ara']:[language],language,summary:desc,access:'',scan:false};
}
function isRealArabic(b){return Arabic.test(b.title)&&(b.language==='ar'||b.langs?.includes('ara'))}
const count=x=>Number.isFinite(Number(x))&&Number(x)>0?Math.round(Number(x)):0;
const fmt=x=>Number(x).toLocaleString('ar-EG');
const workKey=x=>/^\/works\/OL[0-9]+W$/.test(String(x||''))?String(x):null;
const cover=x=>count(x)?'https://covers.openlibrary.org/b/id/'+count(x)+'-M.jpg':'';
const rating=b=>b.rating==null?'⭐ لا يوجد تقييم موثّق':'⭐ '+b.rating.toFixed(1)+'/5 · '+fmt(b.reviews)+' تقييم';
const language=b=>isRealArabic(b)?'طبعة وعنوان بالعربية':b.langs?.includes('ara')?'له طبعة عربية؛ عنوان المصدر غير مترجم':b.langs?.length?'أجنبي':'اللغة غير محددة';
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let cat='self',lang='all',sorting='relevance',keyword='',books=[],started=false,expanded=false,loading=false,error='',showCount=24;
let generation=0,nextSlot=0,controller=null,detailToken=0,activeDetail=null;
const memory=new Map(),cacheName='yawmi_books_public_v35';
function normalize(d){
 const key=workKey(d?.key),title=String(d?.title||'').trim();
 if(!key||!title)return null;
 const reviews=count(d.ratings_count),r=Number(d.ratings_average);
 return {key,source:'Open Library',title:title.slice(0,190),
 author:Array.isArray(d.author_name)?d.author_name.slice(0,3).map(x=>String(x).slice(0,100)).join('، '):'',
 coverId:count(d.cover_i),pages:Math.min(100000,count(d.number_of_pages_median)),
 rating:reviews&&r>=1&&r<=5?Number(r.toFixed(2)):null,reviews,
 year:count(d.first_publish_year),editions:count(d.edition_count),
 wants:count(d.want_to_read_count),read:count(d.already_read_count),reading:count(d.currently_reading_count),
 langs:Array.isArray(d.language)?d.language.map(x=>String(x)).slice(0,40):[],
 access:String(d.ebook_access||''),scan:!!d.public_scan_b};
}
const pop=b=>Math.log1p(b.wants)*2.5+Math.log1p(b.read)*1.6+Math.log1p(b.reviews)*1.3+Math.log1p(b.editions);
const quality=b=>b.rating==null?-1:(b.rating*b.reviews+3.5*20)/(b.reviews+20);
function relevance(b){const q=normalizedTitle(keyword),t=normalizedTitle(b.title),alt=normalizedTitle(aliasOf(keyword));return (!q?0:t===q?150:t.includes(q)?100:0)+(alt&&t.includes(alt)?80:0)+(isRealArabic(b)?6:0)}
function order(items){return [...items].sort((a,b)=>sorting==='relevance'?relevance(b)-relevance(a)||pop(b)-pop(a):
 sorting==='rating'?
 quality(b)-quality(a)||b.reviews-a.reviews||pop(b)-pop(a):
 sorting==='popular'?pop(b)-pop(a)||quality(b)-quality(a):a.index-b.index)}
function fromCache(k){
 if(memory.has(k))return memory.get(k);
 try{const arr=JSON.parse(localStorage.getItem(cacheName)||'[]');
  const a=Array.isArray(arr)?arr.find(v=>v.key===k&&Date.now()-v.time<86400000):null;
  if(a){memory.set(k,a.books);return a.books;}}catch(_){}
 return null;
}
function saveCache(k,list){
 memory.set(k,list);
 try{let a=JSON.parse(localStorage.getItem(cacheName)||'[]');
  a=(Array.isArray(a)?a:[]).filter(v=>v.key!==k&&Date.now()-v.time<86400000).slice(0,6);
  localStorage.setItem(cacheName,JSON.stringify([{key:k,time:Date.now(),books:list},...a]));
 }catch(_){}
}
async function json(url,signal){
 const ms=Math.max(0,nextSlot-Date.now());nextSlot=Date.now()+ms+1250;
 if(ms)await wait(ms);
 if(signal?.aborted)throw new Error('CANCELLED');
 const abort=new AbortController(),end=setTimeout(()=>abort.abort(),12000);
 const forward=()=>abort.abort();signal?.addEventListener('abort',forward,{once:true});
 try{const r=await fetch(url,{signal:abort.signal,headers:{Accept:'application/json'}});
  if(!r.ok)throw new Error(r.status===429?'المصدر مشغول حاليًا (حد الطلبات)':'المصدر رد برمز '+r.status);
  return await r.json();
 }finally{clearTimeout(end);signal?.removeEventListener('abort',forward)}
}
function queries(){
 const s=(cats.find(c=>c[0]===cat)||cats[0])[2];
 const q=keyword.trim()||'subject:'+s;
 if(lang==='ar')return [q+' AND language:ara'];
 if(lang==='foreign')return [q];
 if(/[\u0600-\u06FF]/.test(keyword))return [q];
 return [q,q+' AND language:ara'];
}
async function search(force=false){
 const seq=++generation;controller?.abort();controller=new AbortController();
 const key=JSON.stringify([cat,lang,keyword.toLowerCase().trim()]);
 const existing=fromCache(key);showCount=24;error='';
 if(!navigator.onLine){books=existing||[];started=true;loading=false;
  error=existing?'أوفلاين: دي نتائج بحث محفوظة من قبل.':'البحث عن كتب جديدة يحتاج اتصال بالإنترنت. كتبك المحفوظة متاحة بدون إنترنت.';render();return}
 if(existing&&!force){books=existing;started=true;loading=false;render();return}
 loading=true;render();const results=[];let successful=false,reason='';
 for(const q of queries()){
  if(seq!==generation)return;
  const url=new URL('https://openlibrary.org/search.json');
  url.search=new URLSearchParams({q,fields,limit:'45',lang:lang==='ar'?'ar':'en'}).toString();
  try{const d=await json(url.toString(),controller.signal);successful=true;
   for(const item of Array.isArray(d?.docs)?d.docs:[]){const b=normalize(item);if(b)results.push(b)}
  }catch(e){if(seq!==generation||controller.signal.aborted)return;reason=e.message||'تعذر الوصول للمصدر'}
 }
 if(seq!==generation)return;
 const distinct=new Map();for(const b of results)if(!distinct.has(b.key))distinct.set(b.key,b);
 books=[...distinct.values()];
 if(lang==='ar')books=books.filter(b=>b.langs.includes('ara')||/[\u0600-\u06FF]/.test(b.title));
 if(lang==='foreign')books=books.filter(b=>!b.langs.length||b.langs.some(x=>x!=='ara'));
 books=books.map((b,i)=>({...b,index:i}));if(books.length)saveCache(key,books);
 if(!books.length&&existing)books=existing;
 started=true;loading=false;
 if(reason)error=successful?'بعض نتائج المصدر غير متاحة حاليًا.':reason;
 render();
}
function bookCard(b){
 return '<article class="ym-catalog-card"><button type="button" class="ym-catalog-open" data-catalog-detail="'+safe(b.key)+'" aria-label="تفاصيل كتاب '+safe(b.title)+'">'+
 '<span class="ym-catalog-cover">'+(cover(b.coverId)?'<img src="'+cover(b.coverId)+'" alt="" loading="lazy" referrerpolicy="no-referrer">':'<span aria-hidden="true">📖</span>')+'</span>'+
 '<span class="ym-catalog-book-info"><b>'+safe(b.title)+'</b><small>'+safe(b.author||'المؤلف غير مذكور')+'</small>'+
 '<span class="ym-catalog-rating">'+safe(rating(b))+'</span><small>'+(b.pages?'≈ '+fmt(b.pages)+' صفحة':'عدد الصفحات غير متوفر')+' · '+safe(language(b))+'</small></span></button>'+
 '<div class="ym-catalog-foot"><span>'+(b.year?fmt(b.year):'سنة غير متوفرة')+'</span>'+
 '<button type="button" data-catalog-save="'+safe(b.key)+'">＋ لمكتبتي</button></div></article>';
}
function render(){
 const root=$('ymBookCatalog');if(!root)return;
 const selected=cats.find(c=>c[0]===cat)||cats[0];
 root.innerHTML='<div class="ym-catalog-heading"><div><span class="section-eyebrow">DISCOVER BOOKS</span><h3>🔎 اكتشف كتبًا من كل المجالات</h3><p>ابحث عن عنوان أو مؤلف، أو استكشف ترشيحات من الكتب العربية والأجنبية بتقييماتها الحقيقية.</p></div><small>بيانات Open Library</small></div>'+
 '<form id="ymCatalogSearch" role="search" class="ym-catalog-search"><label for="ymCatalogQuery">ابحث عن كتاب أو مؤلف</label><div><input id="ymCatalogQuery" type="search" maxlength="90" value="'+safe(keyword)+'" placeholder="مثال: أرض زيكولا / Atomic Habits / نجيب محفوظ">'+
 '<button class="btn" type="submit">بحث</button></div></form>'+
 '<div class="ym-catalog-controls"><label>المجال<select id="ymCatalogCategory">'+cats.map(c=>'<option value="'+c[0]+'" '+(cat===c[0]?'selected':'')+'>'+safe(c[1])+'</option>').join('')+'</select></label>'+
 '<label>اللغة<select id="ymCatalogLanguage"><option value="all" '+(lang==='all'?'selected':'')+'>عربي وأجنبي</option><option value="ar" '+(lang==='ar'?'selected':'')+'>عربي أو له طبعة عربية</option><option value="foreign" '+(lang==='foreign'?'selected':'')+'>أجنبي</option></select></label>'+
 '<label>الترتيب<select id="ymCatalogSort"><option value="popular" '+(sorting==='popular'?'selected':'')+'>الأكثر شهرة</option><option value="rating" '+(sorting==='rating'?'selected':'')+'>الأعلى تقييمًا</option><option value="relevance" '+(sorting==='relevance'?'selected':'')+'>الأقرب للبحث</option></select></label></div>'+
 '<div class="ym-catalog-categories" role="group" aria-label="مجالات الكتب">'+(expanded?cats:cats.slice(0,8)).map(c=>
 '<button type="button" data-catalog-category="'+c[0]+'" class="'+(cat===c[0]?'active':'')+'">'+safe(c[1])+'</button>').join('')+
 '<button type="button" data-catalog-expand>'+(expanded?'إظهار أقل':'كل المجالات ('+cats.length+')')+'</button></div>'+
 '<div class="ym-catalog-results-title"><h4>'+(keyword?'نتائج: '+safe(keyword):'كتب في '+safe(selected[1]))+'</h4>'+
 '<span role="status" aria-live="polite">'+(loading?'جاري البحث…':started?fmt(books.length)+' نتيجة ضمن العينة':'اختار مجالًا أو ابحث')+'</span></div>'+
 (error?'<p class="ym-catalog-warning">'+safe(error)+' <button type="button" data-catalog-retry>إعادة المحاولة</button></p>':'')+
 (loading?'<div class="ym-catalog-skeleton" aria-label="تحميل الكتب">جاري تحميل الكتب من المصدر…</div>':
 started?(books.length?'<div class="ym-catalog-grid">'+order(books).slice(0,showCount).map(bookCard).join('')+'</div>'+
 (books.length>showCount?'<button type="button" class="btn soft ym-catalog-more" data-catalog-more>عرض المزيد</button>':''):
 '<div class="ym-empty">لا توجد كتب مطابقة لهذه الشروط في الفهرس المتاح. جرّب مجالًا أو كلمات مختلفة.</div>'):
 '<p class="muted">اختار مجالًا من القائمة؛ هتشوف أفضل النتائج حسب البيانات المتاحة.</p>')+
 '<p class="ym-catalog-disclaimer">التقييمات وعدد المراجعات من Open Library فقط. الصفحة تقديرية وتختلف حسب الطبعة. الشهرة تعتمد على مؤشرات القراءة والتقييمات وعدد الطبعات، وترتيب الكتب داخل النتائج المسترجعة وليس كل الكتب عالميًا.</p>';
}
function getDialog(){
 let el=$('ymCatalogDetail');if(el)return el;
 el=document.createElement('dialog');el.id='ymCatalogDetail';el.className='ym-catalog-dialog';
 el.setAttribute('aria-label','نبذة الكتاب وتفاصيله');
 el.innerHTML='<div id="ymCatalogDetailBody"></div><button type="button" class="ym-catalog-close" data-catalog-close aria-label="إغلاق">✕</button>';
 document.body.appendChild(el);el.addEventListener('close',()=>{detailToken++;activeDetail=null});
 return el;
}
function summaryText(x){
 let t=typeof x==='string'?x:x&&typeof x.value==='string'?x.value:'';
 return String(t).replace(/\[[^\]]+\]\([^)]+\)/g,'').replace(/[>#*_]/g,'').replace(/\s+/g,' ').trim().slice(0,590);
}
function dialogContent(b,about,done){
 return '<div class="ym-catalog-detail-layout"><div class="ym-catalog-detail-image">'+
 (cover(b.coverId)?'<img src="'+cover(b.coverId)+'" alt="" referrerpolicy="no-referrer">':'📖')+'</div><div>'+
 '<h2>'+safe(b.title)+'</h2><p><b>المؤلف: </b>'+safe(b.author||'غير مذكور')+'</p>'+
 '<p><b>عدد الصفحات: </b>'+(b.pages?'حوالي '+fmt(b.pages)+' حسب الطبعة':'غير متوفر')+'</p>'+
 '<p><b>تقييم القراء: </b>'+safe(rating(b))+'</p>'+
 '<p><b>اللغة: </b>'+safe(language(b))+(b.year?' · نشر أول مرة '+fmt(b.year):'')+'</p>'+
 '<h3>نبذة عن الكتاب</h3>'+
 (about?'<p class="ym-catalog-description">'+safe(about)+'</p>':
 '<p class="muted">'+(done?'لا توجد نبذة موثقة لهذا العنوان في المصدر. يمكنك مراجعة صفحة الكتاب.':'جاري جلب النبذة من المصدر…')+'</p>')+
 '<div class="ym-catalog-detail-actions"><button class="btn" type="button" data-catalog-save="'+safe(b.key)+'">＋ أضف لمكتبتي</button>'+
 '<a href="https://openlibrary.org'+safe(b.key)+'" rel="noopener noreferrer" target="_blank">تفاصيله وخيارات القراءة ↗</a></div>'+
 '<p class="muted mini">'+(b.access==='public'||b.scan?'قد تتوفر نسخة قابلة للمعاينة عبر المصدر، وفق حقوق النشر.':'توافر المعاينة أو الاستعارة يعتمد على حقوق النسخة.')+'</p>'+
 '<small class="muted">النبذة والبيانات مصدرها Open Library. لا يوفر يومي نسخًا مقرصنة للكتب.</small></div></div>';
}
async function showBook(key){
 const b=books.find(x=>x.key===key);if(!b)return;
 const dlg=getDialog(),seq=++detailToken;activeDetail=b;
 $('ymCatalogDetailBody').innerHTML=dialogContent(b,'',false);if(!dlg.open)dlg.showModal();
 const cached=memory.get('work:'+key);
 if(cached!==undefined){$('ymCatalogDetailBody').innerHTML=dialogContent(b,cached,true);return}
 if(!navigator.onLine){$('ymCatalogDetailBody').innerHTML=dialogContent(b,'',true);return}
 try{const v=await json('https://openlibrary.org'+key+'.json');
  if(seq!==detailToken||!dlg.open)return;
  const about=summaryText(v.description)||summaryText(v.first_sentence);
  memory.set('work:'+key,about);
  $('ymCatalogDetailBody').innerHTML=dialogContent(b,about,true);
 }catch(_){if(seq===detailToken&&dlg.open)$('ymCatalogDetailBody').innerHTML=dialogContent(b,'',true)}
}
function addBook(key){
 const b=books.find(x=>x.key===key)||activeDetail;
 if(!b||b.key!==key)return;
 const fn=window.YawmiExtras?.addFromCatalog;
 if(!fn)return window.YawmiExtraAPI?.notify?.('افتح مكتبتي ثم جرّب إضافة الكتاب من جديد');
 const dlg=$('ymCatalogDetail');if(dlg?.open)dlg.close();
 fn({key:b.key,title:b.title,author:b.author,pages:b.pages,coverId:b.coverId,
   rating:b.rating,reviews:b.reviews,source:'Open Library'});
}
function visible(){
 if(!$('ymBookCatalog'))return;
 if(!started&&!loading)search();else render();
}
function init(){
 if(!$('ymBookCatalog'))return;render();
 document.addEventListener('submit',e=>{
  if(e.target?.id!=='ymCatalogSearch')return;e.preventDefault();
  const q=$('ymCatalogQuery')?.value.trim().slice(0,90)||'';
  if(keyword===q)return search(true);
  keyword=q;return search();
 });
 document.addEventListener('change',e=>{
  if(e.target?.id==='ymCatalogCategory'){cat=e.target.value;keyword='';return search()}
  if(e.target?.id==='ymCatalogLanguage'){lang=e.target.value;return search()}
  if(e.target?.id==='ymCatalogSort'){sorting=e.target.value;return render()}
 });
 document.addEventListener('click',e=>{
  const b=e.target.closest?.('button');if(!b)return;
  if(b.hasAttribute('data-catalog-close')){getDialog().close();return}
  if(b.dataset.catalogCategory){cat=b.dataset.catalogCategory;keyword='';return search()}
  if(b.hasAttribute('data-catalog-expand')){expanded=!expanded;return render()}
  if(b.hasAttribute('data-catalog-retry'))return search(true);
  if(b.hasAttribute('data-catalog-more')){showCount+=24;return render()}
  if(b.dataset.catalogDetail)return showBook(b.dataset.catalogDetail);
  if(b.dataset.catalogSave)return addBook(b.dataset.catalogSave);
 });
 window.addEventListener('online',()=>{if(started&&error)search(true)});
 if($('page-books')?.classList.contains('active'))visible();
}
window.YawmiBookCatalog={render,visible,search,normalize,order,categoryCount:cats.length,
 getState:()=>({cat,lang,sorting,loaded:started,books:books.length,loading})};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();