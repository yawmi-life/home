const {test,expect}=require('@playwright/test');
const AxeBuilder=require('@axe-core/playwright').default;
async function open(page){await page.goto('/tests/life-v32.html');await expect(page.locator('#ymMoneyApp h2')).toContainText('فلوسك');}
async function transaction(page,type,description,amount,category){
 await page.locator('[data-money-add="'+type+'"]').click();
 await page.locator('#ymMoneyFormTitle').fill(description);
 await page.locator('#ymMoneyFormAmount').fill(amount);
 if(category)await page.locator('#ymMoneyFormCategory').selectOption(category);
 await page.locator('#ymMoneyForm button[type=submit]').click();
 await expect(page.locator('#ymMoneyDialog')).not.toBeVisible();
}
test('finance records income, expenses and transfers without doubling totals or affecting XP',async({page})=>{
 await open(page);
 await transaction(page,'income','راتب تجريبي','3000','salary');
 await transaction(page,'expense','مشتريات منزلية','200','groceries');
 await page.locator('[data-money-add="transfer"]').click();
 await page.locator('#ymMoneyFormTitle').fill('تحويل للمصرف');
 await page.locator('#ymMoneyFormAmount').fill('100');
 await page.locator('#ymMoneyFormAccount').selectOption('cash');
 await page.locator('#ymMoneyFormTo').selectOption('bank');
 await page.locator('#ymMoneyForm button[type=submit]').click();
 const data=await page.evaluate(()=>{
  const f=window.__state.finance,m=window.YawmiMoney.totals(f,new Date().toISOString().slice(0,7));
  return {income:m.income,expense:m.expense,transfer:m.transfers,cash:window.YawmiMoney.balance(f,'cash'),
   bank:window.YawmiMoney.balance(f,'bank'),xp:window.YawmiExtraAPI.getScores().xp,saves:window.__saves};
 });
 expect(data).toMatchObject({income:300000,expense:20000,transfer:1,cash:270000,bank:10000,xp:500});
 expect(data.saves).toBeGreaterThan(0);
 await page.reload();
 await expect(page.locator('.ym-money-transactions-list .ym-money-transaction')).toHaveCount(3);
});
test('finance edits/deletes affect balances and category budgets',async({page})=>{
 await open(page);
 await transaction(page,'expense','متجر','125.50','groceries');
 await page.locator('[data-money-budget]').click();
 await page.locator('[data-budget-key="groceries"]').fill('200');
 await page.locator('#ymMoneyBudgetForm button[type=submit]').click();
 await expect(page.locator('.ym-money-budget-row')).toContainText('63%');
 await page.locator('[data-money-edit]').first().click();
 await page.locator('#ymMoneyFormAmount').fill('180');
 await page.locator('#ymMoneyForm button[type=submit]').click();
 await expect(page.locator('.ym-money-budget-row')).toContainText('90%');
 page.once('dialog',dialog=>dialog.accept());
 await page.locator('[data-money-delete]').first().click();
 const balance=await page.evaluate(()=>window.YawmiMoney.totals(window.__state.finance,new Date().toISOString().slice(0,7)));
 expect(balance.expense).toBe(0);
});
test('savings goals do not pretend to move cash; recurring bills require confirmation once',async({page})=>{
 await open(page);
 await page.locator('[data-money-goal]').click();
 await page.locator('#ymMoneyGoalTitle').fill('صندوق الطوارئ');
 await page.locator('#ymMoneyGoalTarget').fill('1000');
 await page.locator('#ymMoneyGoalSaved').fill('350');
 await page.locator('#ymMoneyGoalForm button[type=submit]').click();
 await expect(page.locator('.ym-money-goal')).toContainText('35%');
 await expect(page.locator('.ym-money-goal')).toContainText('صندوق الطوارئ');
 const before=await page.evaluate(()=>window.YawmiMoney.totals(window.__state.finance,new Date().toISOString().slice(0,7)).expense);
 expect(before).toBe(0);
 await page.locator('[data-money-recurring]').click();
 await page.locator('#ymMoneyRecurringTitle').fill('إيجار شهري');
 await page.locator('#ymMoneyRecurringAmount').fill('900');
 await page.locator('#ymMoneyRecurringDay').fill('1');
 await page.locator('#ymMoneyRecurringCat').selectOption('home');
 await page.locator('#ymMoneyRecurringForm button[type=submit]').click();
 expect(await page.evaluate(()=>window.__state.finance.transactions.length)).toBe(0);
 page.once('dialog',dialog=>dialog.accept());
 await page.locator('[data-money-log-recurring]').click();
 await expect(page.locator('.ym-money-due button:disabled')).toContainText('مسجّل');
 expect(await page.evaluate(()=>window.__state.finance.transactions.length)).toBe(1);
});
test('journal supports mood, prompts, tagging, search and persists an explicit entry',async({page})=>{
 await open(page);
 await page.locator('[data-diary-new]').first().click();
 await expect(page.locator('#ymDiaryDialog')).toBeVisible();
 await page.locator('[data-diary-mood="4"]').click();
 await page.locator('#ymDiaryTitle').fill('لحظة هادية');
 await page.locator('#ymDiaryBody').fill('النهاردة خلّصت شغل مهم واتعلمت فكرة جديدة.');
 await page.locator('#ymDiaryGratitude').fill('ممتن لوجود أصحابي');
 await page.locator('#ymDiaryTags').fill('شغل، امتنان، شغل');
 await page.locator('#ymDiaryForm button[type=submit]').click();
 await expect(page.locator('#ymDiaryDialog')).not.toBeVisible();
 const saved=await page.evaluate(()=>({rows:window.__state.journalEntries, xp:window.YawmiExtraAPI.getScores().xp}));
 expect(saved.rows).toHaveLength(1);
 expect(saved.rows[0]).toMatchObject({title:'لحظة هادية',mood:4});
 expect(saved.rows[0].tags).toEqual(['شغل','امتنان']);expect(saved.xp).toBe(500);
 await page.locator('#ymDiarySearch').fill('فكرة جديدة');
 await expect(page.locator('.ym-diary-entry')).toHaveCount(1);
 await page.locator('#ymDiarySearch').fill('نص مش موجود');
 await expect(page.locator('.ym-diary-entry')).toHaveCount(0);
 await page.reload();
 expect(await page.evaluate(()=>window.__state.journalEntries.length)).toBe(1);
});
test('journal auto-saved draft reopens and old entries can be edited/deleted',async({page})=>{
 await open(page);
 await page.locator('[data-diary-new]').first().click();
 await page.locator('#ymDiaryBody').fill('مسودة بتتكتب بهدوء وتتحفظ.');
 await page.waitForTimeout(900);
 await page.locator('[data-diary-close]').click();
 await page.reload();
 await page.locator('[data-diary-resume]').click();
 await expect(page.locator('#ymDiaryBody')).toHaveValue('مسودة بتتكتب بهدوء وتتحفظ.');
 await page.locator('#ymDiaryForm button[type=submit]').click();
 await expect(page.locator('.ym-diary-entry')).toHaveCount(1);
 await page.locator('[data-diary-open]').click();
 await page.locator('#ymDiaryBody').fill('نص مختلف بعد التعديل.');
 await page.locator('#ymDiaryForm button[type=submit]').click();
 expect(await page.evaluate(()=>window.__state.journalEntries[0].body)).toBe('نص مختلف بعد التعديل.');
 page.once('dialog',dialog=>dialog.accept());
 await page.locator('[data-diary-open]').click();
 await page.locator('[data-diary-delete]').click();
 await expect(page.locator('.ym-diary-entry')).toHaveCount(0);
});
test('v32 finance and journal pass axe accessibility smoke test',async({page})=>{
 await open(page);
 const res=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze();
 expect(res.violations.filter(v=>v.impact==='serious'||v.impact==='critical')).toEqual([]);
});
test('three skins expose finance/journal only through navigation, not home shortcuts',async({page})=>{
 for(const f of ['01_ATLAS_Executive.html','02_JOURNAL_Editorial.html','03_QUEST_RPG.html']){
  await page.goto('/'+f,{waitUntil:'domcontentloaded'});
  await expect(page.locator('#ymMoneyApp')).toHaveCount(1);
  await expect(page.locator('#ymDiaryApp')).toHaveCount(1);
  await expect(page.locator('.ym-life-home-shortcuts')).toHaveCount(0);
  await expect(page.locator('#page-home [data-tab="money"], #page-home [data-tab="diary"]')).toHaveCount(0);
  await expect(page.locator('.sidebar [data-tab="money"]')).toHaveCount(1);
  await expect(page.locator('.sidebar [data-tab="diary"]')).toHaveCount(1);
 }
});
