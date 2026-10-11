import { test, expect } from '@playwright/test';
import { OriginalSimulation } from '../packages/physics/src';
import { ORIGINAL_SCREENS } from '../packages/maps/src';

test('collects, equips and restores the real Cap from a legacy save', async ({
  page,
}) => {
  const simulation = new OriginalSimulation(
    ORIGINAL_SCREENS,
    312,
    132 - 5 * 360,
  );
  await page.goto('/');
  await page.evaluate(
    (state) =>
      localStorage.setItem(
        'jumpking.original.v1.original',
        JSON.stringify({
          version: 1,
          campaign: 'original',
          state,
          bestScreen: 5,
          completed: false,
        }),
      ),
    simulation.getState(),
  );
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/play');
  await expect(page.getByTestId('game-state')).toHaveAttribute(
    'data-status',
    'PLAYING',
    { timeout: 30000 },
  );
  await expect(page.getByRole('button', { name: 'Tháo Cap' })).toBeVisible();
  await page.keyboard.press('Escape');
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('jumpking.original.v1.original')!).state
          .adventure.inventory.Cap,
    ),
  ).toBe(1);
  await page.getByRole('button', { name: 'Tháo Cap' }).click();
  await expect(page.getByRole('button', { name: 'Mặc Cap' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Mặc Cap' })).toBeVisible();
  await page.getByRole('button', { name: 'Mặc Cap' }).click();
  await expect(page.getByRole('button', { name: 'Tháo Cap' })).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('jumpking.original.v1.original')!).state
          .adventure.inventory.Cap,
    ),
  ).toBe(1);
  expect(errors).toEqual([]);
});

test('unlocks and retains the original Cathedral achievement when visiting its real region', async ({
  page,
}) => {
  const simulation = new OriginalSimulation(
    ORIGINAL_SCREENS,
    231,
    302 - 32 * 360,
  );
  await page.goto('/');
  await page.evaluate(
    (state) =>
      localStorage.setItem(
        'jumpking.original.v1.original',
        JSON.stringify({
          version: 1,
          campaign: 'original',
          state,
          bestScreen: 32,
          completed: false,
        }),
      ),
    simulation.getState(),
  );
  await page.goto('/play');
  await expect(page.getByTestId('game-state')).toHaveAttribute(
    'data-status',
    'PLAYING',
    { timeout: 30000 },
  );
  await page.keyboard.press('Escape');
  await expect(
    page.getByText('Reach the Cathedral', { exact: true }).first(),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText('Reach the Cathedral', { exact: true }).first(),
  ).toBeVisible();
});

test('new games show a skippable intro and retain owned equipment across campaigns', async ({
  page,
}) => {
  await page.goto('/');
  await page.evaluate(() =>
    localStorage.setItem(
      'jumpking.progress.v1',
      JSON.stringify({
        version: 1,
        inventory: { Cap: 1 },
        equipped: ['Cap'],
        flags: [],
      }),
    ),
  );
  await page
    .getByRole('button', { name: 'New Babe Plus', exact: true })
    .click();
  await page.getByRole('button', { name: /Game mới/ }).click();
  await expect(page.getByTestId('game-state')).toHaveAttribute(
    'data-status',
    'CUTSCENE',
    { timeout: 30000 },
  );
  await expect(page.getByRole('button', { name: 'Tháo Cap' })).toBeDisabled();
  await page.getByRole('button', { name: 'Bỏ qua mở đầu' }).click();
  await expect(page.getByTestId('game-state')).toHaveAttribute(
    'data-status',
    'PLAYING',
  );
  await expect(page.getByRole('button', { name: 'Tháo Cap' })).toBeEnabled();
  await page.reload();
  await expect(page.getByTestId('game-state')).toHaveAttribute(
    'data-status',
    'PLAYING',
    { timeout: 30000 },
  );
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('jumpking.original.v1.nbp')!).state
          .adventure.inventory.Cap,
    ),
  ).toBe(1);
});
