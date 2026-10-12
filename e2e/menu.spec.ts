import { exitGame, setNickname } from './helpers/gameMenu';
import { test, expect, Page } from '@playwright/test';
import { OriginalSimulation } from '../packages/physics/src';
import {
  CAMPAIGNS,
  CampaignId,
  ORIGINAL_SCREENS,
} from '../packages/maps/src';

async function menu(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Press SPACE to start' }).click();
  return page.getByRole('navigation', { name: 'Main menu', exact: true });
}

function save(campaign: CampaignId, jumps: number) {
  const c = CAMPAIGNS[campaign];
  const simulation = new OriginalSimulation(
    ORIGINAL_SCREENS,
    c.spawnX,
    c.spawnY - c.startScreen * 360,
  );
  const state = simulation.getState();
  state.jumps = jumps;
  return {
    version: 1,
    campaign,
    state,
    bestScreen: c.startScreen,
    completed: false,
  };
}

test('title supports keyboard navigation, nested menus and returning to the prompt', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.keyboard.press('Space');
  const main = page.getByRole('navigation', {
    name: 'Main menu',
    exact: true,
  });
  await expect(
    main.getByRole('button', { name: 'New Game' }),
  ).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  const babes = page.getByRole('navigation', {
    name: 'Other Babes',
    exact: true,
  });
  await expect(
    babes.getByRole('button', { name: 'New Babe+' }),
  ).toBeFocused();
  await expect(
    main.getByRole('button', { name: 'New Game' }),
  ).toBeDisabled();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Space');
  await expect(
    page.getByRole('navigation', { name: 'Campaign menu' }),
  ).toBeVisible();
  await expect(page.locator('.title-menu-note')).toHaveText(
    'Ghost of the Babe',
  );
  await page.keyboard.press('Escape');
  await expect(
    babes.getByRole('button', { name: 'Ghost of the Babe' }),
  ).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(
    main.getByRole('button', { name: 'Other Babes' }),
  ).toBeFocused();
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowUp');
  await expect(main.getByRole('button', { name: 'Quit' })).toBeFocused();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Return to title' }).click();
  await expect(
    page.getByRole('button', { name: 'Press SPACE to start' }),
  ).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(main).toBeVisible();
  expect(errors).toEqual([]);
});

test('new game confirmation protects saves and replaces only the selected campaign', async ({
  page,
}) => {
  const original = JSON.stringify(save('original', 19));
  const nbp = JSON.stringify(save('nbp', 31));
  await page.goto('/');
  await page.evaluate(
    ({ original, nbp }) => {
      localStorage.setItem('jumpking.original.v1.original', original);
      localStorage.setItem('jumpking.original.v1.nbp', nbp);
    },
    { original, nbp },
  );
  await page.reload();
  await page.getByRole('button', { name: 'Press SPACE to start' }).click();
  const main = page.getByRole('navigation', {
    name: 'Main menu',
    exact: true,
  });
  await expect(
    main.getByRole('button', { name: 'Continue' }),
  ).toBeVisible();
  await expect(
    page.getByRole('complementary', { name: 'Saved session' }),
  ).toContainText('Jumps: 19');
  await main.getByRole('button', { name: 'New Game' }).click();
  await page.getByRole('button', { name: 'No', exact: true }).click();
  expect(
    await page.evaluate(() =>
      localStorage.getItem('jumpking.original.v1.original'),
    ),
  ).toBe(original);
  await main.getByRole('button', { name: 'Other Babes' }).click();
  await page.getByRole('button', { name: 'New Babe+' }).click();
  await page
    .getByRole('navigation', { name: 'Campaign menu' })
    .getByRole('button', { name: 'New Game' })
    .click();
  await expect(page.locator('.title-menu-note')).toHaveText(
    'Replace the saved New Babe+ game?',
  );
  await page.getByRole('button', { name: 'Yes', exact: true }).click();
  await expect(page).toHaveURL(/campaign=nbp&new=1/);
  await expect(
    page.getByRole('button', { name: 'Bỏ qua mở đầu' }),
  ).toBeVisible({ timeout: 30000 });
  expect(
    await page.evaluate(() =>
      localStorage.getItem('jumpking.original.v1.original'),
    ),
  ).toBe(original);
  await page.getByRole('button', { name: 'Bỏ qua mở đầu' }).click();
  await expect(page.getByTestId('game-state')).toHaveAttribute(
    'data-jumps',
    '0',
  );
  await page.keyboard.press('Escape');
  await exitGame(page);
  await expect(
    page.getByRole('complementary', { name: 'Saved session' }),
  ).toContainText('New Babe+');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page).toHaveURL(/campaign=nbp$/);
  await expect(page.getByTestId('game-state')).toHaveAttribute(
    'data-status',
    'PLAYING',
    { timeout: 30000 },
  );
});

