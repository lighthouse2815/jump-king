import { test, expect, Page } from '@playwright/test';
import { OriginalSimulation } from '../packages/physics/src';
import { ORIGINAL_SCREENS } from '../packages/maps/src';

async function openGame(page: Page, path = '/play') {
  await page.goto(path);
  await expect(page.getByTestId('game-state')).toHaveAttribute(
    'data-status',
    'PLAYING',
    { timeout: 30000 }
  );
}

test('plays without a game server, pauses, saves and continues after reload', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**:2567/**', (route) => route.abort());
  await page.goto('/');
  await page.getByRole('button', { name: /Game mới/ }).click();
  await expect(page.getByTestId('game-state')).toHaveAttribute(
    'data-status',
    'PLAYING',
    { timeout: 30000 }
  );
  const state = page.getByTestId('game-state');
  await page.keyboard.down('ArrowRight');
  await expect
    .poll(async () => Number(await state.getAttribute('data-x')))
    .toBeGreaterThan(245);
  await page.keyboard.up('ArrowRight');
  await page.keyboard.down('Space');
  await expect
    .poll(async () => Number(await state.getAttribute('data-charge')))
    .toBeGreaterThan(0.2);
  await page.keyboard.up('Space');
  await expect
    .poll(async () => Number(await state.getAttribute('data-jumps')))
    .toBe(1);
  await expect
    .poll(async () => Number(await state.getAttribute('data-y')))
    .toBeLessThan(295);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Tạm dừng' })).toBeVisible();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('jumpking.original.v1.original')!)
  );
  expect(saved.state.jumps).toBe(1);
  const before = await state.getAttribute('data-y');
  await page.waitForTimeout(250);
  expect(await state.getAttribute('data-y')).toBe(before);
  await page.reload();
  await expect(state).toHaveAttribute('data-status', 'PLAYING', {
    timeout: 30000,
  });
  await expect(state).toHaveAttribute('data-jumps', '1');
  await page.getByRole('link', { name: /JUMP KING/ }).click();
  await expect(page.getByRole('button', { name: /Tiếp tục/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test('jumps across the original screen boundary and loads the next screen', async ({
  page,
}) => {
  const simulation = new OriginalSimulation(ORIGINAL_SCREENS, 231, 14);
  for (let i = 0; i < 30; i++)
    simulation.tick({ left: false, right: false, jump: false });
  await page.goto('/');
  await page.evaluate(
    (state) =>
      localStorage.setItem(
        'jumpking.original.v1.original',
        JSON.stringify({
          version: 1,
          campaign: 'original',
          state,
          bestScreen: 0,
          completed: false,
        })
      ),
    simulation.getState()
  );
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await openGame(page);
  await page.keyboard.down('Space');
  await expect(page.locator('.location-bar')).toContainText('MÀN 02');
  await page.keyboard.up('Space');
  expect(errors).toEqual([]);
});

test('landing at the original finish saves completion and shows the ending', async ({
  page,
}) => {
  const simulation = new OriginalSimulation(
    ORIGINAL_SCREENS,
    336,
    110 - 42 * 360
  );
  for (let i = 0; i < 30; i++)
    simulation.tick({ left: false, right: false, jump: false });
  await page.goto('/');
  await page.evaluate(
    (state) =>
      localStorage.setItem(
        'jumpking.original.v1.original',
        JSON.stringify({
          version: 1,
          campaign: 'original',
          state,
          bestScreen: 42,
          completed: false,
        })
      ),
    simulation.getState()
  );
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/play');
  await expect(page.getByTestId('game-state')).toHaveAttribute(
    'data-status',
    'COMPLETE',
    { timeout: 30000 }
  );
  await expect(
    page.getByRole('heading', { name: 'Chinh phục đỉnh tháp' })
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('jumpking.original.v1.original')!)
          .completed
    )
  ).toBe(true);
  expect(errors).toEqual([]);
});

test('automatically releases a full charge and handles repeated scene mounting', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await openGame(page);
  await page.keyboard.down('Space');
  await expect
    .poll(async () =>
      Number(await page.getByTestId('game-state').getAttribute('data-jumps'))
    )
    .toBe(1);
  await page.keyboard.up('Space');
  await page.getByRole('link', { name: /JUMP KING/ }).click();
  await page.getByRole('button', { name: /Tiếp tục/ }).click();
  await expect(page.getByTestId('game-state')).toHaveAttribute(
    'data-status',
    'PLAYING'
  );
  await expect(page.locator('canvas')).toHaveCount(1);
  expect(errors).toEqual([]);
});

for (const campaign of ['nbp', 'ghost']) {
  test(`loads the original ${campaign} campaign with its actual assets`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await openGame(page, `/play?campaign=${campaign}`);
    await page.keyboard.down('Space');
    await expect
      .poll(async () =>
        Number(await page.getByTestId('game-state').getAttribute('data-jumps'))
      )
      .toBe(1);
    await page.keyboard.up('Space');
    expect(errors).toEqual([]);
  });
}

test('touch controls move and jump without overflowing a phone screen', async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await openGame(page);
    const right = page.getByRole('button', { name: 'Đi sang phải' });
    await expect(right).toBeVisible();
    const session = await context.newCDPSession(page);
    const rightBox = (await right.boundingBox())!;
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [
        {
          x: rightBox.x + rightBox.width / 2,
          y: rightBox.y + rightBox.height / 2,
          id: 1,
        },
      ],
    });
    await expect
      .poll(async () =>
        Number(await page.getByTestId('game-state').getAttribute('data-x'))
      )
      .toBeGreaterThan(240);
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    const jump = page.getByRole('button', { name: 'Giữ để nhảy' });
    const jumpBox = (await jump.boundingBox())!;
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [
        {
          x: jumpBox.x + jumpBox.width / 2,
          y: jumpBox.y + jumpBox.height / 2,
          id: 2,
        },
      ],
    });
    await expect
      .poll(async () =>
        Number(await page.getByTestId('game-state').getAttribute('data-charge'))
      )
      .toBeGreaterThan(0.2);
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    await expect
      .poll(async () =>
        Number(await page.getByTestId('game-state').getAttribute('data-jumps'))
      )
      .toBe(1);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBe(true);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test('community players are synchronized and leaving removes the session', async ({
  browser,
}) => {
  const first = await browser.newContext(),
    second = await browser.newContext();
  try {
    const p1 = await first.newPage(),
      p2 = await second.newPage();
    const errors: string[] = [];
    for (const page of [p1, p2])
      page.on('pageerror', (error) => errors.push(error.message));
    await openGame(p1, '/community');
    await openGame(p2, '/community');
    await expect(p1.getByTestId('player-count')).toHaveText(
      '● 2 người trong phòng'
    );
    await expect(p2.getByTestId('player-count')).toHaveText(
      '● 2 người trong phòng'
    );
    await p1.keyboard.down('Space');
    await expect
      .poll(async () =>
        Number(await p1.getByTestId('game-state').getAttribute('data-charge'))
      )
      .toBeGreaterThan(0.2);
    await p1.keyboard.up('Space');
    await expect
      .poll(async () =>
        Number(await p1.getByTestId('game-state').getAttribute('data-jumps'))
      )
      .toBe(1);
    await p2.getByRole('link', { name: /JUMP KING/ }).click();
    await expect(p1.getByTestId('player-count')).toHaveText(
      '● 1 người trong phòng'
    );
    expect(errors).toEqual([]);
  } finally {
    await first.close();
    await second.close();
  }
});

test('a race starts only when both players are ready and accepts actual jumps', async ({
  browser,
}) => {
  const first = await browser.newContext(),
    second = await browser.newContext();
  try {
    const p1 = await first.newPage(),
      p2 = await second.newPage();
    const errors: string[] = [];
    for (const page of [p1, p2])
      page.on('pageerror', (error) => errors.push(error.message));
    await p1.goto('/race');
    await p1.getByRole('button', { name: 'Create New Race' }).click();
    await p1.waitForURL(/\/race\/.+/);
    await openGame(p2, new URL(p1.url()).pathname);
    await expect(p1.getByTestId('game-state')).toHaveAttribute(
      'data-status',
      'PLAYING'
    );
    await p1.keyboard.down('ArrowRight');
    await p1.waitForTimeout(200);
    await p1.keyboard.up('ArrowRight');
    expect(
      Number(await p1.getByTestId('game-state').getAttribute('data-x'))
    ).toBe(231);
    await p1.getByRole('button', { name: 'Ready Up' }).click();
    await expect(p1.getByTestId('race-status')).toHaveText('WAITING');
    await p2.getByRole('button', { name: 'Ready Up' }).click();
    await expect(p1.getByTestId('race-status')).toHaveText('RUNNING', {
      timeout: 10000,
    });
    await expect(p2.getByTestId('race-status')).toHaveText('RUNNING');
    await p1.keyboard.down('Space');
    await expect
      .poll(async () =>
        Number(await p1.getByTestId('game-state').getAttribute('data-jumps'))
      )
      .toBe(1);
    await p1.keyboard.up('Space');
    expect(errors).toEqual([]);
  } finally {
    await first.close();
    await second.close();
  }
});
