const {test,expect}=require('@playwright/test');
test('notification Snooze 10m is saved for the authenticated account and leaves XP unchanged',async({page})=>{
 await page.goto('/tests/life-v36.html');
 await page.evaluate(()=>{
  window.__state.lifeReminders.push({id:'rQA',date:'2026-11-05',time:'11:20',title:'تذكير خاص',repeat:'none'});
  history.replaceState(null,'','?source=push&quick=calendar&push_action=snooze10&push_key=reminder%3ArQA%3A2026-11-05%3A11%3A20%3A0');
  window.YawmiPushActions.process();
 });
 const v=await page.evaluate(()=>({snoozes:window.__state.lifeNotificationSnoozes,notices:window.__notices,view:window.__view,xp:window.YawmiExtraAPI.getScores().xp,query:location.search}));
 expect(v.snoozes).toHaveLength(1);
 expect(v.snoozes[0].originalKey).toBe('reminder:rQA:2026-11-05:11:20:0');
 expect(v.view).toBe('calendar');
 expect(v.xp).toBe(155);
 expect(v.query).not.toContain('push_action');
 await page.reload();
 expect(await page.evaluate(()=>window.__state.lifeNotificationSnoozes.length)).toBe(1);
});
test('Done action is confirmed in the app, mutes only one occurrence and never marks real tasks as completed',async({page})=>{
 await page.goto('/tests/life-v36.html');
 page.on('dialog',dialog=>dialog.accept());
 await page.evaluate(()=>{
  window.__state.lifeCalendar.push({id:'eQA',date:'2026-11-05',time:'10:15',title:'حدث عادي',remind:'10'});
  history.replaceState(null,'','?source=push&push_action=done&push_key=calendar%3AeQA%3A2026-11-05%3A10%3A15%3A10');
  window.YawmiPushActions.process();
 });
 const v=await page.evaluate(()=>({dismissed:window.__state.lifeNotificationDismissed,calendar:window.__state.lifeCalendar.find(e=>e.id==='eQA'),tasks:window.__state.daily,xp:window.YawmiExtraAPI.getScores().xp}));
 expect(v.dismissed).toContain('calendar:eQA:2026-11-05:10:15:10');
 expect(v.calendar.remind).toBe('10');
 expect(v.calendar.title).toBe('حدث عادي');
 expect(v.tasks['2026-11-05']).toBeUndefined();
 expect(v.xp).toBe(155);
});
test('a forged, missing or stale reminder key cannot mutate user data',async({page})=>{
 await page.goto('/tests/life-v36.html');
 await page.evaluate(()=>{
  history.replaceState(null,'','?push_action=tomorrow&push_key=reminder%3Aunknown%3A2026-11-05%3A10%3A15%3A0');
  window.YawmiPushActions.process();
 });
 expect(await page.evaluate(()=>window.__state.lifeNotificationSnoozes)).toBeUndefined();
});