test('options persist sound, extras show real totals and fullscreen keeps the 4:3 stage centered', async ({
  page,
}) => {
  await menu(page);
  await page.getByRole('button', { name: 'Options', exact: true }).click();
  await page.getByRole('button', { name: 'Sound: ON' }).click();
  await expect(
    page.getByRole('button', { name: 'Sound: OFF' }),
  ).toBeFocused();
  await page.keyboard.press('Space');
  await expect(
    page.getByRole('button', { name: 'Sound: ON' }),
  ).toBeFocused();
  await page.keyboard.press('Space');
  expect(
    await page.evaluate(() => localStorage.getItem('jumpking.muted')),
  ).toBe('true');
  await page
    .getByRole('button', { name: 'Fullscreen', exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => Boolean(document.fullscreenElement)))
    .toBe(true);
  const stage = await page.getByTestId('title-stage').boundingBox();
  const viewport = await page.locator('.title-viewport').boundingBox();
  expect(stage!.width / stage!.height).toBeCloseTo(4 / 3);
  expect(stage!.x + stage!.width).toBeLessThanOrEqual(viewport!.width + 1);
  expect(stage!.y + stage!.height).toBeLessThanOrEqual(
    viewport!.height + 1,
  );
  await page.evaluate(() => document.exitFullscreen());
  await page.getByRole('button', { name: 'Controls', exact: true }).click();
  await expect(
    page.getByRole('navigation', { name: 'Controls' }),
  ).toContainText('Jump: hold / release SPACE');
  await page.keyboard.press('Escape');
  await page.reload();
  await page.getByRole('button', { name: 'Options', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Sound: OFF' }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await page.evaluate(() =>
    localStorage.setItem(
      'jumpking.progress.v1',
      JSON.stringify({
        version: 1,
        inventory: {},
        equipped: [],
        flags: [],
        achievements: {
          version: 1,
          unlocked: [],
          totals: { ticks: 3660, jumps: 72, falls: 9 },
          run: null,
        },
      }),
    ),
  );
  await page.getByRole('button', { name: 'Extras', exact: true }).click();
  await page
    .getByRole('button', { name: 'Total Stats', exact: true })
    .click();
  await expect(
    page.getByRole('navigation', { name: 'Total Stats' }),
  ).toContainText('Achievements: 0 / 48');
  await expect(
    page.getByRole('navigation', { name: 'Total Stats' }),
  ).toContainText('Time: 0:01:01');
  await expect(
    page.getByRole('navigation', { name: 'Total Stats' }),
  ).toContainText('Jumps: 72');
  await expect(
    page.getByRole('navigation', { name: 'Total Stats' }),
  ).toContainText('Falls: 9');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Credits', exact: true }).click();
  await expect(
    page.getByRole('navigation', { name: 'Credits' }),
  ).toContainText('Nexile');
});

test('menu music loops and all menu sounds stop when gameplay opens', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const tracked: HTMLAudioElement[] = [];
    (
      window as typeof window & { menuAudio: HTMLAudioElement[] }
    ).menuAudio = tracked;
    const NativeAudio = window.Audio;
    window.Audio = class extends NativeAudio {
      constructor(src?: string) {
        super(src);
        tracked.push(this);
      }
    };
  });
  const main = await menu(page);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const list = (
          window as typeof window & { menuAudio: HTMLAudioElement[] }
        ).menuAudio;
        return list.some(
          (audio) => audio.src.includes('menu_intro.ogg') && !audio.paused,
        );
      }),
    )
    .toBe(true);
  // Play the real intro faster; its native ended event must start the loop.
  await page.evaluate(() => {
    const list = (
      window as typeof window & { menuAudio: HTMLAudioElement[] }
    ).menuAudio;
    const intro = list.find(
      (audio) => audio.src.includes('menu_intro.ogg') && !audio.paused,
    )!;
    intro.playbackRate = 8;
  });
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const list = (
            window as typeof window & { menuAudio: HTMLAudioElement[] }
          ).menuAudio;
          return list.some(
            (audio) =>
              audio.src.includes('menu_loop.ogg') &&
              audio.loop &&
              !audio.paused,
          );
        }),
      { timeout: 20000 },
    )
    .toBe(true);
  await main.getByRole('button', { name: 'New Game' }).click();
  await expect(
    page.getByRole('button', { name: 'Bỏ qua mở đầu' }),
  ).toBeVisible({ timeout: 30000 });
  expect(
    await page.evaluate(() => {
      const list = (
        window as typeof window & { menuAudio: HTMLAudioElement[] }
      ).menuAudio;
      return list
        .filter((audio) =>
          /menu_(intro|loop)|gui_sfx|press_start/.test(audio.src),
        )
        .every((audio) => audio.paused);
    }),
  ).toBe(true);
});

