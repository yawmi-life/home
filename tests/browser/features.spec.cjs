const {test,expect}=require('@playwright/test');
const AxeBuilder=require('@axe-core/playwright').default;

test('leaderboard is always visible and never exposes friend code',async({page})=>{
 await page.goto('/tests/fixture.html');
 await expect(page.getByRole('heading',{name:'ساحة المنافسة'})).toBeVisible();
 await expect(page.locator('.ym-league-person')).toHaveCount(2);
 await expect(page.locator('#ymSeasonPanel')).not.toContainText('YM-SECRET_NOT_PUBLIC');
 await expect(page.locator('#ymSeasonPanel')).not.toContainText('YM-XXXXXXXXXX');
 await expect(page.getByText('إظهار اسمي ونقاطي')).toHaveCount(0);
 await page.getByText('اسمي وكود إضافة الأصدقاء').click();
 await expect(page.getByText('••••••••')).toBeVisible();
 await page.getByRole('button',{name:'إظهار كودي'}).click();
 await expect(page.locator('#ymPrivateCode')).toHaveText('YM-SECRET_NOT_PUBLIC');
 await expect(page.locator('.ym-league-list')).not.toContainText('YM-SECRET_NOT_PUBLIC');
});

test('habit strength and monthly heatmap render without XP changes',async({page})=>{
 await page.goto('/tests/fixture.html');
 await expect(page.getByRole('heading',{name:'قوة العادة'})).toBeVisible();
 await expect(page.locator('.ym-habit-day')).toHaveCount(30);
 await expect(page.locator('.ym-habit-insight-grid')).toContainText('93%');
 await expect(page.locator('.ym-habit-insight-grid')).toContainText('28 / 30');
 await expect(page.locator('.ym-habit-insights')).toContainText('لا تضيف XP');
});

test('friend challenge created only with private accepted friendship token',async({page})=>{
 await page.goto('/tests/fixture.html');
 await expect(page.getByRole('heading',{name:'تحديات الأصدقاء'})).toBeVisible();
 await page.getByRole('button',{name:'إرسال التحدي'}).click();
 await expect(page.locator('.ym-challenge-card')).toHaveCount(1);
 const calls=await page.evaluate(()=>window.__fixtureCalls.filter(x=>x.name==='yawmi_challenge_create'));
 expect(calls).toHaveLength(1);
 expect(calls[0].args.p_friend_ref).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
 expect(calls[0].args).not.toHaveProperty('user_id');
});

test('all three app skins contain analytics and social sections',async({page})=>{
 for(const file of ['01_ATLAS_Executive.html','02_JOURNAL_Editorial.html','03_QUEST_RPG.html']){
  await page.goto('/'+file,{waitUntil:'domcontentloaded'});
  await expect(page.locator('#ymHabitInsights')).toHaveCount(1);
  await expect(page.locator('#ymChallengesPanel')).toHaveCount(1);
  await expect(page.locator('#ymSeasonPanel')).toHaveCount(1);
  await expect(page.locator('#ymHistoryPanel')).toHaveCount(0);
 }
});

test('isolated fixture has no severe accessibility violations',async({page})=>{
 await page.goto('/tests/fixture.html');
 const results=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze();
 expect(results.violations.filter(v=>v.impact==='critical'||v.impact==='serious')).toEqual([]);
});

test('PWA static shell reloads offline after successful service worker activation',async({page,context})=>{
 await page.goto('/01_ATLAS_Executive.html',{waitUntil:'domcontentloaded'});
 await page.evaluate(async()=>{const r=await navigator.serviceWorker.register('./sw.js');await navigator.serviceWorker.ready;return r.scope});
 await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller),null,{timeout:30000});
 await context.setOffline(true);
 try{
  await page.reload({waitUntil:'domcontentloaded',timeout:20000});
  await expect(page.locator('#ymHabitInsights')).toHaveCount(1);
 }finally{await context.setOffline(false)}
});
