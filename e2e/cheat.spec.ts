import { test, expect, Page } from '@playwright/test';
import { createRequire } from 'node:module';

const requireWeb = createRequire(`${process.cwd()}/apps/web/package.json`);
const requireColyseus = createRequire(requireWeb.resolve('colyseus.js'));
const nativeWebSocket = globalThis.WebSocket;
globalThis.WebSocket = requireColyseus('ws');
const { Client } = requireWeb('colyseus.js');
globalThis.WebSocket = nativeWebSocket;
const cheatCode = process.env.E2E_CHEAT_CODE || '';

async function enterRoom(page: Page, path: string) {
  await page.goto(path);
  await expect(page.locator('main')).toBeVisible();
  const nickname = page.getByRole('textbox', {
    name: 'Biệt danh',
    exact: true,
  });
  if (await nickname.isVisible()) {
    await nickname.fill('Người thử cheat');
    await page.getByRole('button', { name: 'Vào phòng', exact: true }).click();
  }
  await expect(page.getByTestId('game-state')).toHaveAttribute(
    'data-status',
    'PLAYING',
    {
      timeout: 30000,
    },
  );
}

async function openCode(page: Page) {
  const input = page.getByLabel('Mã cheat online', { exact: true });
  if (await input.isVisible()) return input;
  if (
    (await page.getByTestId('game-state').getAttribute('data-paused')) !==
    'true'
  ) {
    const menu = page.getByRole('button', { name: 'Menu', exact: true });
    if (await menu.isVisible()) await menu.click();
    else await page.keyboard.press('Escape');
  }
  await page
    .getByRole('navigation', { name: 'Pause menu', exact: true })
    .getByRole('button', { name: 'Code', exact: true })
    .click();
  await expect(input).toBeVisible();
  return input;
}

async function resume(page: Page) {
  await page.getByLabel('Mã cheat online', { exact: true }).press('Escape');
  await page
    .getByRole('navigation', { name: 'Pause menu', exact: true })
    .getByRole('button', { name: 'Resume', exact: true })
    .click();
  await expect(page.getByLabel('Mã cheat online', { exact: true })).toHaveCount(
    0,
  );
}

async function applyCode(page: Page, code: string) {
  const input = await openCode(page);
  await input.fill(code);
  await input.press('Enter');
  await expect(input).not.toBeFocused();
}