test('phone title and deepest menus fit the screen and support touch', async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await page.goto('/');
    await page.getByRole('button', { name: 'Press SPACE to start' }).tap();
    await page.getByRole('button', { name: 'Extras', exact: true }).tap();
    await page.getByRole('button', { name: 'Credits', exact: true }).tap();
    const viewport = (await page.locator('.title-viewport').boundingBox())!;
    const credits = (await page
      .getByRole('navigation', { name: 'Credits' })
      .boundingBox())!;
    expect(credits.x + credits.width).toBeLessThanOrEqual(
      viewport.x + viewport.width,
    );
    expect(credits.y + credits.height).toBeLessThanOrEqual(
      viewport.y + viewport.height,
    );
    await page
      .getByRole('navigation', { name: 'Credits' })
      .getByRole('button', { name: 'Back' })
      .tap();
    await page
      .getByRole('navigation', { name: 'Extras' })
      .getByRole('button', { name: 'Back' })
      .tap();
    await page
      .getByRole('button', { name: 'Other Babes', exact: true })
      .tap();
    await page
      .getByRole('button', { name: 'Ghost of the Babe', exact: true })
      .tap();
    await page
      .getByRole('navigation', { name: 'Campaign menu' })
      .getByRole('button', { name: 'New Game' })
      .tap();
    await expect(page).toHaveURL(/campaign=ghost&new=1/);
    await expect(
      page.getByRole('button', { name: 'Bỏ qua mở đầu' }),
    ).toBeVisible({ timeout: 30000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  } finally {
    await context.close();
  }
});

test('Play Online enters the existing community and race modes', async ({
  page,
}) => {
  const main = await menu(page);
  await main.getByRole('button', { name: 'Play Online' }).click();
  await page
    .getByRole('button', { name: 'Community Tower', exact: true })
    .click();
  await expect(page).toHaveURL(/\/community$/);
  await setNickname(page);
  await expect(page.getByTestId('game-state')).toHaveAttribute(
    'data-status',
    'PLAYING',
    { timeout: 30000 },
  );
  await exitGame(page);
  await page.getByRole('button', { name: 'Play Online' }).click();
  await page
    .getByRole('button', { name: 'Race Arena', exact: true })
    .click();
  await expect(page).toHaveURL(/\/race$/);
  await setNickname(page);
  await expect(
    page.getByRole('button', { name: 'Create New Race' }),
  ).toBeVisible();
});
