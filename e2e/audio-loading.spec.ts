import { test, expect } from '@playwright/test';

test('loads gameplay audio after the menu has streamed the same sounds', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const menuAudio = page.waitForResponse((response) =>
    new URL(response.url()).pathname.endsWith('/audio/gui_sfx/selectA.ogg'),
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'Press SPACE to start' }).click();
  await page.getByRole('button', { name: 'Options', exact: true }).click();
  await menuAudio;
  await page.getByRole('button', { name: 'Sound: ON' }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'New Game', exact: true }).click();
  await page
    .getByRole('button', { name: 'Bỏ qua mở đầu' })
    .click({ timeout: 30000 });
  const state = page.getByTestId('game-state');
  await expect(state).toHaveAttribute('data-status', 'PLAYING', {
    timeout: 30000,
  });
  await page.keyboard.down('Space');
  await expect
    .poll(async () => Number(await state.getAttribute('data-jumps')))
    .toBeGreaterThan(0);
  await page.keyboard.up('Space');
  expect(errors).toEqual([]);
});
