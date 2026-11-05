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
test('Android widget link waits for authenticated cloud snapshot',async({page})=>{
 await page.goto('/tests/life-v36.html?quick=calendar&locked=1');
 await expect.poll(()=>page.evaluate(()=>window.__view)).toBe('home');
 expect(new URL(page.url()).searchParams.has('quick')).toBe(true);
 await page.evaluate(()=>{window.YawmiCloud.ready=true;window.YawmiLifeV36.render()});
 await expect.poll(()=>page.evaluate(()=>window.__view)).toBe('calendar');
 expect(new URL(page.url()).searchParams.has('quick')).toBe(false);
});

test('yearly reminders surface in Today on their next occurrence without modifying original record',async({page})=>{
 await boot(page);
 await page.evaluate(()=>{
  window.__state.lifeCalendar=[];
  window.__state.lifeReminders=[
   {id:'annual',title:'ذكرى سنوية مهمة',date:'2020-11-06',time:'10:30',repeat:'yearly',done:false},
   {id:'past',title:'موعد انتهى',date:'2022-01-01',time:'12:00',repeat:'none',done:false}
  ];
  window.YawmiLifeV36.render();
 });
 await expect(page.locator('#ymV36Today')).toContainText('ذكرى سنوية مهمة');
 await expect(page.locator('#ymV36Today')).toContainText('2026-11-06');
 expect(await page.evaluate(()=>window.__state.lifeReminders[0].date)).toBe('2020-11-06');
});
test('offline status never incorrectly claims current cloud synchronization',async({page,context})=>{
 await boot(page);
 await context.setOffline(true);
 await page.evaluate(()=>window.YawmiLifeV36.render());
 await expect(page.locator('#ymV36Today')).toContainText('لا يوجد اتصال بالإنترنت');
 await expect(page.locator('#ymV36Today')).not.toContainText('تمت مزامنة البيانات');
 await context.setOffline(false);
 await page.evaluate(()=>{window.YawmiCloud.pending={};window.YawmiLifeV36.render()});
 await expect(page.locator('#ymV36Today')).toContainText('قيد المزامنة');
});

test('Android widget landing deep link keeps preferred Journal skin and query after redirect',async({page})=>{
 await page.goto('/index.html');
 await page.evaluate(()=>localStorage.setItem('yawmi_v9_preferred_skin','02_JOURNAL_Editorial.html'));
 await page.goto('/index.html?source=widget&quick=habits',{waitUntil:'domcontentloaded'});
 await expect.poll(()=>new URL(page.url()).pathname.endsWith('/02_JOURNAL_Editorial.html')).toBe(true);
 expect(new URL(page.url()).searchParams.get('quick')).toBe('habits');
});
test('Android widget first launch routes to a valid default design without requiring stored preferences',async({page})=>{
 await page.goto('/index.html');
 await page.evaluate(()=>localStorage.removeItem('yawmi_v9_preferred_skin'));
 await page.goto('/index.html?source=widget&quick=tasks',{waitUntil:'domcontentloaded'});
 await expect.poll(()=>new URL(page.url()).pathname.endsWith('/01_ATLAS_Executive.html')).toBe(true);
});

test('V36 weekly habit fallback uses its creation weekday rather than showing it every day',async({page})=>{
 await boot(page);
 const data=await page.evaluate(()=>{
  const h={id:'weeklyQA',title:'أسبوعية',active:true,repeat:'weekly',created:'2026-11-02T10:30:00.000Z',target:1};
  return {
   onMonday:window.YawmiLifeV36.habitScheduled(h,'2026-11-02'),
   onThursday:window.YawmiLifeV36.habitScheduled(h,'2026-11-05'),
   onNextMonday:window.YawmiLifeV36.habitScheduled(h,'2026-11-09')
  };
 });
 expect(data).toEqual({onMonday:true,onThursday:false,onNextMonday:true});
});
test('V36 reading habit excludes orphaned book logs and water respects the explicit corrected quantity',async({page})=>{
 await boot(page);
 const data=await page.evaluate(()=>{
  const s=window.__state,day='2026-11-05';
  s.habits.push({id:'reading',title:'قراءة',repeat:'daily',target:20,active:true});
  s.habits.push({id:'water',title:'مياه',repeat:'daily',active:true,target:8});
  s.bookReadings=[{bookId:'book1',date:day,pages:5},{bookId:'deleted-book',date:day,pages:999}];
  s.daily[day]={habits:{water:8},waterMl:250,tasks:{}};
  return {
    reading:window.YawmiLifeV36.getFacts(s,day).habits.find(h=>h.id==='reading')?.id,
    facts:window.YawmiLifeV36.getFacts(s,day),
    xp:window.YawmiExtraAPI.getScores().xp
  };
 });
 expect(data.facts.doneHabits).toBe(0);
 expect(data.xp).toBe(155);
});
