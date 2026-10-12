import { test, expect } from '@playwright/test';
import { OriginalSimulation } from '../packages/physics/src';
import { ORIGINAL_SCREENS } from '../packages/maps/src';
import { progressKey } from '../apps/web/src/game/originalProgress';

for (const viewport of [
  { width: 960, height: 800 },
  { width: 390, height: 844 },
]) {
  test(`ending leaves credits unobstructed at ${viewport.width}px and keeps victory achievements`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    const simulation = new OriginalSimulation(
      ORIGINAL_SCREENS,
      336,
      110 - 42 * 360,
    );
    for (let i = 0; i < 30; i++)
      simulation.tick({ left: false, right: false, jump: false });
    await page.goto('/');
    await page.evaluate((state) => {
      localStorage.setItem('jumpking.timer', 'true');
      localStorage.setItem(
        'jumpking.original.v1.original',
        JSON.stringify({
          version: 1,
          campaign: 'original',
          state,
          bestScreen: 42,
          completed: false,
        }),
      );
    }, simulation.getState());
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/play');
    const game = page.getByTestId('game-state');
    await expect(game).toHaveAttribute('data-status', 'CUTSCENE', {
      timeout: 30000,
    });
    const skip = page.getByRole('button', { name: 'Bỏ qua cắt cảnh' });
    await expect(skip).toBeEnabled({ timeout: 30000 });
    await expect(page.locator('.achievement-toast')).toHaveCount(0);
    await expect(page.getByTestId('run-clock')).toHaveCount(0);
    await expect(page.locator('.room-chat')).toHaveCount(0);
    const frame = (await game.boundingBox())!;
    const button = (await skip.boundingBox())!;
    expect(button.y + button.height).toBeLessThan(frame.y + frame.height / 2);
    expect(button.x).toBeGreaterThanOrEqual(frame.x);
    expect(button.x + button.width).toBeLessThanOrEqual(frame.x + frame.width);
    await page.screenshot({
      path: testInfo.outputPath('ending-without-overlays.png'),
    });
    await skip.click();
    await expect(game).toHaveAttribute('data-status', 'COMPLETE');
    await expect(
      page.getByRole('button', { name: 'Main Menu', exact: true }),
    ).toBeVisible();
    await expect(page.locator('.achievement-toast')).toHaveCount(0);
    const achievements = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!).achievements.unlocked,
      progressKey,
    );
    expect(achievements).toContain('WIN');
    expect(errors).toEqual([]);
  });
}
