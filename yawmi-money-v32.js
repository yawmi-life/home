/* YAWMI V32: private money dashboard. All records stay inside the user's existing synced document. */
(()=>{'use strict';
const $=id=>document.getElementById(id),api=()=>window.YawmiExtraAPI;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const currencies=['SAR','EGP','USD','AED','EUR','QAR','GBP','CAD'];
const expenses=[['food','🍽️','مطاعم وطعام'],['groceries','🛒','بقالة ومشتريات'],['home','🏠','سكن وإيجار'],['bills','💡','فواتير واشتراكات'],['transport','🚗','مواصلات'],['shopping','🛍️','تسوّق'],['health','🩺','صحة'],['education','🎓','تعليم'],['fun','🎮','ترفيه'],['family','💝','عائلة وهدايا'],['travel','✈️','سفر'],['business','💼','أعمال'],['other','🧾','أخرى']];
const incomes=[['salary','💰','راتب'],['freelance','🧑‍💻','عمل حر'],['sales','📈','مبيعات'],['investment','🌱','عوائد استثمار'],['gift','🎁','هدية أو مكافأة'],['refund','↩️','استرداد'],['other_income','✨','دخل آخر']];
const labels={income:'دخل',expense:'مصروف',transfer:'تحويل'};
const defaultAccounts=[{id:'cash',name:'نقدي',opening:0,icon:'💵'},{id:'bank',name:'حساب بنكي',opening:0,icon:'🏦'},{id:'wallet',name:'محفظة إلكترونية',opening:0,icon:'📱'}];
let shownMonth=new Date().toISOString().slice(0,7),searchTerm='',typeFilter='all',categoryFilter='all',accountFilter='all';
let isHidden=false,editing=null,editGoal=null,activeForm='transaction',formType='expense',formRecurring=false,lastState=null;
const today=()=>api()?.today?.()||new Date().toISOString().slice(0,10);
const monthOf=d=>String(d||'').slice(0,7);
const cur=f=>currencies.includes(f?.currency)?f.currency:'SAR';
const newId=()=>api()?.uid?.()||('f'+Date.now().toString(36));
const category=(id,type)=>[...(type==='income'?incomes:expenses)].find(c=>c[0]===id)||null;
const catName=(id,type)=>{const c=category(id,type);return c?c[1]+' '+c[2]:'أخرى'};
const hasNumber=x=>typeof x==='number'&&Number.isSafeInteger(x);
const clampCents=x=>hasNumber(x)&&Math.abs(x)<100000000000?x:0;
const amountInput=x=>Number.isFinite(Number(x))&&Number(x)>=0&&Number(x)<1e9?Math.round(Number(x)*100):null;
const cleanAmount=s=>{const v=String(s??'').trim().replace(',','.');if(!/^\d{1,9}(\.\d{1,2})?$/.test(v))return null;return amountInput(v)};
const cleanSignedAmount=s=>{const v=String(s??'').trim().replace(',','.');if(!/^-?\d{1,9}(\.\d{1,2})?$/.test(v))return null;const c=cleanAmount(v.replace(/^-/,'').trim());return c===null?null:(v.startsWith('-')?-c:c)};
const safeDay=s=>/^\d{4}-\d{2}-\d{2}$/.test(String(s||''))&&!Number.isNaN(Date.parse(s+'T12:00:00'))&&new Date(s+'T12:00:00').toISOString().slice(0,10)===s;
const money=(n,c='SAR')=>new Intl.NumberFormat('ar-SA',{style:'currency',currency:c,maximumFractionDigits:2,minimumFractionDigits:2}).format(clampCents(n)/100);
function ensure(){
 const s=api()?.getState?.();if(!s)return null;
 if(lastState!==s){lastState=s;searchTerm='';typeFilter='all';categoryFilter='all';accountFilter='all';isHidden=false;shownMonth=(api()?.today?.()||new Date().toISOString().slice(0,10)).slice(0,7);}
 if(!s.finance||typeof s.finance!=='object'||Array.isArray(s.finance))s.finance={};
 const f=s.finance;
 if(!Array.isArray(f.accounts))f.accounts=structuredClone(defaultAccounts);
 if(!Array.isArray(f.transactions))f.transactions=[];
 if(!f.budgets||typeof f.budgets!=='object'||Array.isArray(f.budgets))f.budgets={};
 if(!Array.isArray(f.goals))f.goals=[];
 if(!Array.isArray(f.recurring))f.recurring=[];
 if(!Array.isArray(f.balanceAdjustments))f.balanceAdjustments=[];
 if(!currencies.includes(f.currency))f.currency='SAR';
 return f;
}
function allowed(){return Boolean(api()?.getState?.()&&(!window.YawmiCloud?.configured||window.YawmiCloud?.ready));}
function save(){if(!allowed())return false;return api().save()!==false;}
const total=items=>items.reduce((n,t)=>n+clampCents(t.amount),0);
function totals(f,month=shownMonth){const current=f.transactions.filter(x=>monthOf(x.date)===month);
 return {income:total(current.filter(x=>x.type==='income')),expense:total(current.filter(x=>x.type==='expense')),
  transfers:current.filter(x=>x.type==='transfer').length,current};}
function balance(f,id){let b=clampCents(f.accounts.find(x=>x.id===id)?.opening||0);
 for(const a of f.balanceAdjustments||[]){if(a.accountId===id)b+=clampCents(a.amount)}
 for(const x of f.transactions){let a=clampCents(x.amount);
  if(x.type==='income'&&x.accountId===id)b+=a;
  if(x.type==='expense'&&x.accountId===id)b-=a;
  if(x.type==='transfer'){if(x.accountId===id)b-=a;if(x.toAccountId===id)b+=a}
 }
 return b;
}
function goalProgress(g){return Math.max(0,clampCents(g.saved||0))}
function monthLabel(month){try{return new Intl.DateTimeFormat('ar-EG',{month:'long',year:'numeric'}).format(new Date(month+'-01T12:00:00'))}catch(_){return month}}
function changeMonth(delta){const [y,m]=shownMonth.split('-').map(Number);const d=new Date(y,m-1+delta,1,12);shownMonth=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0')].join('-');render()}
const mask=x=>isHidden?'••••••':x;
function csvDownload(name,rows){
 const safeCell=x=>{let v=String(x??'');if(/^[\s]*[=+@-]/.test(v))v="'"+v;return '"'+v.replace(/"/g,'""')+'"';};
 const data='\ufeff'+rows.map(row=>row.map(safeCell).join(',')).join('\r\n');
 const blob=new Blob([data],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
function categoriesSummary(f){const spending=f.transactions.filter(t=>t.type==='expense'&&monthOf(t.date)===shownMonth),by=new Map();
 for(const x of spending)by.set(x.category,(by.get(x.category)||0)+clampCents(x.amount));
 return [...by.entries()].map(([id,amount])=>({id,amount})).sort((a,b)=>b.amount-a.amount);
}
const colors=['#8e8cf4','#61b99c','#f0b66d','#eb8da0','#68a4d6','#b995d4','#79a18f','#d2a67e'];
function chart(f){
 const last=Array.from({length:6},(_,i)=>{const [y,m]=shownMonth.split('-').map(Number);
 const d=new Date(y,m-6+i,1,12);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0')].join('-')});
 const series=last.map(m=>({...totals(f,m),month:m})),max=Math.max(100,...series.flatMap(x=>[x.income,x.expense]));
 return '<section class="ym-money-surface ym-money-chart"><div class="ym-money-section-title"><h3>حركة الفلوس خلال 6 شهور</h3><small>دخل <i class="ym-money-legend income"></i> · مصروف <i class="ym-money-legend expense"></i></small></div>'+
 '<div class="ym-money-plot" role="img" aria-label="مقارنة الدخل والمصروفات خلال ستة أشهر">'+series.map(x=>
 '<div class="ym-money-bar-group"><div class="ym-money-bars">'+
 '<div class="ym-money-bar income" style="height:'+Math.max(2,Math.round(x.income/max*100))+'%" title="دخل '+monthLabel(x.month)+': '+money(x.income,f.currency)+'"></div>'+
 '<div class="ym-money-bar expense" style="height:'+Math.max(2,Math.round(x.expense/max*100))+'%" title="مصروف '+monthLabel(x.month)+': '+money(x.expense,f.currency)+'"></div></div>'+
 '<small>'+esc(x.month.slice(5))+'</small></div>').join('')+'</div></section>';
}
function categoryChart(f){
 const arr=categoriesSummary(f),sum=arr.reduce((a,x)=>a+x.amount,0);
 if(!sum)return '<section class="ym-money-surface"><div class="ym-money-section-title"><h3>مصروفاتك رايحة فين؟</h3></div><p class="muted">لسه مفيش مصروفات مسجّلة للشهر ده.</p></section>';
 let start=0;const segments=arr.map((x,i)=>{const end=start+x.amount/sum*100;
 const s=colors[i%colors.length]+' '+start.toFixed(2)+'% '+end.toFixed(2)+'%';start=end;return s});
 return '<section class="ym-money-surface"><div class="ym-money-section-title"><h3>مصروفاتك رايحة فين؟</h3><small>حسب التصنيف</small></div>'+
 '<div class="ym-money-split"><div class="ym-money-donut" role="img" aria-label="توزيع المصروفات حسب التصنيف" style="background:conic-gradient('+segments.join(',')+')"><div><small>إجمالي المصروفات</small><b>'+mask(money(sum,f.currency))+'</b></div></div>'+
 '<div class="ym-money-category-list">'+arr.slice(0,7).map((x,i)=>'<div><span><i style="background:'+colors[i%colors.length]+'"></i>'+esc(catName(x.id,'expense'))+'</span><b>'+mask(money(x.amount,f.currency))+'</b><small>'+Math.round(x.amount/sum*100)+'%</small></div>').join('')+'</div></div></section>';
}
function budgets(f){
 const list=Object.entries(f.budgets).filter(([key,value])=>category(key,'expense')&&clampCents(value)>0);
 const spent=categoriesSummary(f),sMap=new Map(spent.map(x=>[x.id,x.amount]));
 const totalBudget=clampCents(f.budgets.__total||0);
 return '<section class="ym-money-surface"><div class="ym-money-section-title"><div><h3>ميزانيتك الشهرية</h3><small>حدود تختارها بنفسك لكل تصنيف</small></div><button type="button" class="ym-money-link" data-money-budget>＋ تعديل الميزانية</button></div>'+
 (!list.length&&!totalBudget?'<p class="muted">حدّد ميزانية شهرية علشان تعرف لو صرفك قرب من الحد أو عدى عليه.</p>':'')+
 (totalBudget?budgetLine('الميزانية الكلية',totals(f).expense,totalBudget,f.currency):'')+
 list.map(([id,limit])=>budgetLine(catName(id,'expense'),sMap.get(id)||0,limit,f.currency)).join('')+'</section>';
}
function budgetLine(title,spent,limit,c){
 const pct=Math.round(spent/limit*100),over=spent>limit;
 return '<div class="ym-money-budget-row"><div><strong>'+esc(title)+'</strong><small class="'+(over?'ym-money-over':'')+'">'+pct+'% · '+mask(money(spent,c))+' من '+mask(money(limit,c))+(over?' · تجاوزت الميزانية':'')+'</small></div>'+
 '<div class="ym-money-progress"><i class="'+(over?'over':'')+'" style="width:'+Math.min(100,pct)+'%"></i></div></div>';
}
function accounts(f){
 return '<section class="ym-money-surface"><div class="ym-money-section-title"><div><h3>حساباتك ومحافظك</h3><small>رصيد البداية + الحركات المسجلة</small></div><button type="button" data-money-account class="ym-money-link">＋ حساب</button></div>'+
 '<div class="ym-money-accounts">'+f.accounts.map(a=>'<div class="ym-money-account"><span class="ym-money-account-emoji">'+esc(a.icon||'💳')+'</span><small>'+esc(a.name)+'</small><b>'+mask(money(balance(f,a.id),f.currency))+'</b><button class="ym-money-account-edit" data-money-account-edit="'+esc(a.id)+'" type="button">✎ تعديل الرصيد</button></div>').join('')+'</div>'+
 '<p class="muted mini">تعديل الرصيد الحالي يسجل فرق تسوية منفصلًا، من غير مسح معاملاتك أو إضافته للدخل والمصروف.</p>'+ (f.balanceAdjustments.length?'<details class="ym-money-adjustment-history"><summary>سجل تسويات الأرصدة ('+f.balanceAdjustments.length+')</summary>'+f.balanceAdjustments.slice().reverse().slice(0,20).map(z=>'<div><span>'+esc(z.date||'')+' · '+esc(f.accounts.find(a=>a.id===z.accountId)?.name||'حساب محذوف')+'</span><b>'+mask(money(z.amount,f.currency))+'</b></div>').join('')+'</details>':'')+'</section>';
}
function savings(f){
 return '<section class="ym-money-surface"><div class="ym-money-section-title"><div><h3>أهداف الادخار</h3><small>تقدّم تشجّعك عليه، من غير خصم مبالغ تلقائيًا</small></div><button type="button" data-money-goal class="ym-money-link">＋ هدف ادخار</button></div>'+
 (f.goals.length?'<div class="ym-money-goals">'+f.goals.map(g=>{
  const p=goalProgress(g),pct=Math.round(p/Math.max(1,g.target)*100);
  return '<div class="ym-money-goal"><div><b>🎯 '+esc(g.title)+'</b><span>'+pct+'%</span></div><div class="ym-money-progress"><i style="width:'+Math.min(100,pct)+'%"></i></div>'+
 '<p>'+mask(money(p,f.currency))+' من '+mask(money(g.target,f.currency))+'</p>'+
 '<div class="ym-money-mini-actions"><button data-money-goal-edit="'+esc(g.id)+'">تعديل</button><button data-money-goal-contribute="'+esc(g.id)+'">＋ تسجيل ادخار</button></div></div>'}).join('')+'</div>':
 '<p class="muted">مثلاً: طوارئ 3 شهور، جهاز جديد، رحلة أو كورس. هدفك يظهر هنا بمجرد إضافته.</p>')+
 '<p class="muted mini">متابعة الادخار مستقلة عن رصيد حساباتك. لو نقلت فلوس فعلًا، سجّل تحويلًا منفصلًا بين الحسابات.</p></section>';
}
function dueDay(month,day){
 const [y,m]=month.split('-').map(Number),last=new Date(y,m,0).getDate();
 return month+'-'+String(Math.min(last,Math.max(1,day))).padStart(2,'0');
}
function recurrence(f){
 const selected=f.recurring.filter(x=>x&&['income','expense'].includes(x.type));
 return '<section class="ym-money-surface"><div class="ym-money-section-title"><div><h3>التزامات ودخل متكرر</h3><small>ذكّر نفسك بالفواتير والراتب</small></div><button type="button" data-money-recurring class="ym-money-link">＋ تكرار شهري</button></div>'+
 (selected.length?selected.map(r=>{
 const done=f.transactions.some(t=>t.recurringId===r.id&&monthOf(t.date)===shownMonth);
 const d=dueDay(shownMonth,r.day);
 return '<div class="ym-money-due"><div><b>'+esc(r.title)+'</b><small>'+esc(labels[r.type])+' · '+esc(d)+' · '+mask(money(r.amount,f.currency))+'</small></div>'+
 '<button data-money-log-recurring="'+esc(r.id)+'" '+(done?'disabled':'')+'>'+(done?'✓ مسجّل':'تسجيل الحركة')+'</button>'+
 '<button class="ym-money-danger-link" data-money-remove-recurring="'+esc(r.id)+'" aria-label="حذف التكرار '+esc(r.title)+'">✕</button></div>';
 }).join(''):'<p class="muted">أضف الإيجار، الفواتير، الاشتراكات أو الراتب المتكرر. التطبيق لا يسجّل أي حركة تلقائيًا دون تأكيدك.</p>')+
 '</section>';
}
function transactionList(f){
 const rows=f.transactions.filter(x=>monthOf(x.date)===shownMonth)
 .filter(x=>typeFilter==='all'||x.type===typeFilter)
 .filter(x=>categoryFilter==='all'||x.category===categoryFilter)
 .filter(x=>accountFilter==='all'||x.accountId===accountFilter||x.toAccountId===accountFilter)
 .filter(x=>(x.title+' '+(x.note||'')+' '+catName(x.category,x.type)).toLocaleLowerCase().includes(searchTerm.toLocaleLowerCase()))
 .sort((a,b)=>b.date.localeCompare(a.date)||String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
 return '<div class="ym-money-transactions-list">'+(rows.length?rows.map(x=>{
 const typ=x.type==='income'?'income':x.type==='expense'?'expense':'transfer';
 const acct=f.accounts.find(a=>a.id===x.accountId)?.name||'حساب محذوف';
 const to=f.accounts.find(a=>a.id===x.toAccountId)?.name||'';
 return '<div class="ym-money-transaction"><span class="ym-money-tx-icon '+typ+'">'+(typ==='income'?'↙':typ==='expense'?'↗':'⇄')+'</span>'+
 '<div class="ym-money-tx-copy"><strong>'+esc(x.title)+'</strong><small>'+esc(x.date)+' · '+(typ==='transfer'?esc(acct)+' ← '+esc(to):esc(catName(x.category,x.type))+' · '+esc(acct))+'</small>'+(x.note?'<p>'+esc(x.note)+'</p>':'')+'</div>'+
 '<div class="ym-money-tx-tail"><b class="'+typ+'">'+(typ==='income'?'+':typ==='expense'?'−':'')+mask(money(x.amount,f.currency))+'</b>'+
 '<div><button type="button" data-money-edit="'+esc(x.id)+'" aria-label="تعديل حركة '+esc(x.title)+'">تعديل</button><button type="button" class="ym-money-danger-link" data-money-delete="'+esc(x.id)+'" aria-label="حذف حركة '+esc(x.title)+'">حذف</button></div></div></div>';
 }).join(''):'<p class="ym-money-empty">لا توجد حركات مطابقة. اضغط «مصروف جديد» أو «دخل جديد» للبدء.</p>')+'</div>';
}
function transactionSection(f){
 return '<section class="ym-money-surface ym-money-ledger"><div class="ym-money-section-title"><div><h3>سجل الحركات</h3><small>سهل تبحث فيه وتصحّح أي تسجيل</small></div><button type="button" class="ym-money-link" data-money-export>⇩ تصدير CSV</button></div>'+
 '<div class="ym-money-filters"><input id="ymMoneySearch" type="search" placeholder="ابحث عن حركة أو ملاحظة" aria-label="البحث في المصروفات" value="'+esc(searchTerm)+'">'+
 '<select id="ymMoneyTypeFilter" aria-label="نوع الحركة"><option value="all">كل الحركات</option><option value="expense" '+(typeFilter==='expense'?'selected':'')+'>المصروفات</option><option value="income" '+(typeFilter==='income'?'selected':'')+'>الدخل</option><option value="transfer" '+(typeFilter==='transfer'?'selected':'')+'>التحويلات</option></select>'+
 '<select id="ymMoneyCategoryFilter" aria-label="التصنيف"><option value="all">كل التصنيفات</option>'+[...expenses,...incomes].map(c=>'<option value="'+esc(c[0])+'" '+(categoryFilter===c[0]?'selected':'')+'>'+esc(c[2])+'</option>').join('')+'</select>'+
 '<select id="ymMoneyAccountFilter" aria-label="الحساب"><option value="all">كل الحسابات</option>'+f.accounts.map(a=>'<option value="'+esc(a.id)+'" '+(accountFilter===a.id?'selected':'')+'>'+esc(a.name)+'</option>').join('')+'</select></div>'+
 '<div id="ymMoneyTxList">'+transactionList(f)+'</div></section>';
}
function render(){
 const root=$('ymMoneyApp');if(!root)return;
 const f=ensure();if(!f)return;
 const m=totals(f),net=m.income-m.expense,accountTotal=f.accounts.reduce((n,a)=>n+balance(f,a.id),0);
 const rate=m.income>0?Math.max(0,Math.round(net/m.income*100)):0;
 root.innerHTML='<div class="ym-money-hero"><div class="ym-money-hero-top"><div><span class="ym-money-eyebrow">MY MONEY · ماليتي</span><h2>فلوسك في صورة أوضح ✨</h2><p>دخل، مصروفات، ميزانية وادخار… كله متجمع في مكان واحد وبحسابك الخاص.</p></div>'+
 '<div class="ym-money-hero-tools"><label>الشهر<input id="ymMoneyMonth" type="month" value="'+esc(shownMonth)+'" aria-label="شهر الميزانية"></label>'+
 '<button type="button" class="ym-money-hero-icon" data-money-prev aria-label="الشهر السابق">‹</button><button type="button" class="ym-money-hero-icon" data-money-next aria-label="الشهر التالي">›</button>'+
 '<button type="button" class="ym-money-hero-icon" data-money-hide aria-label="'+(isHidden?'إظهار الأرقام':'إخفاء الأرقام')+'">'+(isHidden?'◉':'◉̸')+'</button></div></div>'+
 '<div class="ym-money-stats"><div><small>الدخل</small><b>'+mask(money(m.income,f.currency))+'</b><span>↙ دخل الشهر</span></div>'+
 '<div><small>المصروفات</small><b>'+mask(money(m.expense,f.currency))+'</b><span>↗ مصروف الشهر</span></div>'+
 '<div><small>صافي الشهر</small><b class="'+(net<0?'negative':'')+'">'+mask(money(net,f.currency))+'</b><span>'+rate+'% نسبة التوفير من الدخل</span></div>'+
 '<div><small>إجمالي أرصدة الحسابات</small><b>'+mask(money(accountTotal,f.currency))+'</b><span>يشمل رصيد البداية والتحويلات</span></div></div>'+
 '<div class="ym-money-hero-actions"><button type="button" data-money-add="expense">− مصروف جديد</button><button type="button" data-money-add="income">＋ دخل جديد</button>'+
 '<button type="button" data-money-add="transfer">⇄ تحويل بين حساباتي</button><label>العملة <select id="ymMoneyCurrency">'+currencies.map(c=>'<option '+(f.currency===c?'selected':'')+'>'+c+'</option>').join('')+'</select></label></div></div>'+
 '<div class="ym-money-layout">'+accounts(f)+budgets(f)+chart(f)+categoryChart(f)+savings(f)+recurrence(f)+'</div>'+transactionSection(f)+
 '<p class="ym-money-note">🔒 السجل خاص بحسابك. بدون ربط بنوك، وبدون تحويل عملات تلقائي، وبدون التأثير على نقاط XP أو عملات اللعبة.</p>';
}
function refreshList(){const f=ensure();if(f&&$('ymMoneyTxList'))$('ymMoneyTxList').innerHTML=transactionList(f)}
function modal(){
 let d=$('ymMoneyDialog');if(d)return d;
 d=document.createElement('dialog');d.id='ymMoneyDialog';d.className='ym-money-dialog';d.setAttribute('aria-label','إدارة المالية');
 d.innerHTML='<div id="ymMoneyDialogContent"></div><button type="button" class="ym-money-modal-close" data-money-close aria-label="إغلاق">✕</button>';
 document.body.appendChild(d);return d;
}
function formField(label,html){return '<label class="ym-money-field"><span>'+label+'</span>'+html+'</label>'}
function openTransaction(type='expense',id=null){
 const f=ensure();if(!f)return;
 activeForm='transaction';editing=id;formType=type;
 const x=id?f.transactions.find(v=>v.id===id):null;if(x)formType=x.type;
 const fields=categoryOptions(formType,x?.category);
 const accountOpts=(selected)=>f.accounts.map(a=>'<option value="'+esc(a.id)+'" '+(selected===a.id?'selected':'')+'>'+esc(a.name)+'</option>').join('');
 const d=modal();
 $('ymMoneyDialogContent').innerHTML='<form id="ymMoneyForm"><div class="ym-money-modal-title"><span>＋ NEW TRANSACTION</span><h2>'+(x?'تعديل حركة مالية':'تسجيل حركة جديدة')+'</h2></div>'+
 '<div class="ym-money-form-grid">'+
 formField('نوع الحركة','<select id="ymMoneyFormType"><option value="expense" '+(formType==='expense'?'selected':'')+'>مصروف</option><option value="income" '+(formType==='income'?'selected':'')+'>دخل</option><option value="transfer" '+(formType==='transfer'?'selected':'')+'>تحويل</option></select>')+
 formField('المبلغ','<input id="ymMoneyFormAmount" type="text" inputmode="decimal" placeholder="0.00" required maxlength="12" value="'+esc(x?(x.amount/100).toFixed(2):'')+'">')+
 formField('الوصف','<input id="ymMoneyFormTitle" required maxlength="90" placeholder="مثال: شراء بقالة أو راتب" value="'+esc(x?.title||'')+'">')+
 formField('التاريخ','<input id="ymMoneyFormDate" type="date" value="'+esc(x?.date||today())+'" required>')+
 '<div id="ymMoneyFormCategoryWrap">'+formField('التصنيف','<select id="ymMoneyFormCategory">'+fields+'</select>')+'</div>'+
 formField('من / إلى الحساب','<select id="ymMoneyFormAccount">'+accountOpts(x?.accountId||f.accounts[0]?.id)+'</select>')+
 '<div id="ymMoneyFormToWrap">'+formField('إلى الحساب (للتحويل)','<select id="ymMoneyFormTo">'+accountOpts(x?.toAccountId||f.accounts[1]?.id)+'</select>')+'</div>'+
 formField('ملاحظة (اختيارية)','<input id="ymMoneyFormNote" maxlength="280" value="'+esc(x?.note||'')+'" placeholder="تفاصيل تساعدك تفتكر الحركة">')+
 '</div><p class="ym-money-form-error" id="ymMoneyFormError" role="alert"></p>'+
 '<div class="ym-money-modal-actions"><button class="btn" type="submit">'+(x?'حفظ التعديل':'تسجيل الحركة')+'</button><button type="button" data-money-close class="btn soft">إلغاء</button></div>'+
 '<p class="muted mini">الحركة لن تضاف إلى XP. كل مبلغ يُسجل مرة واحدة فقط.</p></form>';
 if(!d.open)d.showModal();updateFormType();
}
function categoryOptions(type,selected){return (type==='income'?incomes:expenses).map(c=>'<option value="'+c[0]+'" '+(selected===c[0]?'selected':'')+'>'+c[1]+' '+c[2]+'</option>').join('')}
function updateFormType(){
 const type=$('ymMoneyFormType')?.value;formType=type||'expense';
 if($('ymMoneyFormCategoryWrap'))$('ymMoneyFormCategoryWrap').hidden=formType==='transfer';
 if($('ymMoneyFormToWrap'))$('ymMoneyFormToWrap').hidden=formType!=='transfer';
 const c=$('ymMoneyFormCategory');if(c)c.innerHTML=categoryOptions(formType,c.value);
}
function errorMsg(text){const el=$('ymMoneyFormError');if(el)el.textContent=text}
function finish(){if(modal().open)modal().close();editing=null;editGoal=null;render()}
function saveTransaction(){
 const f=ensure(),type=$('ymMoneyFormType')?.value;
 const amount=cleanAmount($('ymMoneyFormAmount')?.value),date=$('ymMoneyFormDate')?.value;
 const title=$('ymMoneyFormTitle')?.value.trim().slice(0,90),accountId=$('ymMoneyFormAccount')?.value;
 const toAccountId=$('ymMoneyFormTo')?.value;
 if(!['expense','income','transfer'].includes(type)||amount===null||amount<=0||!safeDay(date)||!title)return errorMsg('اكتب وصفًا ومبلغًا صحيحًا أكبر من صفر وتاريخًا سليمًا.');
 if(!f.accounts.some(a=>a.id===accountId))return errorMsg('اختار حسابًا صحيحًا.');
 if(type==='transfer'&&(!f.accounts.some(a=>a.id===toAccountId)||accountId===toAccountId))return errorMsg('التحويل لازم يكون بين حسابين مختلفين.');
 const cat=type==='transfer'?null:$('ymMoneyFormCategory')?.value;
 if(type!=='transfer'&&!category(cat,type))return errorMsg('اختر تصنيفًا صحيحًا.');
 const old=f.transactions.find(t=>t.id===editing);
 const rec={...(old||{}),id:old?.id||newId(),date,type,title,amount,category:cat,
  accountId,toAccountId:type==='transfer'?toAccountId:null,note:$('ymMoneyFormNote')?.value.trim().slice(0,280)||'',
  createdAt:old?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
 if(old)Object.assign(old,rec);else f.transactions.push(rec);
 if(!save())return errorMsg('تعذر حفظ الحركة في حسابك. تأكد من الاتصال والمزامنة.');
 finish();api().notify?.('اتحفظت الحركة ✓');
}
function openAccount(accountId=null){
 activeForm='account';const f=ensure(),d=modal(),account=f.accounts.find(a=>a.id===accountId)||null;
 editing=account?.id||null;
 const current=account?balance(f,account.id):0;
 const icons=['💳','🏦','💵','📱','🧺'];
 $('ymMoneyDialogContent').innerHTML='<form id="ymMoneyAccountForm"><h2>'+(account?'تعديل حسابك ورصيده الحالي':'إضافة حساب أو محفظة')+'</h2>'+
 formField('اسم الحساب','<input id="ymMoneyAccountName" required maxlength="36" value="'+esc(account?.name||'')+'" placeholder="بنك، محفظة، نقدي">')+
 (account?
  formField('الرصيد الحالي المطلوب','<input id="ymMoneyAccountCurrent" inputmode="decimal" type="text" value="'+(current/100).toFixed(2)+'" required placeholder="0.00">')+
  '<p class="muted mini">الرصيد المسجّل حاليًا: '+mask(money(current,f.currency))+
  '. تغيير القيمة سيضيف تسوية بالفرق فقط. حركاتك السابقة والدخل والمصروف هتفضل كما هي.</p>':
  formField('الرصيد الافتتاحي','<input id="ymMoneyAccountOpening" inputmode="decimal" value="0" required placeholder="0.00">')+
  '<p class="muted mini">الرصيد الافتتاحي نقطة بداية لحسابك، ومش دخل جديد للشهر.</p>')+
 formField('رمز الحساب','<select id="ymMoneyAccountIcon">'+icons.map(icon=>'<option '+(account?.icon===icon?'selected':'')+'>'+icon+'</option>').join('')+'</select>')+
 '<p class="ym-money-form-error" id="ymMoneyFormError" role="alert"></p>'+
 '<div class="ym-money-modal-actions"><button class="btn" type="submit">'+(account?'حفظ التعديل':'إضافة الحساب')+'</button><button type="button" class="btn soft" data-money-close>إلغاء</button></div></form>';
 if(!d.open)d.showModal();
}
function saveAccount(){
 const f=ensure(),title=$('ymMoneyAccountName')?.value.trim().slice(0,36),account=f.accounts.find(a=>a.id===editing)||null;
 if(!title)return errorMsg('اكتب اسم الحساب.');
 if(f.accounts.some(a=>a.id!==account?.id&&a.name.trim().toLocaleLowerCase()===title.toLocaleLowerCase()))
  return errorMsg('اسم الحساب موجود بالفعل، اختار اسم مختلف.');
 const icon=$('ymMoneyAccountIcon')?.value||'💳';
 if(account){
  const desired=cleanSignedAmount($('ymMoneyAccountCurrent')?.value);
  if(desired===null)return errorMsg('اكتب الرصيد الحالي الصحيح. ممكن تستخدم قيمة سالبة لو فيه مديونية.');
  const before=balance(f,account.id),delta=desired-before;
  if(!Number.isSafeInteger(delta)||Math.abs(delta)>=100000000000)return errorMsg('المبلغ خارج الحدود المسموحة.');
  account.name=title;account.icon=icon;
  if(delta!==0)f.balanceAdjustments.push({id:newId(),accountId:account.id,date:today(),amount:delta,
   before,after:desired,createdAt:new Date().toISOString(),source:'manual_reconciliation'});
 }else{
  const opening=cleanAmount($('ymMoneyAccountOpening')?.value);
  if(opening===null)return errorMsg('اكتب الرصيد الافتتاحي الصحيح.');
  f.accounts.push({id:newId(),name:title,opening,icon});
 }
 if(!save())return errorMsg('تعذّر حفظ الحساب. راجع الاتصال والمزامنة.');
 finish();api().notify?.('تم تعديل الحساب والرصيد ✓');
}
function openBudget(){
 activeForm='budget';const f=ensure(),d=modal();
 $('ymMoneyDialogContent').innerHTML='<form id="ymMoneyBudgetForm"><h2>حدّد ميزانيتك الشهرية</h2><p class="muted mini">تقدر تغيّرها في أي وقت، والحد ده لا يسحب فلوس فعلية.</p>'+
 '<div class="ym-money-budget-form">'+[['__total','الميزانية الكلية'],...expenses.map(c=>[c[0],c[1]+' '+c[2]])].map(c=>
 '<label><span>'+esc(c[1])+'</span><input inputmode="decimal" type="text" data-budget-key="'+esc(c[0])+'" value="'+(clampCents(f.budgets[c[0]]||0)?(f.budgets[c[0]]/100).toFixed(2):'')+'" placeholder="بدون حد"></label>').join('')+'</div>'+
 '<p class="ym-money-form-error" id="ymMoneyFormError" role="alert"></p><div class="ym-money-modal-actions"><button type="submit" class="btn">حفظ الميزانية</button><button type="button" class="btn soft" data-money-close>إلغاء</button></div></form>';
 if(!d.open)d.showModal();
}
function saveBudget(){
 const f=ensure(),out={...f.budgets};
 for(const node of modal().querySelectorAll('[data-budget-key]')){
  const raw=node.value.trim();
  if(!raw){delete out[node.dataset.budgetKey];continue}
  const c=cleanAmount(raw);
  if(c===null)return errorMsg('قيمة غير صحيحة لتصنيف '+node.dataset.budgetKey);
  if(c===0)delete out[node.dataset.budgetKey];else out[node.dataset.budgetKey]=c;
 }
 f.budgets=out;if(!save())return errorMsg('تعذّر حفظ الميزانية.');finish();
}
function openGoal(id=null){
 activeForm='goal';editGoal=id;
 const f=ensure(),g=f.goals.find(x=>x.id===id),d=modal();
 $('ymMoneyDialogContent').innerHTML='<form id="ymMoneyGoalForm"><h2>'+(g?'تعديل هدف الادخار':'ابدأ هدف ادخار')+'</h2>'+
 formField('اسم الهدف','<input id="ymMoneyGoalTitle" required maxlength="65" value="'+esc(g?.title||'')+'" placeholder="صندوق الطوارئ / رحلة / جهاز">')+
 formField('المبلغ المستهدف','<input id="ymMoneyGoalTarget" inputmode="decimal" value="'+(g?(g.target/100).toFixed(2):'')+'" required>')+
 formField('وفّرت بالفعل','<input id="ymMoneyGoalSaved" inputmode="decimal" value="'+(g?(goalProgress(g)/100).toFixed(2):'0')+'" required>')+
 '<p class="ym-money-form-error" id="ymMoneyFormError" role="alert"></p><p class="muted mini">هذه متابعة بصرية فقط، لا تُخصم القيمة من حسابك. لتسجيل نقل مال فعلي، استخدم التحويل بين الحسابات.</p>'+
 '<div class="ym-money-modal-actions"><button class="btn" type="submit">حفظ الهدف</button>'+
 (g?'<button type="button" class="btn outline" data-money-goal-delete="'+esc(g.id)+'">حذف الهدف</button>':'')+
 '<button type="button" class="btn soft" data-money-close>إلغاء</button></div></form>';
 if(!d.open)d.showModal();
}
function saveGoal(){
 const f=ensure(),title=$('ymMoneyGoalTitle')?.value.trim().slice(0,65);
 const target=cleanAmount($('ymMoneyGoalTarget')?.value),saved=cleanAmount($('ymMoneyGoalSaved')?.value);
 if(!title||target===null||target<=0||saved===null)return errorMsg('راجع اسم الهدف والمبالغ.');
 const g=f.goals.find(x=>x.id===editGoal);
 if(g)Object.assign(g,{title,target,saved,updatedAt:new Date().toISOString()});
 else f.goals.push({id:newId(),title,target,saved,createdAt:new Date().toISOString()});
 if(!save())return errorMsg('تعذّر حفظ الهدف.');finish();
}
function openRecurring(){
 activeForm='recurring';const f=ensure(),d=modal();
 $('ymMoneyDialogContent').innerHTML='<form id="ymMoneyRecurringForm"><h2>دخل أو التزام شهري متكرر</h2><p class="muted mini">ستُعرض الحركة المتوقعة، ولن نسجّل مصروفًا أو دخلًا حتى تضغط تأكيد التسجيل.</p>'+
 formField('نوع الحركة','<select id="ymMoneyRecurringType"><option value="expense">مصروف شهري</option><option value="income">دخل شهري</option></select>')+
 formField('اسم التكرار','<input id="ymMoneyRecurringTitle" required maxlength="75" placeholder="مثال: الإيجار / فاتورة إنترنت / راتب">')+
 formField('المبلغ','<input id="ymMoneyRecurringAmount" inputmode="decimal" required>')+
 formField('اليوم من الشهر','<input id="ymMoneyRecurringDay" type="number" min="1" max="31" value="1" required>')+
 formField('التصنيف','<select id="ymMoneyRecurringCat">'+categoryOptions('expense')+'</select>')+
 formField('الحساب','<select id="ymMoneyRecurringAccount">'+f.accounts.map(a=>'<option value="'+esc(a.id)+'">'+esc(a.name)+'</option>').join('')+'</select>')+
 '<p class="ym-money-form-error" id="ymMoneyFormError" role="alert"></p>'+
 '<div class="ym-money-modal-actions"><button class="btn" type="submit">حفظ التكرار</button><button type="button" data-money-close class="btn soft">إلغاء</button></div></form>';
 if(!d.open)d.showModal();
}
function saveRecurring(){
 const f=ensure(),type=$('ymMoneyRecurringType')?.value,cat=$('ymMoneyRecurringCat')?.value;
 const title=$('ymMoneyRecurringTitle')?.value.trim().slice(0,75),amount=cleanAmount($('ymMoneyRecurringAmount')?.value),
 day=Number($('ymMoneyRecurringDay')?.value),accountId=$('ymMoneyRecurringAccount')?.value;
 if(!['income','expense'].includes(type)||!title||!amount||!Number.isInteger(day)||day<1||day>31||!category(cat,type)||!f.accounts.some(a=>a.id===accountId))
 return errorMsg('تأكد من الوصف والمبلغ واليوم والتصنيف والحساب.');
 f.recurring.push({id:newId(),type,title,amount,day,category:cat,accountId,createdAt:new Date().toISOString()});
 if(!save())return errorMsg('تعذّر الحفظ.');finish();
}
function logRecurring(id){
 const f=ensure(),r=f.recurring.find(x=>x.id===id);
 if(!r||f.transactions.some(t=>t.recurringId===id&&monthOf(t.date)===shownMonth))return;
 const due=dueDay(shownMonth,r.day);
 if(due>today()){api().notify?.('هذا موعد مستقبلي؛ يمكنك تسجيله يوم الاستحقاق.');return}
 if(!confirm('تسجيل '+r.title+' بقيمة '+money(r.amount,f.currency)+' بتاريخ '+due+'؟'))return;
 f.transactions.push({id:newId(),type:r.type,title:r.title,amount:r.amount,date:due,
  accountId:r.accountId,toAccountId:null,category:r.category,recurringId:id,
  note:'مسجل من التكرار الشهري',createdAt:new Date().toISOString()});
 if(!save())return;render();
}
function deleteTransaction(id){
 const f=ensure(),x=f.transactions.find(v=>v.id===id);
 if(!x||!confirm('حذف حركة «'+x.title+'»؟ هيتم تصحيح الرصيد والإحصائيات تلقائيًا.'))return;
 f.transactions=f.transactions.filter(v=>v.id!==id);if(save())render();
}
function exportCsv(){
 const f=ensure();csvDownload('YAWMI_MONEY_'+today()+'.csv',[
 ['التاريخ','النوع','الوصف','التصنيف','المبلغ','العملة','من الحساب','إلى الحساب','ملاحظة'],
 ...f.transactions.slice().sort((a,b)=>a.date.localeCompare(b.date)).map(x=>[
 x.date,labels[x.type]||x.type,x.title,x.type==='transfer'?'تحويل':catName(x.category,x.type),
 (x.amount/100).toFixed(2),f.currency,f.accounts.find(a=>a.id===x.accountId)?.name||'',
 f.accounts.find(a=>a.id===x.toAccountId)?.name||'',x.note||''
 ]),
 ...f.balanceAdjustments.map(a=>[a.date,'تسوية رصيد','تعديل الرصيد الحالي','تسوية ليست دخلًا أو مصروفًا',
 (a.amount/100).toFixed(2),f.currency,f.accounts.find(x=>x.id===a.accountId)?.name||'', '',
 'الرصيد قبل التسوية: '+(a.before/100).toFixed(2)+'؛ بعد التسوية: '+(a.after/100).toFixed(2)
 ])]);}
function init(){
 if(!$('ymMoneyApp'))return;
 document.addEventListener('click',e=>{
 const b=e.target.closest?.('button');if(!b)return;
 if(b.hasAttribute('data-money-close')){modal().close();return}
 if(b.hasAttribute('data-money-prev'))return changeMonth(-1);
 if(b.hasAttribute('data-money-next'))return changeMonth(1);
 if(b.hasAttribute('data-money-hide')){isHidden=!isHidden;render();return}
 if(b.hasAttribute('data-money-add'))return openTransaction(b.dataset.moneyAdd);
 if(b.hasAttribute('data-money-edit'))return openTransaction('expense',b.dataset.moneyEdit);
 if(b.hasAttribute('data-money-delete'))return deleteTransaction(b.dataset.moneyDelete);
 if(b.hasAttribute('data-money-export'))return exportCsv();
 if(b.hasAttribute('data-money-account'))return openAccount();
 if(b.hasAttribute('data-money-account-edit'))return openAccount(b.dataset.moneyAccountEdit);
 if(b.hasAttribute('data-money-budget'))return openBudget();
 if(b.hasAttribute('data-money-goal'))return openGoal();
 if(b.hasAttribute('data-money-goal-edit'))return openGoal(b.dataset.moneyGoalEdit);
 if(b.hasAttribute('data-money-goal-contribute')){
  const f=ensure(),g=f.goals.find(x=>x.id===b.dataset.moneyGoalContribute);if(!g)return;
  const answer=prompt('كم وفّرت لهدف «'+g.title+'»؟ (تسجيل متابعة فقط، وليس خصمًا من حسابك)','0');
  if(answer===null)return;const c=cleanAmount(answer);
  if(c===null||c<=0)return api().notify?.('اكتب مبلغًا صحيحًا.');
  g.saved=goalProgress(g)+c;if(save())render();return
 }
 if(b.hasAttribute('data-money-goal-delete')){
  const f=ensure();if(!confirm('حذف هدف الادخار؟ هذا لن يغيّر حساباتك أو معاملاتك.'))return;
  f.goals=f.goals.filter(x=>x.id!==b.dataset.moneyGoalDelete);if(save())finish();return
 }
 if(b.hasAttribute('data-money-recurring'))return openRecurring();
 if(b.hasAttribute('data-money-remove-recurring')){
  const f=ensure();if(!confirm('إزالة التكرار الشهري؟ الحركات المسجلة سابقًا ستبقى كما هي.'))return;
  f.recurring=f.recurring.filter(r=>r.id!==b.dataset.moneyRemoveRecurring);if(save())render();return
 }
 if(b.hasAttribute('data-money-log-recurring'))return logRecurring(b.dataset.moneyLogRecurring);
 });
 document.addEventListener('change',e=>{
  const id=e.target?.id;
  if(id==='ymMoneyMonth'&&/^\d{4}-\d{2}$/.test(e.target.value)){shownMonth=e.target.value;render()}
  if(id==='ymMoneyTypeFilter'){typeFilter=e.target.value;refreshList()}
  if(id==='ymMoneyCategoryFilter'){categoryFilter=e.target.value;refreshList()}
  if(id==='ymMoneyAccountFilter'){accountFilter=e.target.value;refreshList()}
  if(id==='ymMoneyCurrency'){
   const f=ensure(),val=e.target.value;
   if(!currencies.includes(val))return;
   const hasData=f.transactions.length||f.accounts.some(a=>a.opening)||f.goals.some(g=>g.target||g.saved);
   if(hasData&&!confirm('تغيير العملة هيغيّر شكل الأرقام فقط، ومش هيحوّل المبالغ بسعر صرف. عايز تكمل؟')){render();return}
   f.currency=val;if(save())render();
  }
  if(id==='ymMoneyFormType')updateFormType();
  if(id==='ymMoneyRecurringType'){const c=$('ymMoneyRecurringCat');if(c)c.innerHTML=categoryOptions(e.target.value)}
 });
 document.addEventListener('input',e=>{if(e.target?.id==='ymMoneySearch'){searchTerm=e.target.value;refreshList()}});
 document.addEventListener('submit',e=>{
 const id=e.target?.id;
 if(!['ymMoneyForm','ymMoneyBudgetForm','ymMoneyAccountForm','ymMoneyGoalForm','ymMoneyRecurringForm'].includes(id))return;
 e.preventDefault();
 if(id==='ymMoneyForm')saveTransaction();
 if(id==='ymMoneyBudgetForm')saveBudget();
 if(id==='ymMoneyAccountForm')saveAccount();
 if(id==='ymMoneyGoalForm')saveGoal();
 if(id==='ymMoneyRecurringForm')saveRecurring();
 });
}
window.YawmiMoney={render,totals,balance,cleanAmount,cleanSignedAmount,categoryChart,goalProgress,getState:()=>ensure()};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();