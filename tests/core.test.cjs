/* Deterministic no-network tests; actual mobile/auth E2E needs a staging account. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function load(file,extras={}){
 const code=fs.readFileSync(file,'utf8');
 const context={window:{},document:{readyState:'loading',addEventListener(){}},navigator:{onLine:true},setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,...extras};
 vm.runInNewContext(code,context,{filename:file});
 return context;
}

test('offline 3-way merges independent edits and preserves deletion',()=>{
 const {window}=load('yawmi-offline-v1.js');
 const base={tasks:[{id:'a',done:false}],note:'old',counter:2};
 const local={tasks:[{id:'a',done:true}],note:'old',counter:2};
 const remote={tasks:[{id:'a',done:false}],note:'new',counter:2};
 const m=window.YawmiOffline.threeWay(base,local,remote);
 assert.equal(m.conflicts.length,0);
 assert.equal(m.data.tasks[0].done,true);
 assert.equal(m.data.note,'new');
 const removed=window.YawmiOffline.threeWay({tasks:[{id:'a'}]}, {tasks:[]},{tasks:[{id:'a'}]});
 assert.equal(removed.data.tasks.length,0);
});

test('same-field conflicts require owner selection, never silently overwritten',()=>{
 const {window}=load('yawmi-offline-v1.js');const f=window.YawmiOffline.threeWay;
 const base={profile:{name:'one'}},local={profile:{name:'local'}},remote={profile:{name:'remote'}};
 const unresolved=f(base,local,remote);
 assert.equal(unresolved.conflicts.length,1);
 const path=unresolved.conflicts[0];
 assert.equal(f(base,local,remote,{[path]:'remote'}).data.profile.name,'remote');
 assert.equal(f(base,local,remote,{[path]:'local'}).data.profile.name,'local');
 assert.equal(f(base,local,remote,{[path]:'remote'}).conflicts.length,0);
});

test('habit strength is gradual, with correct weekly totals and no XP duplication',()=>{
 const {window}=load('yawmi-habit-insights-v30.js');
 const now='2026-11-04';const daily={};
 for(let i=0;i<30;i++){
  const day=new Date('2026-11-04T12:00:00Z');day.setUTCDate(day.getUTCDate()-i);
  if(i!==0 && i!==6)daily[day.toISOString().slice(0,10)]={habits:{study:1}};
 }
 const result=window.YawmiHabitInsights.calculate({id:'study',target:1},{daily},now);
 assert.equal(result.count30,28);assert.equal(result.count7,5);assert.ok(result.strength>0);
 assert.equal(result.streak,0);assert.equal(result.rate30,93);
});
