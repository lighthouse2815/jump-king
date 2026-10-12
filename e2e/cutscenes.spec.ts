import { test, expect, Page } from '@playwright/test';
test.skip(
  !!process.env.E2E_BASE_URL &&
    !/localhost|127\.0\.0\.1/.test(process.env.E2E_BASE_URL),
  'The Phaser harness loads source modules from the development server.',
);

// Runs the helper in a real Phaser scene without depending on its parent integration.
async function mount(
  page: Page,
  campaign = 'original',
  equipped: string[] = [],
  tsuchinokoDone = false,
) {
  await page.goto('/');
  const loaded = await page.evaluate(
    async ({ campaign, equipped, tsuchinokoDone }) => {
      const loadModule = new Function('url', 'return import(url)');
      try {
        const module = await loadModule('/src/game/OriginalCutscenes.ts');
        const source = await (
          await fetch('/src/game/OriginalCutscenes.ts')
        ).text();
        const phaserUrl = source.match(
          /from ["']([^"']*phaser\.js[^"']*)["']/,
        )![1];
        const Phaser = (await loadModule(phaserUrl)).default;
        const manifest = await (await fetch('/original/manifest.json')).json();
        return await new Promise<{ ready: boolean }>((resolve) => {
          new Phaser.Game({
            type: Phaser.CANVAS,
            width: 480,
            height: 360,
            scene: {
              preload() {
                for (const key of module.ORIGINAL_CUTSCENE_TEXTURE_KEYS) {
                  this.load.image(
                    key,
                    `/original/${manifest.textures[key].file.split('/').map(encodeURIComponent).join('/')}`,
                  );
                }
                for (const key of module.ORIGINAL_CUTSCENE_SOUND_KEYS) {
                  this.load.audio(
                    key,
                    `/original/${manifest.sounds[key].file.split('/').map(encodeURIComponent).join('/')}`,
                  );
                }
              },
              create() {
                this.sound.setMute(true);
                this.cameras.main.setScroll(
                  0,
                  -360 *
                    (campaign === 'original'
                      ? 42
                      : campaign === 'nbp'
                        ? 99
                        : 153),
                );
                const player = this.add.sprite(240, 144, 'king/base');
                const completed: unknown[] = [],
                  awards: string[] = [];
                const cutscene = new module.OriginalCutscenes(this, campaign, {
                  equipped,
                  tsuchinokoDone,
                  player,
                  onComplete: (result: unknown) => completed.push(result),
                  onEquipment: (item: string) => awards.push(item),
                });
                Object.assign(window, {
                  cutsceneTest: {
                    scene: this,
                    cutscene,
                    completed,
                    awards,
                    player,
                  },
                });
                resolve({ ready: true });
              },
            },
          });
        });
      } catch (error) {
        return { ready: false, error: String(error) };
      }
    },
    { campaign, equipped, tsuchinokoDone },
  );
  expect(loaded).toEqual({ ready: true });
}

test('intro gates new solo runs and can be skipped while the scene is paused', async ({
  page,
}) => {
  await mount(page);
  const result = await page.evaluate(() => {
    const { cutscene, scene, completed, player } = (window as any).cutsceneTest;
    const rejected = [
      cutscene.playIntro({ newGame: false, mode: 'solo' }),
      cutscene.playIntro({ newGame: true, mode: 'race' }),
    ];
    const started = cutscene.playIntro({ newGame: true, mode: 'solo' });
    scene.scene.pause();
    cutscene.skip();
    cutscene.skip();
    return {
      rejected,
      started,
      state: cutscene.state,
      count: completed.length,
      visible: player.visible,
    };
  });
  expect(result).toEqual({
    rejected: [false, false],
    started: true,
    state: 'complete',
    count: 1,
    visible: true,
  });
});