for (const mode of ['community', 'race'] as const) {
  test(`${mode}: validates cheats on the server and synchronizes flight with peers`, async ({
    page,
  }) => {
    test.setTimeout(60000);
    expect(cheatCode.length).toBeGreaterThan(0);
    const client = new Client(
      process.env.E2E_SERVER_URL || 'ws://127.0.0.1:2567',
    );
    const observer = await client.create(
      mode === 'community' ? 'original_tower' : 'original_race',
      {
        campaign: 'original',
        nickname: 'Người quan sát',
      },
    );
    const errors: string[] = [];
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    observer.onMessage('cheatError', (message: string) => errors.push(message));
    observer.onMessage('playerEffects', () => {});
    try {
      if (mode === 'community')
        await page.route('**/matchmake/joinOrCreate/original_tower', (route) =>
          route.continue({
            url: route
              .request()
              .url()
              .replace(
                '/joinOrCreate/original_tower',
                `/joinById/${observer.roomId}`,
              ),
          }),
        );
      await enterRoom(
        page,
        mode === 'community' ? '/community' : `/race/${observer.roomId}`,
      );
      const state = page.getByTestId('game-state');
      await expect.poll(() => observer.state.players.size).toBe(2);
      const actorId = [...observer.state.players.keys()].find(
        (id) => id !== observer.sessionId,
      )!;
      const snapshot = () =>
        JSON.parse(observer.state.players.get(actorId).snapshot);
      const ownSnapshot = () =>
        JSON.parse(observer.state.players.get(observer.sessionId).snapshot);

      await expect(
        page.getByLabel('Mã cheat online', { exact: true }),
      ).toHaveCount(0);
      await page.keyboard.press('Escape');
      await expect(
        page.getByRole('button', { name: 'Code', exact: true }),
      ).toBeVisible();
      await expect(
        page.getByLabel('Mã cheat online', { exact: true }),
      ).toHaveCount(0);
      await openCode(page);
      await expect(
        page.getByLabel('Mã cheat online', { exact: true }),
      ).toHaveAttribute('type', 'password');
      await expect(page.locator('.online-cheat')).not.toContainText(
        /FLY|NORMAL/,
      );
      observer.send('cheat', { code: 'FLY' });
      observer.send('cheat', 'x'.repeat(33));
      observer.send('cheat', 'FLY');
      observer.send('cheat', 'NORMAL');
      await expect.poll(() => errors.length).toBe(4);
      expect(errors.every((message) => !message.includes(cheatCode))).toBe(
        true,
      );
      expect(ownSnapshot().freeFlight).toBe(false);
      await applyCode(page, 'BAD');
      await expect(page.getByRole('alert')).toContainText(
        'Mã cheat không hợp lệ',
      );
      await expect(state).toHaveAttribute('data-free-flight', 'false');

      const xBeforeTyping = await state.getAttribute('data-x');
      const jumpsBeforeTyping = await state.getAttribute('data-jumps');
      const input = page.getByLabel('Mã cheat online', { exact: true });
      await input.fill('');
      await input.pressSequentially('wasd', { delay: 50 });
      await expect(state).toHaveAttribute('data-x', xBeforeTyping!);
      await expect(state).toHaveAttribute('data-jumps', jumpsBeforeTyping!);
      await applyCode(page, `  ${cheatCode.toLowerCase()}  `);
      await expect(state).toHaveAttribute('data-free-flight', 'true');
      await expect.poll(() => snapshot().freeFlight).toBe(true);
      expect(ownSnapshot().freeFlight).toBe(false);
      await resume(page);

      const y = Number(await state.getAttribute('data-y'));
      await page.keyboard.down('w');
      await expect
        .poll(async () => Number(await state.getAttribute('data-y')))
        .toBeLessThan(y - 40);
      await page.keyboard.up('w');
      await expect.poll(() => snapshot().y).toBeLessThan(y - 40);
      await page.waitForTimeout(500);
      const hoverY = await state.getAttribute('data-y');
      await page.waitForTimeout(700);
      await expect(state).toHaveAttribute('data-y', hoverY!);
      expect(snapshot().y).toBe(Number(hoverY));

      const x = snapshot().x;
      await page.keyboard.down('ArrowRight');
      await expect.poll(() => snapshot().x).toBeGreaterThan(x + 30);
      await page.keyboard.up('ArrowRight');
      await page.keyboard.down('s');
      await expect
        .poll(() => snapshot().y)
        .toBeGreaterThan(Number(hoverY) + 20);
      await page.keyboard.up('s');
      const fallingY = snapshot().y;
      await applyCode(page, cheatCode);
      await expect(state).toHaveAttribute('data-free-flight', 'false');
      await expect.poll(() => snapshot().freeFlight).toBe(false);
      await resume(page);
      await expect.poll(() => snapshot().y).toBeGreaterThan(fallingY + 5);

      // Vertical payloads must be boolean; malformed input cannot move a flying peer.
      observer.send('cheat', cheatCode);
      await expect.poll(() => ownSnapshot().freeFlight).toBe(true);
      const stationary = ownSnapshot().y;
      observer.send('input', {
        left: false,
        right: false,
        jump: false,
        up: 'yes',
        seq: 0,
      });
      await page.waitForTimeout(600);
      expect(ownSnapshot().y).toBe(stationary);
      // Old clients can still send inputs without the new optional axes.
      observer.send('input', { left: false, right: true, jump: false, seq: 1 });
      const previousX = ownSnapshot().x;
      await expect.poll(() => ownSnapshot().x).toBeGreaterThan(previousX);
      observer.send('input', {
        left: false,
        right: false,
        jump: false,
        down: true,
        seq: 2,
      });
      await expect.poll(() => ownSnapshot().y).toBeGreaterThan(322);
      observer.send('input', {
        left: false,
        right: false,
        jump: false,
        seq: 3,
      });
      observer.send('cheat', cheatCode);
      await expect.poll(() => errors.length).toBe(5);
      expect(errors[4]).toContain('bay ra khỏi địa hình');
      expect(ownSnapshot().freeFlight).toBe(true);
      observer.send('input', {
        left: false,
        right: false,
        jump: false,
        up: true,
        seq: 4,
      });
      await expect.poll(() => ownSnapshot().y).toBeLessThan(290);
      observer.send('cheat', cheatCode);
      await expect.poll(() => ownSnapshot().freeFlight).toBe(false);
      await page.reload();
      await enterRoom(page, new URL(page.url()).pathname);
      await expect(page.getByTestId('game-state')).toHaveAttribute(
        'data-free-flight',
        'false',
      );
      expect(pageErrors).toEqual([]);
    } finally {
      await observer.leave();
    }
  });
}

test('mobile flight exposes up/down controls and solo has no online cheat form', async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await enterRoom(page, '/community');
    expect(cheatCode.length).toBeGreaterThan(0);
    await applyCode(page, cheatCode);
    await resume(page);
    const state = page.getByTestId('game-state');
    await expect(state).toHaveAttribute('data-free-flight', 'true');
    const up = page.getByRole('button', { name: 'Bay lên', exact: true });
    const down = page.getByRole('button', { name: 'Bay xuống', exact: true });
    await expect(up).toBeVisible();
    await expect(down).toBeVisible();
    const y = Number(await state.getAttribute('data-y'));
    const bounds = (await up.boundingBox())!;
    const session = await context.newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [
        { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 },
      ],
    });
    await expect
      .poll(async () => Number(await state.getAttribute('data-y')))
      .toBeLessThan(y - 10);
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    await applyCode(page, cheatCode);
    await resume(page);
    await expect(
      page.getByRole('button', { name: 'Giữ để nhảy' }),
    ).toBeVisible();
    await page.goto('/play');
    await expect(page.getByTestId('game-state')).toHaveAttribute(
      'data-status',
      'PLAYING',
      { timeout: 30000 },
    );
    await expect(
      page.getByLabel('Mã cheat online', { exact: true }),
    ).toHaveCount(0);
  } finally {
    await context.close();
  }
});
