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
      const observed = {
        scene: this,
        frames: new Set<string>(),
        sounds: [] as { key: string; volume: number }[],
      };
      Object.assign(window, { peerPresentationTest: observed });
      const addSound = this.sound.add;
      this.sound.add = function (...args: unknown[]) {
        const sound = addSound.apply(this, args);
        sound.on('play', () => {
          if (!this.mute)
            observed.sounds.push({
              key: sound.key,
              volume: sound.currentConfig.volume,
            });
        });
        return sound;
      };
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

async function soundCount(page: Page, key: string, volume: number) {
  return page.evaluate(
    ({ key, volume }) =>
      (window as any).peerPresentationTest.sounds.filter(
        (sound: any) =>
          sound.key === key && Math.abs(sound.volume - volume) < 0.000001,
      ).length,
    { key, volume },
  );
}

for (const mode of ['community', 'race']) {
  test(`${mode} peers animate and play nearby movement sounds from real inputs`, async ({
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
      await observeScene(actor);
      if (mode === 'race') {
        await actor
          .getByRole('button', { name: 'Race Arena', exact: true })
          .click();
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
        await actor
          .getByRole('button', { name: 'Community Tower', exact: true })
          .click();
        await playing(actor);
        await observer
          .getByRole('button', { name: 'Community Tower', exact: true })
          .click();
      }
      await playing(observer);
      await observer.locator('canvas').click();
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
        .poll(() => soundCount(observer, 'audio/jump_king/king_jump', 0.45))
        .toBe(1);
      expect(await soundCount(actor, 'audio/jump_king/king_jump', 0.65)).toBe(
        1,
      );
      await expect
        .poll(() =>
          observer.evaluate(() =>
            (window as any).peerPresentationTest.frames.has('up'),
          ),
        )
        .toBe(true);
      await expect
        .poll(() => soundCount(observer, 'audio/jump_king/king_land', 0.45))
        .toBe(1);
      await observer.keyboard.press('Escape');
      await observer
        .getByRole('button', { name: 'Options', exact: true })
        .click();
      await observer
        .getByRole('button', { name: 'Audio', exact: true })
        .click();
      await observer
        .getByRole('button', { name: 'Sound', exact: true })
        .click();
      await expect(
        observer.getByRole('button', { name: 'Sound', exact: true }),
      ).toHaveAttribute('aria-pressed', 'false');
      await actor.keyboard.down('Space');
      await expect(actor.getByTestId('game-state')).toHaveAttribute(
        'data-charge',
        /[1-9]/,
      );
      await actor.keyboard.up('Space');
      await expect(actor.getByTestId('game-state')).toHaveAttribute(
        'data-jumps',
        '2',
      );
      await expect
        .poll(() =>
          observer.evaluate(() => {
            const scene = (window as any).peerPresentationTest.scene;
            return [...scene.room.state.players.entries()]
              .filter(([id]) => id !== scene.room.sessionId)
              .every(
                ([, player]: any) => JSON.parse(player.snapshot).jumps === 2,
              );
          }),
        )
        .toBe(true);
      expect(
        await soundCount(observer, 'audio/jump_king/king_jump', 0.45),
      ).toBe(1);
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