for (const [campaign, equipped, tsuchinokoDone, picture, award] of [
  ['original', [], false, 'ending/imagecrown', 'Crown'],
  ['original', ['Shoes'], false, 'ending/imageshoes', 'Crown'],
  ['nbp', [], false, 'ending/nbp_imagecrown', 'CrownNBP'],
  ['nbp', ['GiantBoots'], false, 'ending/nbp_imageshoes', 'CrownNBP'],
  ['ghost', [], false, 'ending/owl_imagecrown', 'CrownOwl'],
  ['ghost', [], true, 'ending/owl_imagebird', 'CapeOwl'],
] as const) {
  test(`${campaign} plays its full ending and selects ${picture}`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await mount(page, campaign, [...equipped], tsuchinokoDone);
    await page.evaluate(() => {
      const { scene, cutscene } = (window as any).cutsceneTest;
      scene.time.timeScale = 30;
      scene.tweens.timeScale = 30;
      scene.anims.globalTimeScale = 30;
      const credits: string[] = [];
      (window as any).cutsceneTest.credits = credits;
      const collect = (objects: any[]) => {
        for (const object of objects) {
          if (
            typeof object.text === 'string' &&
            object.alpha > 0 &&
            !credits.includes(object.text)
          )
            credits.push(object.text);
          if (object.list) collect(object.list);
        }
      };
      scene.events.on('postupdate', () => collect(scene.children.list));
      cutscene.playEnding();
    });
    await expect
      .poll(
        () => page.evaluate(() => (window as any).cutsceneTest.cutscene.state),
        { timeout: 20000 },
      )
      .toBe('picture');
    const result = await page.evaluate(() => {
      const { scene, completed, awards, cutscene } = (window as any)
        .cutsceneTest;
      const images = scene.children.list.filter((child: any) =>
        child.texture?.key.startsWith('ending/'),
      );
      const picture = images.at(-1)?.texture.key;
      cutscene.destroy();
      return {
        picture,
        completed,
        awards,
        credits: (window as any).cutsceneTest.credits,
        camera: [scene.cameras.main.scrollX, scene.cameras.main.scrollY],
        ownObjects: scene.children.list.length,
      };
    });
    expect(result.picture).toBe(picture);
    expect(result.awards).toContain(award);
    expect(result.credits).toContain('lighthouse2815');
    expect(result.credits.indexOf('lighthouse2815')).toBeLessThan(
      result.credits.indexOf('NEXILE'),
    );
    expect(result.credits).toEqual(
      expect.arrayContaining([
        'nvbangg',
        'Lê Thị Ánh Dương',
        'Trần Đình Khánh Dư',
        'Erik Säll',
        'Thomas Härdin',
        'Wilhelm Ohrås',
      ]),
    );
    expect(result.completed).toHaveLength(1);
    expect(result.ownObjects).toBe(1);
    expect(result.camera).toEqual([
      0,
      -360 * (campaign === 'original' ? 42 : campaign === 'nbp' ? 99 : 153),
    ]);
    expect(errors).toEqual([]);
  });
}

test('completed saves show the equipped picture immediately and cancellation never completes', async ({
  page,
}) => {
  await mount(page, 'ghost', ['CapeOwl']);
  const result = await page.evaluate(() => {
    const { cutscene, completed, scene } = (window as any).cutsceneTest;
    cutscene.playEnding();
    scene.scene.pause();
    cutscene.cancel();
    const cancelled = { state: cutscene.state, count: completed.length };
    cutscene.showEndingPicture();
    const shown = {
      state: cutscene.state,
      count: completed.length,
      picture: completed[0].picture,
    };
    cutscene.destroy();
    return { cancelled, shown };
  });
  expect(result).toEqual({
    cancelled: { state: 'cancelled', count: 0 },
    shown: { state: 'picture', count: 1, picture: 'ending/owl_imagebird' },
  });
});

test('skipping the ghost ending still grants both earned rewards and selects the bird picture', async ({
  page,
}) => {
  await mount(page, 'ghost', [], true);
  const result = await page.evaluate(() => {
    const { cutscene, completed, awards } = (window as any).cutsceneTest;
    cutscene.playEnding();
    cutscene.skip();
    return { picture: completed[0].picture, awards };
  });
  expect(result).toEqual({
    picture: 'ending/owl_imagebird',
    awards: ['CrownOwl', 'CapeOwl'],
  });
});
