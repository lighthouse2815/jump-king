import { test, expect } from '@playwright/test';

test('keyboard gameplay and menus work when gamepad access is denied', async ({
  page,
  browserName,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/*', async (route) => {
    if (route.request().resourceType() !== 'document') {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: { ...response.headers(), 'permissions-policy': 'gamepad=()' },
    });
  });
  if (browserName === 'firefox')
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'getGamepads', {
        value: () => {
          throw new DOMException('Gamepad access denied', 'SecurityError');
        },
      });
    });
  await page.goto('/');
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('navigation', { name: 'Main menu', exact: true }),
  ).toBeVisible();
  await page.goto('/play');
  const state = page.getByTestId('game-state');
  await expect(state).toHaveAttribute('data-status', 'PLAYING', {
    timeout: 30000,
  });
  await page.keyboard.down('Space');
  await expect
    .poll(async () => Number(await state.getAttribute('data-jumps')))
    .toBeGreaterThan(0);
  await page.keyboard.up('Space');
  await page.keyboard.press('Escape');
  await expect(state).toHaveAttribute('data-paused', 'true');
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await expect(state).toHaveAttribute('data-paused', 'false');
  expect(errors).toEqual([]);
});
