import { test, expect, Page } from '@playwright/test';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { OriginalSimulation } from '../packages/physics/src';
import { ORIGINAL_SCREENS } from '../packages/maps/src';

const { PNG } = createRequire(`${process.cwd()}/package.json`)('pngjs');
test.skip(
  !!process.env.E2E_BASE_URL,
  'Inspects local Phaser rendering and source pixels.',
);

async function openWeather(page: Page, screen: number) {
  const state = new OriginalSimulation(
    ORIGINAL_SCREENS,
    screen === 8 ? 20 : 240,
    (screen === 8 ? 50 : 250) - screen * 360,
  ).getState();
  await page.goto('/');
  await page.evaluate(
    (state) =>
      localStorage.setItem(
        'jumpking.original.v1.original',
        JSON.stringify({
          version: 1,
          campaign: 'original',
          state,
          bestScreen: state.screen,
          completed: false,
        }),
      ),
    state,
  );
  await page.goto('/play');
  await expect(page.getByTestId('game-state')).toHaveAttribute(
    'data-status',
    'PLAYING',
    { timeout: 30000 },
  );
}

async function weatherView(page: Page, name: string) {
  return page.evaluate((name) => {
    const scene = (window as any).Phaser.Display.Canvas.CanvasPool.pool
      .map((entry: any) => entry.parent?.scene)
      .find((scene: any) => scene?.sys?.settings?.key === 'OriginalScene');
    const weather = scene.children.list.find((child: any) =>
      child.displayTexture?.key.startsWith(`particles/${name}/`),
    );
    const mask = weather.mask?.bitmapMask;
    return {
      texture: mask?.texture.key,
      width: mask?.displayWidth,
      height: mask?.displayHeight,
      inverted: weather.mask?.invertAlpha,
      wind: weather.tilePositionX,
    };
  }, name);
}

test('masks rain using original alpha, including transparent and visible pixels', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await openWeather(page, 8);
  expect(await weatherView(page, 'light_rain')).toMatchObject({
    texture: 'screens/masks/light_rainmask9',
    width: 480,
    height: 360,
    inverted: false,
  });
  const mask = PNG.sync.read(
    readFileSync('apps/web/public/original/screens/masks/light_rainmask9.png'),
  );
  const rain = PNG.sync.read(
    readFileSync(
      'apps/web/public/original/particles/light_rain/light_rain0.png',
    ),
  );
  const pixels: { x: number; y: number }[] = [];
  for (const alpha of [0, 255]) {
    outer: for (let y = 0; y < mask.height; y++)
      for (let x = 0; x < mask.width; x++) {
        if (
          mask.data[(y * mask.width + x) * 4 + 3] === alpha &&
          rain.data[
            ((y % rain.height) * rain.width + (x % rain.width)) * 4 + 3
          ] > 0
        ) {
          pixels.push({ x, y });
          break outer;
        }
      }
  }
  expect(pixels).toHaveLength(2);
  const colors = await page.evaluate(async (pixels) => {
    const scene = (window as any).Phaser.Display.Canvas.CanvasPool.pool
      .map((entry: any) => entry.parent?.scene)
      .find((scene: any) => scene?.sys?.settings?.key === 'OriginalScene');
    const weather = scene.children.list.find((child: any) =>
      child.displayTexture?.key.startsWith('particles/light_rain/'),
    );
    scene.scene.pause();
    for (const child of scene.children.list)
      child.setVisible(child === weather);
    weather.setTexture('particles/light_rain/light_rain0');
    scene.cameras.main.setBackgroundColor('#ff0000');
    const colors = [];
    for (const pixel of pixels) {
      colors.push(
        await new Promise((resolve) =>
          // Phaser's snapshotPixel maps y to bufferHeight - y rather than - y - 1.
          scene.game.renderer.snapshotPixel(pixel.x, pixel.y + 1, (color: any) =>
            resolve({ r: color.r, g: color.g, b: color.b }),
          ),
        ),
      );
    }
    return colors;
  }, pixels);
  expect(colors[0]).toEqual({ r: 255, g: 0, b: 0 });
  expect(colors[1]).not.toEqual({ r: 255, g: 0, b: 0 });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Press SPACE to start' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('expands a one-pixel snow mask and moves its texture with the shared wind', async ({
  page,
}) => {
  await openWeather(page, 26);
  await expect
    .poll(() => weatherView(page, 'snow'))
    .toMatchObject({
      texture: 'screens/masks/snowmask27',
      width: 480,
      height: 360,
    });
  await expect
    .poll(async () => (await weatherView(page, 'snow')).wind)
    .not.toBe(0);
});
