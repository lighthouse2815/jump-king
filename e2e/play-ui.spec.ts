import { test, expect } from '@playwright/test';
import { pauseGame, openDeveloper } from './helpers/gameMenu';

test('retry remains usable after the only player leaves a failed community', async ({
  page,
}) => {
  test.setTimeout(60000);
  const asset = '**/original/screens/midground/2.png';
  await page.route(asset, (route) => route.abort());
  await page.goto('/community');
  const game = page.getByTestId('game-state');
  await expect(game).toHaveAttribute('data-status', 'ERROR', {
    timeout: 30000,
  });
  await page.unroute(asset);
  await page
    .getByRole('button', { name: 'Thử lại', exact: true })
    .click();
  await expect(game).toHaveAttribute('data-status', 'PLAYING', {
    timeout: 30000,
  });
  await expect(page.getByTestId('player-count')).toHaveText(
    '● 1 người trong phòng',
  );
});

test('a failed prefetch stays visible during room updates and retry restores playing', async ({
  page,
  browser,
}) => {
  test.setTimeout(60000);
  const asset = '**/original/screens/midground/2.png';
  await page.route(asset, (route) => route.abort());
  await page.goto('/community');
  const game = page.getByTestId('game-state');
  await expect(game).toHaveAttribute('data-status', 'ERROR', {
    timeout: 30000,
  });
  const error = page.locator('.game-status[role="alert"]');
  await expect(error).toContainText('screens/midground/2');
  const roomId = await game.getAttribute('data-room-id');
  expect(roomId).toBeTruthy();
  const peer = await browser.newContext();
  try {
    const other = await peer.newPage();
    await other.goto('/community');
    await expect(other.getByTestId('game-state')).toHaveAttribute(
      'data-status',
      'PLAYING',
      { timeout: 30000 },
    );
    await expect(page.getByTestId('player-count')).toHaveText(
      '● 2 người trong phòng',
    );
    await expect(game).toHaveAttribute('data-status', 'ERROR');
    await expect(error).toBeVisible();
    await page.unroute(asset);
    await page
      .getByRole('button', { name: 'Thử lại', exact: true })
      .click();
    await expect(game).toHaveAttribute('data-status', 'PLAYING', {
      timeout: 30000,
    });
    await expect(error).toHaveCount(0);
    await expect(game).toHaveAttribute('data-room-id', roomId!);
    await expect(other.getByTestId('player-count')).toHaveText(
      '● 2 người trong phòng',
    );
  } finally {
    await peer.close();
  }
});

test('a blocked connection shows an error and retry connects to the real server', async ({
  page,
  context,
}) => {
  test.setTimeout(60000);
  const matchmaking = '**/matchmake/joinOrCreate/original_tower';
  await page.route(matchmaking, async (route) => {
    const response = await route.fetch();
    await context.setOffline(true);
    await route.fulfill({ response });
  });
  await page.goto('/community');
  const game = page.getByTestId('game-state');
  await expect(game).toHaveAttribute('data-status', 'ERROR', {
    timeout: 30000,
  });
  await expect(page.getByRole('alert')).toContainText(
    'Không thể mở game. Hãy thử lại.',
  );
  await context.setOffline(false);
  await page.unroute(matchmaking);
  await page
    .getByRole('button', { name: 'Thử lại', exact: true })
    .click();
  await expect(game).toHaveAttribute('data-status', 'PLAYING', {
    timeout: 30000,
  });
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.keyboard.down('Space');
  await expect
    .poll(async () => Number(await game.getAttribute('data-charge')))
    .toBeGreaterThan(0.2);
  await page.keyboard.up('Space');
  await expect(game).toHaveAttribute('data-jumps', '1');
});

