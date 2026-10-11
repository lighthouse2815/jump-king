import { openDeveloper, openInventory } from './helpers/gameMenu';
import { test, expect, Page } from '@playwright/test';
import { createOriginalAchievementProgress } from '../packages/physics/src';

async function enterCheat(page: Page, code: string) {
  await openDeveloper(page);
  await page.getByLabel('Mã cheat', { exact: true }).fill(code);
  await page.getByRole('button', { name: 'Kích hoạt tự chơi' }).click();
}

test('incorrect code leaves the current solo run intact', async ({
  page,
}) => {
  await page.goto('/play');
  const game = page.getByTestId('game-state');
  await expect(game).toHaveAttribute('data-status', 'PLAYING');
  await enterCheat(page, 'wrong-code');
  await expect(page.getByRole('alert')).toHaveText('Mã cheat không đúng.');
  await expect(game).toHaveAttribute('data-autoplay', 'false');
  await expect(page.getByTestId('autoplay-panel')).toHaveCount(0);
});

test('AUTOKING pauses, resumes, tours all three campaigns, and preserves saves', async ({
  page,
}) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.evaluate(
    (achievements) =>
      localStorage.setItem(
        'jumpking.progress.v1',
        JSON.stringify({
          version: 1,
          inventory: { Cap: 1 },
          equipped: ['Cap'],
          flags: [],
          achievements,
        }),
      ),
    createOriginalAchievementProgress(),
  );
  await page.goto('/play');
  const game = page.getByTestId('game-state');
  await expect(game).toHaveAttribute('data-status', 'PLAYING');
  await enterCheat(page, ' autoking ');
  await expect(game).toHaveAttribute('data-autoplay', 'true');
  const saved = await page.evaluate(() =>
    Object.fromEntries(
      Object.entries(localStorage).filter(
        ([key]) =>
          key.startsWith('jumpking.original.') ||
          key === 'jumpking.progress.v1',
      ),
    ),
  );
  await expect(game).toHaveAttribute('data-status', 'PLAYING');
  await page.keyboard.press('Escape');
  const progress = await game.getAttribute('data-replay-progress');
  await page.waitForTimeout(350);
  await expect(game).toHaveAttribute('data-replay-progress', progress!);
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await page
    .getByLabel('Tốc độ chạy thử', { exact: true })
    .selectOption('64');
  const results = page.getByTestId('autoplay-results');
  await expect(results.locator('[data-campaign="original"]')).toContainText(
    '46 màn',
    { timeout: 80_000 },
  );
  await expect(results.locator('[data-campaign="nbp"]')).toContainText(
    '55 màn',
    { timeout: 80_000 },
  );
  await expect(results.locator('[data-campaign="ghost"]')).toContainText(
    '68 màn',
    { timeout: 80_000 },
  );
  await expect(game).toHaveAttribute('data-status', 'COMPLETE');
  // White Raven starts on screen 0, crosses NBP and also activates Fairy 2 there.
  for (const [campaign, coverage] of [
    [
      'original',
      '3 lần nhặt · 6 NPC · 1 giao dịch · 2 nhiệm vụ chim · 2 cắt cảnh',
    ],
    [
      'nbp',
      '10 lần nhặt · 14 NPC · 2 giao dịch · 0 nhiệm vụ chim · 2 cắt cảnh',
    ],
    [
      'ghost',
      '17 lần nhặt · 13 NPC · 2 giao dịch · 2 nhiệm vụ chim · 2 cắt cảnh',
    ],
  ])
    await expect(
      results.locator(`[data-campaign="${campaign}"]`),
    ).toContainText(coverage);
  await page.screenshot({
    path: '/tmp/jump-king-autoplay-complete.png',
    fullPage: true,
  });
  expect(
    await page.evaluate(() =>
      Object.fromEntries(
        Object.entries(localStorage).filter(
          ([key]) =>
            key.startsWith('jumpking.original.') ||
            key === 'jumpking.progress.v1',
        ),
      ),
    ),
  ).toEqual(saved);
  expect(errors).toEqual([]);
  await page
    .getByRole('button', { name: 'Dừng tự chơi, trở lại save' })
    .click();
  await expect(game).toHaveAttribute('data-autoplay', 'false');
  await expect(game).toHaveAttribute('data-status', 'PLAYING');
  await expect(game).toHaveAttribute('data-x', '231');
  await expect(game).toHaveAttribute('data-jumps', '0');
  await expect(
    (await openInventory(page)).getByRole('button', {
      name: 'Cap',
      exact: true,
    }),
  ).toHaveAttribute('aria-pressed', 'true');
});

test('cheat entry fits a phone screen and stopping immediately restores the solo run', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/play');
  const game = page.getByTestId('game-state');
  await expect(game).toHaveAttribute('data-status', 'PLAYING');
  await enterCheat(page, 'AUTOKING');
  await expect(game).toHaveAttribute('data-autoplay', 'true');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole('button', { name: 'Dừng tự chơi, trở lại save' })
    .click();
  await expect(game).toHaveAttribute('data-status', 'PLAYING');
  await expect(game).toHaveAttribute('data-autoplay', 'false');
  await expect(game).toHaveAttribute('data-jumps', '0');
});
