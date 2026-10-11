import { test, expect, Page } from '@playwright/test';
import { createOriginalAchievementProgress } from '../packages/physics/src';

async function enterCheat(page: Page, code: string) {
  await page.getByText('Chạy thử tự động', { exact: true }).click();
  await page.getByLabel('Mã cheat', { exact: true }).fill(code);
  await page.getByRole('button', { name: 'Kích hoạt tự chơi' }).click();
}

test('incorrect code leaves the current solo run intact', async ({ page }) => {
  await page.goto('/play');
  const game = page.getByTestId('game-state');
  await expect(game).toHaveAttribute('data-status', 'PLAYING');
  await enterCheat(page, 'wrong-code');
  await expect(page.getByRole('alert')).toHaveText('Mã cheat không đúng.');
  await expect(game).toHaveAttribute('data-autoplay', 'false');
  await expect(page.getByTestId('autoplay-panel')).toHaveCount(0);
});

test('AUTOKING pauses, resumes, completes all three real campaigns, and preserves saves', async ({
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
  await page.getByRole('button', { name: 'Tạm dừng', exact: true }).click();
  const progress = await game.getAttribute('data-replay-progress');
  await page.waitForTimeout(350);
  await expect(game).toHaveAttribute('data-replay-progress', progress!);
  await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
  await page.getByLabel('Tốc độ chạy thử', { exact: true }).selectOption('64');
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
  await expect(page.getByRole('button', { name: 'Tháo Cap' })).toBeVisible();
});
