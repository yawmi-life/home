const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function load(name,initial){
 const state=initial||{finance:null,journalEntries:[],journalDraft:null};
 const ctx={window:{YawmiExtraAPI:{getState:()=>state,save:()=>true,today:()=>new Date().toISOString().slice(0,7)+'-05',uid:()=>Math.random().toString(36)}},
 document:{readyState:'loading',addEventListener(){}},navigator:{onLine:true},
 setTimeout(){},clearTimeout(){},setInterval(){},clearInterval(){},
 structuredClone:globalThis.structuredClone,Intl,Date,Math,Number,Array,String,JSON,RegExp};
 vm.runInNewContext(fs.readFileSync(name,'utf8'),ctx,{filename:name});
 return {module:name.includes('money')?ctx.window.YawmiMoney:ctx.window.YawmiDiary,state};
}
test('income, expenses and transfers never double count gross income or expense',()=>{
 const s={finance:{currency:'SAR',
 accounts:[{id:'cash',opening:10000,name:'Cash'},{id:'bank',opening:5000,name:'Bank'}],
 transactions:[
 {id:'1',date:'2026-11-05',type:'income',amount:100000,accountId:'cash',category:'salary'},
 {id:'2',date:'2026-11-05',type:'expense',amount:25000,accountId:'cash',category:'groceries'},
 {id:'3',date:'2026-11-05',type:'transfer',amount:7000,accountId:'cash',toAccountId:'bank'}
 ],budgets:{},goals:[],recurring:[]}};
 const {module:m}=load('yawmi-money-v32.js',s);
 const v=m.totals(s.finance,'2026-11');
 assert.equal(v.income,100000);assert.equal(v.expense,25000);assert.equal(v.transfers,1);
 assert.equal(m.balance(s.finance,'cash'),78000);
 assert.equal(m.balance(s.finance,'bank'),12000);
 assert.equal(m.balance(s.finance,'cash')+m.balance(s.finance,'bank'),90000);
});
test('money amount sanitization, clean defaults and savings progress',()=>{
 const {module:m,state:s}=load('yawmi-money-v32.js');
 assert.equal(m.cleanAmount('120.25'),12025);
 assert.equal(m.cleanAmount('10,75'),1075);
 assert.equal(m.cleanAmount('-5'),null);
 assert.equal(m.cleanAmount('Infinity'),null);
 assert.equal(m.cleanAmount('120.999'),null);
 assert.equal(m.getState().accounts.length,3);
 assert.equal(m.goalProgress({saved:15050}),15050);
 assert.equal(s.finance.transactions.length,0);
});
test('journal tags, empty history and word counter are independent from XP',()=>{
 const s={journalEntries:[],journalDraft:null};const {module:m}=load('yawmi-diary-v32.js',s);
 const tags=m.normalizeTags('سفر، راحة, سفر ، قراية');
 assert.equal(tags.join('|'),'سفر|راحة|قراية');
 assert.equal(m.countWords('النهاردة يوم جميل'),3);
 assert.equal(m.summarize().all,0);
});
test('journal streak and this-day memories use saved entries only',()=>{
 const month=new Date().toISOString().slice(0,7),d=month+'-05',prev=month+'-04',year=Number(month.slice(0,4));
 const s={journalEntries:[
  {id:'e1',date:d,body:'حاجة جميلة حصلت',mood:4,title:'اليوم'},
  {id:'e2',date:prev,body:'يوم هادي',mood:5,title:'امبارح'},
  {id:'e3',date:String(year-1)+d.slice(4),body:'ذكرى قديمة',mood:3,title:'سنة فاتت'}
 ]};
 const {module:m}=load('yawmi-diary-v32.js',s);const sum=m.summarize();
 assert.equal(sum.streak,2);assert.equal(sum.memories.length,1);assert.equal(sum.monthEntries,2);
 assert.equal(sum.avg,4.5);
});
