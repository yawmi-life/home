const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {webcrypto}=require('node:crypto');
const f=n=>fs.readFileSync(n,'utf8');
function boot(state){
 const base={version:7,tasks:[],habits:[],daily:{},goals:[],finance:{currency:'SAR',accounts:[],transactions:[],recurring:[],budgets:{}},...state};
 const doc={readyState:'loading',addEventListener(){},hidden:false,
  getElementById(){return null},querySelector(){return null}};
 const w={YawmiExtraAPI:{getState:()=>base,today:()=>new Date().toISOString().slice(0,7)+'-05',uid:()=>Math.random().toString(36),save:()=>true},
 crypto:webcrypto,isSecureContext:true,addEventListener(){},setInterval(){},Notification:undefined};
 const ctx={window:w,document:doc,navigator:{},Intl,Date,Math,String,Number,Array,JSON,RegExp,Map,Set,TextEncoder,Uint8Array,Promise,structuredClone,atob,btoa,setTimeout(){},clearTimeout(){},confirm:()=>true};
 for(const file of ['yawmi-life-core-v33.js','yawmi-life-growth-v33.js','yawmi-life-privacy-v33.js'])vm.runInNewContext(f(file),ctx,{filename:file});
 return {L:w.YawmiLife,G:w.YawmiLifeGrowth,P:w.YawmiLifePrivacy,s:base};
}
test('unified calendar reads original tasks, habits, events and recurring bills without mutating XP',()=>{
 const {L,s}=boot({tasks:[{id:'t',title:'مهمة يومية',repeat:'daily',date:'2026-01-01'}],
 habits:[{id:'h',title:'عادة يومية',repeat:'daily',target:1}],
 finance:{transactions:[],recurring:[{id:'rent',title:'إيجار',day:5}]}});
 L.state();s.lifeCalendar.push({id:'evt',title:'مقابلة',date:'2026-11-05',time:'09:00'});
 const rows=L.itemsOn('2026-11-05');
 assert.ok(rows.some(x=>x.source==='task'&&x.title==='مهمة يومية'));
 assert.ok(rows.some(x=>x.source==='habit'));
 assert.ok(rows.some(x=>x.source==='event'));
 assert.ok(rows.some(x=>x.source==='bill'));
 assert.deepEqual(s.daily,{});
});
test('yearly events appear only on the right anniversary, recurring weekdays respect KSA weekend',()=>{
 const {L,s}=boot({lifeCalendar:[{id:'a',title:'عيد ميلاد',date:'2024-11-05',repeat:'yearly'}],
 tasks:[{id:'wk',title:'أيام العمل',date:'2026-01-01',repeat:'weekdays'}]});
 assert.equal(L.itemsOn('2026-11-05').some(x=>x.title==='عيد ميلاد'),true);
 assert.equal(L.itemsOn('2026-11-06').some(x=>x.title==='عيد ميلاد'),false);
 assert.equal(L.taskActive(s.tasks[0],'2026-11-06'),false);
 assert.equal(L.taskActive(s.tasks[0],'2026-11-07'),false);
});
test('health tracker stats and weekly coach do not create activity points',()=>{
 const {G,s}=boot({lifeHealth:[{id:'h',date:new Date().toISOString().slice(0,7)+'-05',steps:7500,exerciseMin:40,sleepMin:450,energy:4}]});
 const h=G.healthStats();
 assert.equal(h.stepTotal,7500);assert.equal(h.exerciseTotal,40);assert.equal(h.avgSleep,450);
 const f=G.dashboardFacts();assert.equal(f.healthDays,1);
 assert.equal(s.daily&&Object.keys(s.daily).length,0);
});
test('routine progress and 90-day plan checks use separate IDs, not existing habit XP',()=>{
 const {G,s}=boot({lifeRoutines:[{id:'r',title:'صباحي',steps:[{id:'a',title:'صلاة'},{id:'b',title:'قراءة',habitId:'reading'}]}],
 lifeRoutineChecks:[{id:'c',routineId:'r',date:new Date().toISOString().slice(0,7)+'-05',done:['b']}]});
 const p=G.routineProgress(s.lifeRoutines[0],new Date().toISOString().slice(0,7)+'-05');
 assert.equal(p.done,1);assert.equal(p.total,2);assert.equal(p.pct,50);
 assert.deepEqual(s.daily,{});
});
test('PIN hashing uses distinct salts and leaves plaintext PIN out of output',async()=>{
 const {P}=boot();
 const a=btoa(String.fromCharCode(...new Uint8Array(16).fill(1)));
 const b=btoa(String.fromCharCode(...new Uint8Array(16).fill(2)));
 const one=await P.hashPin('468751',a,120000);
 const two=await P.hashPin('468751',b,120000);
 assert.equal(one.length,64);assert.notEqual(one,two);assert.equal(one.includes('468751'),false);
});
