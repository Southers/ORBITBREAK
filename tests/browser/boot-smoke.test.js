import { test, expect } from '@playwright/test';

test('the playable shell boots without console errors', async ({ page }) => {
  const PageErrors = [];
  page.on('pageerror', (ErrorEvent) => {
    PageErrors.push(ErrorEvent.message);
  });
  page.on('console', (Message) => {
    if (Message.type() === 'error') {
      PageErrors.push(Message.text());
    }
  });

  await page.goto('./index.html');
  const GameCanvas = page.locator('#GameCanvas');
  await expect(GameCanvas).toBeVisible();
  await expect.poll(async () => GameCanvas.getAttribute('data-build')).toMatch(/^\d{8}-ob\d+$/);
  await expect.poll(async () => GameCanvas.getAttribute('data-webgl-available')).toBe('true');
  expect(PageErrors, PageErrors.join('\n')).toEqual([]);
});
