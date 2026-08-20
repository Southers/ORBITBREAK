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

test('the first gesture receives the Warden transmission before Continue advances', async ({ page }) => {
  await page.goto('./index.html');
  const GameCanvas = page.locator('#GameCanvas');
  const Continue = page.locator('#BriefingContinueButton');
  await expect(Continue).toHaveText('Receive Warden transmission');
  await expect(GameCanvas).toHaveAttribute('data-opening-transmission', 'awaiting-gesture');

  await Continue.click();
  await expect(GameCanvas).toHaveAttribute('data-opening-transmission', 'received');
  await expect(page.locator('#BriefingSpeaker')).toHaveText('THE WARDEN');
  await expect(page.locator('#BriefingTitle')).toHaveText('Travel is forbidden.');

  await Continue.click();
  await expect(page.locator('#BriefingSpeaker')).toHaveText('THE RUNNER');
});

test('keyboard activation receives the Warden transmission', async ({ page }) => {
  await page.goto('./index.html');
  const Continue = page.locator('#BriefingContinueButton');
  await Continue.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#BriefingTitle')).toHaveText('Travel is forbidden.');
});
