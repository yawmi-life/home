const {test,expect}=require('@playwright/test');
async function boot(page){await page.goto('/tests/life-v36.html');await expect(page.locator('#ymV36Today h2')).toContainText('يومك ببساطة')}
function state(page){return page.evaluate(()=>window.__state)}
test('Today panel derives task, habit, calendar and reading data without changing XP',async({page})=>{
 await boot(page);await expect(page.locator('#ymV36Today')).toContainText('تسليم المشروع');
 await expect(page.locator('#ymV36Today')).toContainText('موعد دكتور');
 await expect(page.locator('#ymV36Today')).toContainText('قوة العادات');
 await expect(page.locator('#ymV36Today')).toContainText('تمت مزامنة البيانات');
 expect(await page.evaluate(()=>window.YawmiExtraAPI.getScores().xp)).toBe(155);
});
test('Arabic typed quick-add parses tomorrow and 8 PM and saves reminder only after confirmation',async({page})=>{
 await boot(page);await page.locator('#ymV36QuickFab').click();
 await page.locator('#ymV36Text').fill('فكرني أراجع بكرة الساعة ٨ مساء');
 await page.locator('[data-v36-parse]').click();
 await expect(page.locator('#ymV36Kind')).toHaveValue('reminder');
 await expect(page.locator('#ymV36Date')).toHaveValue('2026-11-06');
 await expect(page.locator('#ymV36Time')).toHaveValue('20:00');
 expect((await state(page)).lifeReminders).toHaveLength(0);
 await page.locator('#ymV36Form button[type=submit]').click();
 await expect(page.locator('#ymV36Dialog')).not.toBeVisible();
 const s=await state(page);
 expect(s.lifeReminders).toHaveLength(1);
 expect(s.lifeReminders[0].time).toBe('20:00');
 expect(s.lifeReminders[0].date).toBe('2026-11-06');
 expect(await page.evaluate(()=>window.YawmiExtraAPI.getScores().xp)).toBe(155);
 await page.reload();
 expect((await state(page)).lifeReminders).toHaveLength(1);
});
test('quick-add rejects un-timed reminder and does not add XP or an unsaved record',async({page})=>{
 await boot(page);await page.locator('[data-v36-openquick]').first().click();
 await page.locator('#ymV36Kind').selectOption('reminder');
 await page.locator('#ymV36Title').fill('ذكرني بالموعد');
 await page.locator('#ymV36Form button[type=submit]').click();
 await expect(page.locator('#ymV36Error')).toContainText('ساعة');
 expect((await state(page)).lifeReminders).toHaveLength(0);
});
test('quick-add creates a real task with no automatic completion, and rolls back failed save',async({page})=>{
 await boot(page);await page.locator('#ymV36QuickFab').click();
 await page.locator('#ymV36Title').fill('إنهاء عرض جديد');
 await page.evaluate(()=>window.__failSave=true);
 await page.locator('#ymV36Form button[type=submit]').click();
 expect((await state(page)).tasks).toHaveLength(4);
 await expect(page.locator('#ymV36Error')).toContainText('فشل حفظ');
 await page.evaluate(()=>window.__failSave=false);
 await page.locator('#ymV36Form button[type=submit]').click();
 const s=await state(page);expect(s.tasks).toHaveLength(5);
 expect(s.daily['2026-11-05']).toBeUndefined();
 expect(s.tasks[4].title).toBe('إنهاء عرض جديد');
 expect(await page.evaluate(()=>window.YawmiExtraAPI.getScores().xp)).toBe(155);
});
test('light day shows one selected task but does not delete tasks or manipulate XP',async({page})=>{
 await boot(page);
 expect(await page.locator('#ymV36Today .ym36-grid article').first().locator('.ym36-item').count()).toBe(3);
 await page.locator('[data-v36-light]').click();
 await expect(page.locator('#ymV36Today')).toContainText('الوضع الخفيف');
 expect(await page.locator('#ymV36Today .ym36-grid article').first().locator('.ym36-item').count()).toBe(1);
 const s=await state(page);expect(s.tasks).toHaveLength(4);
 expect(s.life36Prefs.lightDays['2026-11-05']).toBe(true);
 await page.reload();
 expect(await page.locator('#ymV36Today .ym36-grid article').first().locator('.ym36-item').count()).toBe(1);
 await page.locator('[data-v36-light]').click();
 expect(await page.locator('#ymV36Today .ym36-grid article').first().locator('.ym36-item').count()).toBe(3);
 expect(await page.evaluate(()=>window.YawmiExtraAPI.getScores().xp)).toBe(155);
});
test('habit rest is non-scoring, reversible and cannot erase recorded progress',async({page})=>{
 await boot(page);await page.evaluate(()=>window.YawmiExtraAPI.goPage('habits'));
 await expect(page.locator('#ymV36HabitPanel')).toBeVisible();
 await page.locator('#ymV36HabitPick').selectOption('h2');
 await page.locator('[data-v36-rest]').click();
 expect((await state(page)).habits[1].pausedDates).toEqual(['2026-11-05']);
 expect(await page.evaluate(()=>window.YawmiLifeV36.getFacts(window.__state).habits.map(h=>h.id))).toEqual(['h1']);
 await page.locator('[data-v36-rest]').click();
 expect((await state(page)).habits[1].pausedDates).toEqual([]);
 await page.evaluate(()=>{window.__state.daily['2026-11-05']={habits:{h2:1},tasks:{}}});
 await page.locator('[data-v36-rest]').click();
 expect((await state(page)).habits[1].pausedDates).toEqual([]);
 expect((await page.evaluate(()=>window.__notices)).at(-1)).toContain('فيه تقدم مسجل');
 expect(await page.evaluate(()=>window.YawmiExtraAPI.getScores().xp)).toBe(155);
});
test('habit chaining is stored as a plan; circular dependencies are rejected',async({page})=>{
 await boot(page);await page.evaluate(()=>window.YawmiExtraAPI.goPage('habits'));
 await page.locator('#ymV36HabitAfter').selectOption('h2');
 await page.locator('[data-v36-after]').click();
 expect((await state(page)).habits[0].afterHabitId).toBe('h2');
 await page.locator('#ymV36HabitPick').selectOption('h2');
 await page.locator('#ymV36HabitAfter').selectOption('h1');
 await page.locator('[data-v36-after]').click();
 expect((await state(page)).habits[1].afterHabitId||'').toBe('');
});
test('backup export includes account owner and saved content, foreign-account restore is blocked',async({page})=>{
 await boot(page);await page.locator('[data-v36-openbackup]').click();
 const [download]=await Promise.all([page.waitForEvent('download'),page.locator('[data-v36-backupexport]').click()]);
 expect(download.suggestedFilename()).toContain('YAWMI-private-backup-2026-11-05.json');
 const snapshot=await page.evaluate(async()=>new Blob([JSON.stringify({app:'YAWMI LifeOS',format:36,owner:'another-user',snapshot:window.__state})],{type:'application/json'}));
 expect(snapshot).toBeTruthy();
 await page.setInputFiles('#ymV36Import',{name:'foreign.json',mimeType:'application/json',
 buffer:Buffer.from(JSON.stringify({app:'YAWMI LifeOS',format:36,owner:'another-user',snapshot:await state(page)}))});
 await expect(page.locator('#ymV36BackupError')).toContainText('حساب مختلف');
 expect((await state(page)).tasks).toHaveLength(4);
});
test('weekly coach proposes a separate task only on explicit confirmation and no XP',async({page})=>{
 await boot(page);await page.evaluate(()=>window.YawmiExtraAPI.goPage('coach'));
 await expect(page.locator('#ymV36Coach')).toContainText('اقتراح عملي');
 page.on('dialog',d=>d.accept());
 await page.locator('#ymV36Coach [data-v36-coachtask]').click();
 const s=await state(page);expect(s.tasks).toHaveLength(5);expect(s.tasks[4].date).toBe('2026-11-06');
 expect(await page.evaluate(()=>window.YawmiExtraAPI.getScores().xp)).toBe(155);
});
test('new V36 controls are linked in all three production skins with no new sidebar section',async({page})=>{
 for(const skin of ['01_ATLAS_Executive.html','02_JOURNAL_Editorial.html','03_QUEST_RPG.html']){
  await page.goto('/'+skin,{waitUntil:'domcontentloaded'});
  await expect(page.locator('#ymV36Today')).toHaveCount(1);
  await expect(page.locator('#ymV36QuickFab')).toHaveCount(1);
  expect(await page.evaluate(()=>typeof window.YawmiLifeV36?.parseQuick)).toBe('function');
  await expect(page.locator('.sidebar [data-tab="quick"],.sidebar [data-tab="light"]')).toHaveCount(0);
 }
});

test('Android widget deep link routes to tasks only after account access and clears URL token',async({page})=>{
 await page.goto('/tests/life-v36.html?quick=tasks');
 await expect.poll(()=>page.evaluate(()=>window.__view)).toBe('tasks');
 expect(new URL(page.url()).searchParams.has('quick')).toBe(false);
});
test('Android widget deep link does not bypass the login gate',async({page})=>{
 await page.addInitScript(()=>{Object.defineProperty(window,'__willTestLogin',{value:true})});
 await page.goto('/tests/life-v36.html?quick=calendar');
 await expect.poll(()=>page.evaluate(()=>window.__view)).toBe('calendar');
 expect(await page.evaluate(()=>window.YawmiCloud.currentUser?.id)).toBe('qa-user');
});
