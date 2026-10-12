import { test, expect, Page } from '@playwright/test';
import { createRequire } from 'node:module';
import { setNickname } from './helpers/gameMenu';

const requireWeb = createRequire(`${process.cwd()}/apps/web/package.json`);
const requireColyseus = createRequire(requireWeb.resolve('colyseus.js'));
const nativeWebSocket = globalThis.WebSocket;
globalThis.WebSocket = requireColyseus('ws');
const { Client } = requireWeb('colyseus.js');
globalThis.WebSocket = nativeWebSocket;
const hats = ['Crown', 'CrownNBP', 'Cap', 'GnomeHat', 'CrownOwl'];
const textures: Record<string, string> = {
  Crown: 'king/crown',
  CrownNBP: 'king/crown_nbp',
  Cap: 'king/cap',
  GnomeHat: 'king/gnomehat',
  CrownOwl: 'king/crown_owl',
};

async function appearance(page: Page) {
  return page.evaluate(() => {
    const scene = (window as any).Phaser.Display.Canvas.CanvasPool.pool
      .map((entry: any) => entry.parent?.scene)
      .find((scene: any) => scene?.sys?.settings?.key === 'OriginalScene');
    if (!scene?.room) return null;
    const view = (id: string, sprite: any, costumeId: string) => {
      const player = scene.room.state.players.get(id);
      const costume = scene.effects.costumes.get(costumeId);
      const hat = costume?.get(player.cosmeticHat);
      return {
        id,
        hat: player.cosmeticHat,
        hue: player.colorHue,
        tint: sprite.tintTopLeft,
        texture: hat?.texture.key,
        hatTint: hat?.tintTopLeft,
        frame: sprite.frame.name,
        hatFrame: hat?.frame.name,
        visible: hat?.visible,
        x: sprite.x,
        hatX: hat?.x,
        inventory: JSON.parse(player.snapshot).adventure.inventory,
        equipped: JSON.parse(player.snapshot).adventure.equipped,
      };
    };
    return {
      self: view(scene.room.sessionId, scene.player, 'self'),
      peers: [...scene.peers.entries()].map(([id, sprite]: any) =>
        view(id, sprite, id),
      ),
    };
  });
}

for (const mode of ['community', 'race'] as const) {
  test(`${mode} renders the same hats and chat colors on both clients while moving`, async ({
    page,
    browser,
  }, testInfo) => {
    test.setTimeout(90000);
    const client = new Client(
      process.env.E2E_SERVER_URL || 'ws://127.0.0.1:2567',
    );
    const anchor = await client.create(
      mode === 'community' ? 'original_tower' : 'original_race',
      { campaign: 'original' },
    );
    anchor.onMessage('*', () => {});
    const context = await browser.newContext();
    const other = await context.newPage();
    try {
      if (mode === 'community')
        for (const target of [page, other])
          await target.route(
            '**/matchmake/joinOrCreate/original_tower',
            (route) =>
              route.continue({
                url: route
                  .request()
                  .url()
                  .replace(
                    '/joinOrCreate/original_tower',
                    `/joinById/${anchor.roomId}`,
                  ),
              }),
          );
      const path =
        mode === 'community' ? '/community' : `/race/${anchor.roomId}`;
      for (const target of [page, other]) {
        await target.goto(path);
        await setNickname(target, 'Cùng tên');
        await expect(target.getByTestId('game-state')).toHaveAttribute(
          'data-status',
          'PLAYING',
          { timeout: 30000 },
        );
      }
      await anchor.leave();
      await expect
        .poll(async () => (await appearance(page))?.peers.length)
        .toBe(1);
      await expect
        .poll(async () => (await appearance(other))?.peers.length)
        .toBe(1);
      const first = (await appearance(page))!;
      const second = (await appearance(other))!;
      for (const [own, seen] of [
        [first.self, second.peers[0]],
        [second.self, first.peers[0]],
      ]) {
        expect(hats).toContain(own.hat);
        expect(seen).toMatchObject({
          id: own.id,
          hat: own.hat,
          hue: own.hue,
          tint: own.tint,
        });
        expect(own.texture).toBe(textures[own.hat]);
        expect(seen.texture).toBe(own.texture);
        expect(own.hatTint).toBe(own.tint);
        expect(seen.hatTint).toBe(own.tint);
        expect(own.equipped).toEqual([]);
        expect(own.inventory).toEqual({});
      }
      expect(first.self.hat).not.toBe(second.self.hat);
      expect(first.self.tint).not.toBe(second.self.tint);
      await page.keyboard.press('Enter');
      await page
        .getByRole('textbox', { name: 'Nhập tin nhắn' })
        .fill('Màu của tôi');
      await page.getByRole('button', { name: 'Gửi', exact: true }).click();
      const message = other
        .getByRole('log')
        .getByText('Cùng tên: Màu của tôi', { exact: true });
      await expect(message).toBeVisible();
      const rgb = await message.evaluate((element) =>
        getComputedStyle(element).color.match(/\d+/g)!.map(Number),
      );
      const tintRgb = [
        (first.self.tint >> 16) & 255,
        (first.self.tint >> 8) & 255,
        first.self.tint & 255,
      ];
      for (let i = 0; i < 3; i++)
        expect(Math.abs(rgb[i] - tintRgb[i])).toBeLessThanOrEqual(1);
      await page
        .getByRole('textbox', { name: 'Nhập tin nhắn' })
        .press('Escape');
      if (mode === 'race') {
        for (const target of [page, other])
          await target.getByRole('button', { name: 'Ready Up' }).click();
        await expect(page.getByTestId('race-status')).toHaveText('RUNNING', {
          timeout: 10000,
        });
      }
      await page.keyboard.down('ArrowRight');
      await expect
        .poll(async () => (await appearance(other))!.peers[0].x)
        .toBeGreaterThan(first.self.x + 15);
      await page.keyboard.up('ArrowRight');
      const moved = (await appearance(other))!.peers[0];
      expect(moved).toMatchObject({
        hat: first.self.hat,
        hue: first.self.hue,
        texture: first.self.texture,
        visible: true,
      });
      expect(moved.hatX).toBe(moved.x);
      expect(moved.hatFrame).toBe(moved.frame);
      await other.screenshot({
        path: testInfo.outputPath('online-appearance.png'),
      });
      await page.goto('/play');
      await expect(page.getByTestId('game-state')).toHaveAttribute(
        'data-status',
        'PLAYING',
        { timeout: 30000 },
      );
      const solo = await page.evaluate(() => {
        const scene = (window as any).Phaser.Display.Canvas.CanvasPool.pool
          .map((entry: any) => entry.parent?.scene)
          .find((scene: any) => scene?.sys?.settings?.key === 'OriginalScene');
        return {
          tint: scene.player.tintTopLeft,
          hats: [...(scene.effects.costumes.get('self')?.keys() || [])],
        };
      });
      expect(solo).toEqual({ tint: 0xffffff, hats: [] });
    } finally {
      if (anchor.connection.isOpen) await anchor.leave();
      await context.close();
    }
  });
}
