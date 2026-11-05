const {test,expect}=require('@playwright/test');
test('standalone reminders are gone from all skins and section organizer but existing records remain in calendar',async({page})=>{
 for(const skin of ['01_ATLAS_Executive.html','02_JOURNAL_Editorial.html','03_QUEST_RPG.html']){
  await page.goto('/'+skin,{waitUntil:'domcontentloaded'});
  await expect(page.locator('#page-reminders')).toHaveCount(0);
  await expect(page.locator('[data-tab="reminders"],#yawmiMenuDrawer [data-yam-action="reminders"]')).toHaveCount(0);
  await expect(page.locator('#page-calendar')).toHaveCount(1);
  await expect(page.locator('#ymLifeCalendar')).toHaveCount(1);
  expect(await page.evaluate(()=>window.YawmiNavigation?.sections.some(x=>x.id==='reminders'))).toBe(false);
 }
});
test('calendar manages new and legacy reminders without another section or XP',async({page})=>{
 await page.goto('/tests/life-v33.html');
 await expect(page.locator('#ymLifeCalendar [data-life-rem-new]')).toHaveCount(1);
 await page.locator('#ymLifeCalendar [data-life-rem-new]').click();
 await page.locator('#ylRemTitle').fill('موعد مهم من التقويم');
 await page.locator('#ylRemTime').fill('11:20');
 await page.locator('#ylReminderForm button[type=submit]').click();
 await expect(page.locator('#ymLifeCalendar')).toContainText('موعد مهم من التقويم');
 const state=await page.evaluate(()=>({rem:window.__appState.lifeReminders,xp:window.YawmiExtraAPI.getScores().xp}));
 expect(state.rem).toHaveLength(1);expect(state.xp).toBe(400);
 await page.locator('#ymLifeCalendar [data-life-open-reminder]').first().click();
 await expect(page.locator('#ylRemTitle')).toHaveValue('موعد مهم من التقويم');
});
test('Google Calendar displays honest setup status without client ID and exports valid ICS',async({page})=>{
 await page.goto('/tests/life-v33.html');
 await expect(page.locator('#ymGoogleCalendarControls')).toContainText('OAuth Client ID');
 await expect(page.locator('[data-google-connect]')).toHaveCount(0);
 await page.locator('#ymLifeCalendar [data-life-event-new]').first().click();
 await page.locator('#ylEventTitle').fill('موعد في يومي');
 await page.locator('#ylEventTime').fill('11:30');
 await page.locator('#ylEventForm button[type=submit]').click();
 const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#ymGoogleCalendarControls [data-google-ics]').click()]);
 expect(download.suggestedFilename()).toBe('yawmi-calendar.ics');
 const content=await page.evaluate(async()=>{
  const data=window.__appState.lifeCalendar[0];
  return {title:data.title,exported:Boolean(window.YawmiGoogleCalendar?.exportIcs)};
 });
 expect(content).toEqual({title:'موعد في يومي',exported:true});
});
test('background push UI clearly requires login and service worker has push and notificationclick handlers',async({page})=>{
 await page.goto('/tests/life-v33.html');
 await expect(page.locator('#ymPushControls')).toContainText('إشعارات الهاتف في الخلفية');
 await page.locator('#ymPushControls [data-push-enable]').click();
 await expect(page.locator('#ymPushControls')).toContainText('سجّل الدخول');
 const source=await page.evaluate(async()=>await fetch('/sw.js').then(r=>r.text()));
 expect(source).toContain("self.addEventListener('push'");
 expect(source).toContain("self.addEventListener('notificationclick'");
});
