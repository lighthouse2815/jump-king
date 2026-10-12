import { test, expect, Page } from '@playwright/test';

test.skip(
  !!process.env.E2E_BASE_URL &&
    !/localhost|127\.0\.0\.1/.test(process.env.E2E_BASE_URL),
  'Observes the real Phaser scene through development modules.',
);

async function observeScene(page: Page) {
  await page.goto('/');
  await page.evaluate(async () => {
    const loadModule = new Function('url', 'return import(url)');
    const source = await (
      await fetch('/src/pages/OriginalGamePage.tsx')
    ).text();
    const url = source.match(
      /from ["']([^"']*\/game\/scenes\/OriginalScene\.ts[^"']*)["']/,
    )![1];
    const { OriginalScene } = await loadModule(url);
    const create = OriginalScene.prototype.create;
    OriginalScene.prototype.create = function () {
      const observed = { scene: this, frames: new Set<string>() };
      Object.assign(window, { peerPresentationTest: observed });
      this.events.on('postupdate', () => {
        for (const sprite of this.peers.values())
          observed.frames.add(sprite.frame.name);
      });
      return create.call(this);
    };
  });
  await page.getByRole('button', { name: 'Press SPACE to start' }).click();
  await page.getByRole('button', { name: 'Play Online', exact: true }).click();
}

async function playing(page: Page) {
  await expect(page.getByTestId('game-state')).toHaveAttribute(
    'data-status',
    'PLAYING',
    { timeout: 30000 },
  );
}

for (const mode of ['community', 'race']) {
  test(`${mode} peers animate walking, charging and jumping from real inputs`, async ({
    browser,
  }) => {
    test.setTimeout(90000);
    const first = await browser.newContext(),
      second = await browser.newContext();
    try {
      const actor = await first.newPage(),
        observer = await second.newPage();
      const errors: string[] = [];
      for (const page of [actor, observer])
        page.on('pageerror', (error) => errors.push(error.message));
      await observeScene(observer);
      if (mode === 'race') {
        await actor.goto('/race');
        await actor.getByRole('button', { name: 'Create New Race' }).click();
        await playing(actor);
        await observer
          .getByRole('button', { name: 'Race Arena', exact: true })
          .click();
        await observer
          .getByPlaceholder('Room Code')
          .fill(new URL(actor.url()).pathname.split('/').pop()!);
        await observer
          .getByRole('button', { name: 'Join', exact: true })
          .click();
      } else {
        await actor.goto('/community');
        await playing(actor);
        await observer
          .getByRole('button', { name: 'Community Tower', exact: true })
          .click();
      }
      await playing(observer);
      await expect(observer.getByTestId('player-count')).toHaveText(
        '● 2 người trong phòng',
      );
      if (mode === 'race') {
        await actor.getByRole('button', { name: 'Ready Up' }).click();
        await observer.getByRole('button', { name: 'Ready Up' }).click();
        await expect(observer.getByTestId('race-status')).toHaveText(
          'RUNNING',
          { timeout: 10000 },
        );
      }
      await actor.keyboard.down('ArrowRight');
      await expect
        .poll(() =>
          observer.evaluate(() => {
            const test = (window as any).peerPresentationTest;
            return test.frames.has('walk_one') && test.frames.has('walk_two');
          }),
        )
        .toBe(true);
      await actor.keyboard.up('ArrowRight');
      await expect
        .poll(() =>
          observer.evaluate(() =>
            [
              ...(window as any).peerPresentationTest.scene.peers.values(),
            ].every((sprite: any) => sprite.frame.name === 'idle'),
          ),
        )
        .toBe(true);
      await actor.keyboard.down('Space');
      await expect
        .poll(() =>
          observer.evaluate(() =>
            (window as any).peerPresentationTest.frames.has('charge'),
          ),
        )
        .toBe(true);
      await actor.keyboard.up('Space');
      await expect
        .poll(() =>
          observer.evaluate(() =>
            (window as any).peerPresentationTest.frames.has('up'),
          ),
        )
        .toBe(true);
      await expect
        .poll(() =>
          observer.evaluate(() =>
            (window as any).peerPresentationTest.frames.has('fall'),
          ),
        )
        .toBe(true);
      expect(errors).toEqual([]);
    } finally {
      await first.close();
      await second.close();
    }
  });
}
