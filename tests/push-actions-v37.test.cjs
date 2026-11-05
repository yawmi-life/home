const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function setup(){
 const win={};const document={readyState:'loading',addEventListener(){}};
 const context={window:win,document,Date,Set,Array,String,RegExp,Number,console,Math};
 vm.runInNewContext(fs.readFileSync('yawmi-push-actions-v37.js','utf8'),context);
 return win.YawmiPushActions;
}
const key='reminder:rem123:2026-11-05:09:30:10';
test('notification action keys parse with exact id and optional snooze wrapper',()=>{
 const m=setup();const result=m.parseKey(key);
 assert.equal(result.key,key);assert.equal(result.id,'rem123');
 assert.equal(result.type,'reminder');assert.equal(result.time,'09:30');assert.equal(result.lead,10);
 assert.equal(m.parseKey('snooze:'+key+':1793860000000').key,key);
 assert.equal(m.parseKey('bill:private-key:2026-11-05'),null);
 assert.equal(m.parseKey('reminder:bad:2026-11-05:99:01:1'),null);
});
test('ten-minute and next-day deferrals are deterministic and non-scoring',()=>{
 const m=setup(),now=new Date('2026-11-05T12:00:00.000Z');
 assert.equal(m.schedule(key,'snooze10',now).at,'2026-11-05T12:10:00.000Z');
 assert.equal(m.schedule(key,'tomorrow',now).at,'2026-11-06T12:00:00.000Z');
 assert.equal(m.schedule(key,'unknown',now),null);
});
test('dismissed push only mutes this reminder instance without deleting it or awarding XP',()=>{
 const m=setup(),rem={id:'rem123',date:'2026-11-05',time:'09:30',title:'خاص',lead:10};
 const state={lifeReminders:[rem],lifeCalendar:[],lifeNotificationSnoozes:[],xp:250};
 const result=m.applyAction(state,m.parseKey(key),'done');
 assert.equal(result.ok,true);assert.equal(state.xp,250);
 assert.equal(state.lifeReminders[0],rem);assert.equal(rem.done,undefined);
 assert.equal(state.lifeNotificationDismissed.length,1);assert.equal(state.lifeNotificationDismissed[0],key);
 result.rollback();
 assert.equal(state.lifeNotificationDismissed,undefined);
});
test('snooze updates only the technical reminder scheduling record and can roll back',()=>{
 const m=setup(),s={lifeReminders:[{id:'rem123',date:'2026-11-05',time:'09:30',title:'خاص'}],lifeCalendar:[],xp:100};
 const result=m.applyAction(s,m.parseKey(key),'snooze10',new Date('2026-11-05T12:00:00Z'));
 assert.equal(result.ok,true);assert.equal(s.lifeNotificationSnoozes.length,1);
 assert.equal(s.lifeNotificationSnoozes[0].at,'2026-11-05T12:10:00.000Z');
 assert.equal(s.lifeReminders[0].time,'09:30');assert.equal(s.xp,100);
 result.rollback();assert.equal(s.lifeNotificationSnoozes,undefined);
});
test('mismatched reminder metadata never mutates the account',()=>{
 const m=setup(),s={lifeReminders:[{id:'rem123',date:'2026-11-06',time:'09:30'}],lifeCalendar:[]};
 const result=m.applyAction(s,m.parseKey(key),'done');assert.equal(result.ok,false);
 assert.equal(s.lifeNotificationDismissed,undefined);
});
