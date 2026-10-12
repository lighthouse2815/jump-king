import { test, expect } from '@playwright/test';
import { exitGame } from './helpers/gameMenu';

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

for (const restriction of [
  'access-denied',
  'writes-denied',
  'quota-exceeded',
]) {
  test(`menus, gameplay and race creation work with storage ${restriction}`, async ({
    page,
  }) => {
    test.setTimeout(60000);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript((restriction) => {
      if (restriction === 'access-denied') {
        for (const name of ['localStorage', 'sessionStorage']) {
          Object.defineProperty(window, name, {
            get: () => {
              throw new DOMException('Storage access denied', 'SecurityError');
            },
          });
        }
      } else {
        Storage.prototype.setItem = () => {
          throw new DOMException(
            'Storage write failed',
            restriction === 'writes-denied'
              ? 'SecurityError'
              : 'QuotaExceededError',
          );
        };
        if (restriction === 'writes-denied')
          Storage.prototype.removeItem = () => {
            throw new DOMException('Storage access denied', 'SecurityError');
          };
      }
    }, restriction);
    await page.goto('/');
    await page.getByRole('button', { name: 'Press SPACE to start' }).click();
    await page.getByRole('button', { name: 'Options', exact: true }).click();
    await page.getByRole('button', { name: 'Sound: ON' }).click();
    await expect(
      page.getByRole('button', { name: 'Sound: OFF' }),
    ).toBeVisible();
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
    await page.keyboard.press('Escape');
    await expect(page.getByRole('alert')).toContainText(
      'Trình duyệt không cho phép lưu tiến trình.',
    );
    await exitGame(page);
    await page.goto('/race');
    await page.getByRole('button', { name: 'Create New Race' }).click();
    await expect(state).toHaveAttribute('data-status', 'PLAYING', {
      timeout: 30000,
    });
    expect(errors).toEqual([]);
  });
}