test('playing uses the original viewport and pause menus keep gameplay input isolated', async ({
  page,
}) => {
  await page.goto('/play');
  const game = page.getByTestId('game-state');
  await expect(game).toHaveAttribute('data-status', 'PLAYING', {
    timeout: 30000,
  });
  const bounds = (await game.boundingBox())!;
  expect(bounds.width / bounds.height).toBeCloseTo(4 / 3);
  expect(await page.locator('canvas').getAttribute('width')).toBe(
    '480',
  );
  await expect(
    page.locator(
      '.game-header, .run-panel, .game-footer, .location-bar',
    ),
  ).toHaveCount(0);
  await expect(page.getByTestId('run-clock')).toHaveCount(0);
  await page.keyboard.down('Space');
  await expect
    .poll(async () => Number(await game.getAttribute('data-charge')))
    .toBeGreaterThan(0.2);
  await page.keyboard.up('Space');
  await expect(game).toHaveAttribute('data-jumps', '1');
  const menu = await pauseGame(page);
  await expect(
    menu.getByRole('button', { name: 'Inventory' }),
  ).toBeDisabled();
  await expect(
    page.getByRole('complementary', { name: 'Session statistics' }),
  ).toContainText('Jumps: 1');
  const y = await game.getAttribute('data-y');
  await page.keyboard.press('ArrowDown');
  await expect(
    menu.getByRole('button', { name: 'Options' }),
  ).toBeFocused();
  await page.keyboard.press('Space');
  await page
    .getByRole('button', { name: 'Controls', exact: true })
    .click();
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Escape');
  await expect(game).toHaveAttribute('data-paused', 'true');
  await expect(game).toHaveAttribute('data-y', y!);
  await expect(game).toHaveAttribute('data-jumps', '1');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await expect(game).toHaveAttribute('data-paused', 'false');
  await page.keyboard.down('ArrowRight');
  await expect
    .poll(async () => Number(await game.getAttribute('data-x')))
    .toBeGreaterThan(240);
  await page.keyboard.up('ArrowRight');
});

test('typing a cheat uses normal text input and returning to game restores jump controls', async ({
  page,
}) => {
  await page.goto('/play');
  const game = page.getByTestId('game-state');
  await expect(game).toHaveAttribute('data-status', 'PLAYING', {
    timeout: 30000,
  });
  await openDeveloper(page);
  const input = page.getByLabel('Mã cheat', { exact: true });
  await input.click();
  await input.pressSequentially(' aw s ', { delay: 20 });
  await expect(input).toHaveValue(' aw s ');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('alert')).toHaveText(
    'Mã cheat không đúng.',
  );
  await expect(game).toHaveAttribute('data-jumps', '0');
  await expect(game).toHaveAttribute('data-paused', 'true');
  await input.focus();
  await page.keyboard.press('Escape');
  await expect(game).toHaveAttribute('data-paused', 'false');
  await expect(input).toHaveCount(0);
  await page.keyboard.down('Space');
  await expect
    .poll(async () => Number(await game.getAttribute('data-charge')))
    .toBeGreaterThan(0.2);
  await page.keyboard.up('Space');
  await expect(game).toHaveAttribute('data-jumps', '1');
});

test('timer and sound settings survive reload and fullscreen preserves the viewport', async ({
  page,
}) => {
  await page.goto('/play');
  const game = page.getByTestId('game-state');
  await expect(game).toHaveAttribute('data-status', 'PLAYING', {
    timeout: 30000,
  });
  const menu = await pauseGame(page);
  await menu
    .getByRole('button', { name: 'Options', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Audio', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Sound', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Sound', exact: true }),
  ).toHaveAttribute('aria-pressed', 'false');
  await page.keyboard.press('Escape');
  await page
    .getByRole('button', { name: 'Graphics', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Display Timer', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Fullscreen', exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(() => Boolean(document.fullscreenElement)),
    )
    .toBe(true);
  const bounds = (await game.boundingBox())!;
  expect(bounds.width / bounds.height).toBeCloseTo(4 / 3);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(
    await page.evaluate(() => innerHeight),
  );
  await page.evaluate(() => document.exitFullscreen());
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('run-clock')).toBeVisible();
  await page.reload();
  await expect(game).toHaveAttribute('data-status', 'PLAYING', {
    timeout: 30000,
  });
  await expect(page.getByTestId('run-clock')).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem('jumpking.muted')),
  ).toBe('true');
});

