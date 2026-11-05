const {test,expect}=require('@playwright/test');
async function start(page){await page.goto('/tests/life-v34.html');await expect(page.locator('#ymOnboard')).toBeVisible()}
async function only(page,name,ids){
 const boxes=page.locator('#ymOnboard input[name="'+name+'"]');
 for(let i=0;i<await boxes.count();i++)await boxes.nth(i).uncheck();
 for(const id of ids)await page.locator('#ymOnboard input[name="'+name+'"][value="'+id+'"]').check();
}
test('first-run users choose exact four habits and three tasks, and the selection persists on reopening',async({page})=>{
 await start(page);
 await expect(page.locator('#ymOnboardTaskChoices input[type=checkbox]')).toHaveCount(7);
 await only(page,'ymOnboardHabit',['fajr','sport','family','reading']);
 await only(page,'ymOnboardTask',['t3','ym-start-learn','ym-start-plan']);
 await page.locator('#ymOnboardGoal').fill('أخلّص كورس البرمجة');
 await page.locator('#ymOnboardContinue').click();
 await expect(page.locator('#ymOnboard')).not.toBeVisible();
 const v=await page.evaluate(()=>({o:window.__state.onboarding,habits:window.__state.habits.filter(h=>h.active).map(h=>h.id),tasks:window.__state.tasks.map(t=>t.title),goals:window.__state.goals,score:window.YawmiExtraAPI.getScores().xp}));
 expect(v.o.completed).toBe(true);
 expect(v.o.mode).toBe('custom');
 expect(v.habits).toEqual(['fajr','reading','sport','family']);
 expect(v.tasks).toEqual(['مهمة مقترحة t3','أتعلّم حاجة جديدة لمدة 20 دقيقة','أراجع أولويات بكرة']);
 expect(v.goals).toHaveLength(1);
 expect(v.goals[0].title).toBe('أخلّص كورس البرمجة');
 expect(v.score).toBe(250);
 await page.reload();
 await expect(page.locator('#ymOnboard')).not.toBeVisible();
 expect(await page.evaluate(()=>window.__state.onboarding.habits)).toEqual(['fajr','reading','sport','family']);
 expect(await page.evaluate(()=>window.__state.tasks.length)).toBe(3);
});
test('suggested setup creates three suggested habits and two real tasks, never unrelated defaults',async({page})=>{
 await start(page);
 await only(page,'ymOnboardHabit',['family','sport']);
 await only(page,'ymOnboardTask',['ym-start-move']);
 await page.locator('#ymOnboardSkip').click();
 await expect(page.locator('#ymOnboard')).not.toBeVisible();
 const result=await page.evaluate(()=>({habits:window.__state.habits.filter(h=>h.active).map(x=>x.id),tasks:window.__state.tasks.map(x=>x.id),onboard:window.__state.onboarding}));
 expect(result.habits).toEqual(['fajr','water','reading'].sort((a,b)=>['fajr','reading','water'].indexOf(a)-['fajr','reading','water'].indexOf(b)));
 expect(result.tasks).toEqual(['t1','t2']);
 expect(result.onboard.mode).toBe('suggested');
});
test('validation errors remain visible in onboarding dialog and do not mutate user data',async({page})=>{
 await start(page);
 await only(page,'ymOnboardHabit',[]);
 await only(page,'ymOnboardTask',[]);
 await page.locator('#ymOnboardContinue').click();
 await expect(page.locator('#ymOnboard')).toBeVisible();
 await expect(page.locator('#ymOnboardFeedback')).toContainText('اختار عادة واحدة أو مهمة واحدة');
 expect(await page.evaluate(()=>Boolean(window.__state.onboarding?.completed))).toBe(false);
 await only(page,'ymOnboardHabit',['fajr','reading','water','sport','quran','sleep','learning','family','focus']);
 await page.locator('#ymOnboardContinue').click();
 await expect(page.locator('#ymOnboardFeedback')).toContainText('بحد أقصى 8 عادات');
 expect(await page.evaluate(()=>window.__state.habits.every(h=>h.active))).toBe(true);
});
test('failed save leaves onboarding open and restores all original starter records',async({page})=>{
 await start(page);
 await only(page,'ymOnboardHabit',['sport']);
 await only(page,'ymOnboardTask',['t4']);
 await page.evaluate(()=>window.__failSave=true);
 await page.locator('#ymOnboardContinue').click();
 await expect(page.locator('#ymOnboard')).toBeVisible();
 await expect(page.locator('#ymOnboardFeedback')).toContainText('ما قدرناش نحفظ الاختيارات');
 const state=await page.evaluate(()=>({tasks:window.__state.tasks.map(t=>t.id),active:window.__state.habits.every(h=>h.active),o:window.__state.onboarding}));
 expect(state.tasks).toEqual(['t1','t2','t3','t4']);
 expect(state.active).toBe(true);expect(state.o).toBeUndefined();
 await page.evaluate(()=>window.__failSave=false);
 await page.locator('#ymOnboardContinue').click();
 await expect(page.locator('#ymOnboard')).not.toBeVisible();
});
test('section manager hides tasks, diary and money from sidebar, mobile and bottom nav; restores them',async({page})=>{
 await start(page);
 await page.locator('#ymOnboardSkip').click();
 await page.locator('.sidebar [data-ym-sections]').click();
 await expect(page.locator('#ymSectionsDialog')).toBeVisible();
 await page.locator('[data-ym-section-toggle="money"]').click();
 await page.locator('[data-ym-section-toggle="diary"]').click();
 await page.locator('[data-ym-section-toggle="tasks"]').click();
 await expect(page.locator('.sidebar [data-tab="money"]')).toBeHidden();
 await expect(page.locator('.sidebar [data-tab="diary"]')).toBeHidden();
 await expect(page.locator('.sidebar [data-tab="tasks"]')).toBeHidden();
 await expect(page.locator('.bottom-nav [data-tab="tasks"]')).toBeHidden();
 await expect(page.locator('#yawmiMenuDrawer [data-yam-action="money"]')).toBeHidden();
 await expect(page.locator('#yawmiMenuDrawer [data-yam-action="diary"]')).toBeHidden();
 await expect(page.locator('#ymSectionsDialog .ym-sections-hidden')).toContainText('ماليتي');
 await expect(page.locator('.sidebar [data-tab="home"]')).toBeVisible();
 await page.locator('#ymSectionsDialog [data-ym-section-toggle="money"]').click();
 await expect(page.locator('.sidebar [data-tab="money"]')).toBeVisible();
 await expect(page.locator('#yawmiMenuDrawer [data-yam-action="money"]')).toBeVisible();
 await page.locator('#ymSectionsDialog [data-ym-sections-close]').last().click();
 await page.reload();
 await expect(page.locator('.sidebar [data-tab="diary"]')).toBeHidden();
 await expect(page.locator('.sidebar [data-tab="tasks"]')).toBeHidden();
 await expect(page.locator('.sidebar [data-tab="money"]')).toBeVisible();
 await expect(page.locator('.sidebar [data-ym-sections]')).toBeVisible();
 await page.locator('.sidebar [data-ym-sections]').click();
 await page.locator('#ymSectionsDialog [data-ym-sections-showall]').click();
 await expect(page.locator('.sidebar [data-tab="diary"]')).toBeVisible();
 await expect(page.locator('.sidebar [data-tab="tasks"]')).toBeVisible();
 expect(await page.evaluate(()=>window.__state.hiddenSections)).toEqual([]);
});
test('all optional sections can be hidden without removing permanent Home and Manage entry',async({page})=>{
 await start(page);
 await page.locator('#ymOnboardSkip').click();
 await page.locator('.sidebar [data-ym-sections]').click();
 const idList=await page.evaluate(()=>window.YawmiNavigation.sections.map(v=>v.id));
 for(const id of idList)await page.locator('#ymSectionsDialog [data-ym-section-toggle="'+id+'"]').click();
 await expect(page.locator('#ymSectionsDialog .ym-sections-hidden')).toContainText('الأقسام المخفية');
 expect(await page.evaluate(()=>window.__state.hiddenSections.length)).toBe(idList.length);
 await expect(page.locator('.sidebar [data-tab="home"]')).toBeVisible();
 await expect(page.locator('.sidebar [data-ym-sections]')).toBeVisible();
 await page.locator('#ymSectionsDialog [data-ym-sections-showall]').click();
 expect(await page.evaluate(()=>window.__state.hiddenSections.length)).toBe(0);
});
test('all three production skins ship updated onboarding, account adjustment, and sidebar section management',async({page})=>{
 for(const file of ['01_ATLAS_Executive.html','02_JOURNAL_Editorial.html','03_QUEST_RPG.html']){
  await page.goto('/'+file,{waitUntil:'domcontentloaded'});
  await expect(page.locator('#ymOnboardTaskChoices')).toHaveCount(1);
  await expect(page.locator('#ymOnboardFeedback')).toHaveCount(1);
  await expect(page.locator('.sidebar [data-ym-sections]')).toHaveCount(1);
  await expect(page.locator('.sidebar [data-tab="money"]')).toHaveCount(1);
  await expect(page.locator('#page-home [data-ym-sections]')).toHaveCount(0);
  expect(await page.evaluate(()=>Boolean(window.YawmiNavigation?.apply&&window.YawmiMoney?.balance))).toBe(true);
 }
});
