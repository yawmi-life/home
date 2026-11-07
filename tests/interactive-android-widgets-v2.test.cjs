const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
test('eleven real Android widgets include task habit finance and report providers',()=>{
 const manifest=read('android/app/src/main/AndroidManifest.xml');
 assert.equal((manifest.match(/android\.appwidget\.provider/g)||[]).length,11);
 for(const key of ['YawmiCategoryWidget$Tasks','YawmiCategoryWidget$Habits',
  'YawmiCategoryWidget$Finance','YawmiCategoryWidget$Reports'])
  assert.ok(manifest.includes(key),key);
 const java=read('android/app/src/main/java/com/yawmilife/app/YawmiCategoryWidget.java');
 assert.match(java,/complete-task/);
 assert.match(java,/complete-habit/);
 assert.match(java,/add-expense/);
 assert.match(java,/add-income/);
});
test('launcher state is bounded and stays private to the Android app',()=>{
 const data=read('android/app/src/main/java/com/yawmilife/app/YawmiWidgetData.java');
 const bridge=read('yawmi-widget-actions-v2.js');
 assert.match(data,/private_launcher_snapshot_v3/);
 assert.match(data,/acceptLocal/);
 assert.match(data,/replaceAll/);
 assert.match(bridge,/ownerHash/);
 assert.match(bridge,/yawmiwidgetdata:\/\//);
 assert.doesNotMatch(bridge,/service_role|access_token|\.auth\.getSession/);
});
test('native Android reminder scheduling is connected to app saves',()=>{
 const alerts=read('yawmi-android-alerts-v1.js');
 const core=read('yawmi-life-core-v33.js');
 assert.match(alerts,/setTimeout\(\(\)=>sync\(true\),300\)/);
 assert.match(alerts,/scheduleInfo/);
 assert.match(core,/YawmiAndroidAlerts\.enable/);
 assert.match(core,/data-life-notify-test/);
});
test('pinned header and phone safe areas are explicitly handled',()=>{
 assert.match(read('mobile-fix.css'),/position:sticky!important/);
 assert.match(read('mobile-fix.css'),/bottom:calc\(3px/);
 assert.match(read('android/app/src/main/java/com/yawmilife/app/YawmiMainActivity.java'),
  /WindowInsets\.Type\.systemBars/);
});
function runWidgetAction(done){
 const js=read('yawmi-widget-actions-v2.js');
 const invoked={task:0,removed:0};
 const day='2026-11-07';
 const task={id:'t1',title:'مراجعة التقرير',date:day,repeat:'once'};
 const state={demo:false,daily:{[day]:{tasks:done?{t1:true}:{}}},finance:{transactions:[]}};
 const main={
  getState:()=>state,today:()=>day,
  getSummary:()=>({tasks:[task],habits:[],taskDone:Number(done),habitDone:0,pct:0}),
  getScores:()=>({xp:0}),getLevelInfo:()=>({level:1}),getStreak:()=>0,
  goPage:page=>{invoked.page=page},
  save:()=>true
 };
 const location={href:'https://yawmi-life.github.io/home/01_ATLAS_Executive.html?source=widget&widgetAction=complete-task&widgetItem=t1'};
 const window={YawmiExtraAPI:main,YawmiCloud:{configured:true,ready:true,conflict:false,currentUser:{id:'user1'}},
  YawmiLife:null,addEventListener:()=>{}};
 const document={readyState:'complete',hidden:false,addEventListener:()=>{},
  getElementById:()=>({click:()=>{}}),querySelectorAll:()=>[{dataset:{id:'t1'},click:()=>{invoked.task++}}]};
 const history={state:null,replaceState:()=>{invoked.removed++}};
 vm.runInNewContext(js,{window,navigator:{userAgent:'Android YawmiAndroid/1.6'},document,
   location,URL,history,crypto:{subtle:{digest:async()=>new Uint8Array(32).buffer}},
   TextEncoder,setInterval:()=>0,setTimeout:()=>0,console},{timeout:1000});
 return invoked;
}
test('one launcher tap completes a pending task through the existing UI handler',()=>{
 const result=runWidgetAction(false);
 assert.equal(result.task,1);
 assert.equal(result.page,'tasks');
 assert.equal(result.removed,1);
});
test('a stale widget never unchecks a task already completed elsewhere',()=>{
 const result=runWidgetAction(true);
 assert.equal(result.task,0);
});

test('external URLs cannot forge widget completion actions without Android private nonce',()=>{
 const main=read('android/app/src/main/java/com/yawmilife/app/YawmiMainActivity.java');
 const data=read('android/app/src/main/java/com/yawmilife/app/YawmiWidgetData.java');
 const cat=read('android/app/src/main/java/com/yawmilife/app/YawmiCategoryWidget.java');
 const shortcut=read('android/app/src/main/java/com/yawmilife/app/YawmiShortcutWidget.java');
 assert.match(data,/java\.security\.SecureRandom/);
 assert.match(main,/launcherNonce\(this\)/);
 assert.match(main,/widgetAction/);
 assert.match(main,/clearQuery\(\)/);
 assert.match(cat,/putExtra\("yawmi_widget_nonce"/);
 assert.match(shortcut,/putExtra\("yawmi_widget_nonce"/);
});