test('landscape phone keeps the game, pause menu and touch buttons within the screen', async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await page.goto('/play');
    const game = page.getByTestId('game-state');
    await expect(game).toHaveAttribute('data-status', 'PLAYING', {
      timeout: 30000,
    });
    const bounds = (await game.boundingBox())!;
    expect(bounds.width / bounds.height).toBeCloseTo(4 / 3);
    const controls = (await page
      .getByRole('group', { name: 'Điều khiển cảm ứng' })
      .boundingBox())!;
    expect(controls.y + controls.height).toBeLessThanOrEqual(390);
    await page
      .getByRole('button', { name: 'Tạm dừng', exact: true })
      .tap();
    const menu = page.getByRole('navigation', { name: 'Pause menu' });
    const menuBounds = (await menu.boundingBox())!;
    expect(menuBounds.x + menuBounds.width).toBeLessThanOrEqual(
      bounds.x + bounds.width,
    );
    expect(menuBounds.y + menuBounds.height).toBeLessThanOrEqual(
      bounds.y + bounds.height,
    );
    await menu
      .getByRole('button', { name: 'Resume', exact: true })
      .tap();
    await expect(game).toHaveAttribute('data-paused', 'false');
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  } finally {
    await context.close();
  }
});

test('Give Up confirmation restarts the current run and retains owned equipment', async ({
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
  await page.goto('/play');
  const game = page.getByTestId('game-state');
  await expect(game).toHaveAttribute('data-status', 'PLAYING', {
    timeout: 30000,
  });
  await page.keyboard.down('Space');
  await expect
    .poll(async () => Number(await game.getAttribute('data-jumps')))
    .toBe(1);
  await page.keyboard.up('Space');
  const menu = await pauseGame(page);
  await menu
    .getByRole('button', { name: 'Give Up', exact: true })
    .click();
  await page.getByRole('button', { name: 'No', exact: true }).click();
  await expect(game).toHaveAttribute('data-jumps', '1');
  await menu
    .getByRole('button', { name: 'Give Up', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Delete Save', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Bỏ qua mở đầu' }),
  ).toBeVisible({ timeout: 30000 });
  await page.getByRole('button', { name: 'Bỏ qua mở đầu' }).click();
  await expect(game).toHaveAttribute('data-status', 'PLAYING');
  await expect(game).toHaveAttribute('data-jumps', '0');
  await page.keyboard.press('Escape');
  const saved = await page.evaluate(() =>
    JSON.parse(
      localStorage.getItem('jumpking.original.v1.original')!,
    ),
  );
  expect(saved.state.adventure.inventory.Cap).toBe(1);
  expect(saved.state.adventure.equipped).toContain('Cap');
});

test('gamepad menu consumes held confirmation and resumes real game controls', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const pad = {
      connected: true,
      mapping: 'standard',
      axes: [0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false })),
    };
    (window as any).testPad = pad;
    Object.defineProperty(navigator, 'getGamepads', {
      value: () => [pad],
    });
  });
  const press = async (index: number, down: boolean) =>
    page.evaluate(
      ({ index, down }) => {
        (window as any).testPad.buttons[index].pressed = down;
      },
      { index, down },
    );
  await page.goto('/play');
  const game = page.getByTestId('game-state');
  await expect(game).toHaveAttribute('data-status', 'PLAYING', {
    timeout: 30000,
  });
  await press(9, true);
  await expect(game).toHaveAttribute('data-paused', 'true');
  await press(9, false);
  await page.waitForTimeout(100);
  await press(13, true);
  await expect(
    page
      .getByRole('navigation', { name: 'Pause menu' })
      .getByRole('button', { name: 'Options', exact: true }),
  ).toBeFocused();
  await press(13, false);
  await page.waitForTimeout(100);
  await press(0, true);
  await expect(
    page.getByRole('navigation', { name: 'Options', exact: true }),
  ).toBeVisible();
  await page.waitForTimeout(400);
  await expect(
    page.getByRole('navigation', { name: 'Graphics', exact: true }),
  ).toHaveCount(0);
  await press(0, false);
  await page.waitForTimeout(100);
  await press(0, true);
  await expect(
    page.getByRole('navigation', { name: 'Graphics', exact: true }),
  ).toBeVisible();
  await press(0, false);
  await press(9, true);
  await expect(game).toHaveAttribute('data-paused', 'false');
  await press(9, false);
  await press(0, true);
  await expect
    .poll(async () => Number(await game.getAttribute('data-jumps')))
    .toBe(1);
  await press(0, false);
  await openDeveloper(page);
  const input = page.getByLabel('Mã cheat', { exact: true });
  await input.focus();
  await press(9, true);
  await expect(game).toHaveAttribute('data-paused', 'false');
  await expect(input).toHaveCount(0);
  await press(9, false);
});
