const { test, expect } = require('@playwright/test');

test('YAWMI live website notices a newer deployed version without replacing an active page', async ({ page }) => {
  await page.route('**/site-version.json?nocache=*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: {'etag':'"test-new-deployment"'},
      body: JSON.stringify({revision:'web-2026-11-06-999'})
    });
  });
  await page.goto('/index.html', { waitUntil: 'load' });
  await expect(page.locator('#yawmiWebUpdatePrompt')).toBeVisible({timeout:12000});
  await expect(page.locator('#yawmiWebUpdatePrompt button')).toHaveText('تحديث الآن');
  await expect(page.locator('#yawmiWebUpdatePrompt')).toContainText('تحديث جديد');
});
