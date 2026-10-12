import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import { setNickname } from './helpers/gameMenu';

const requireWeb = createRequire(`${process.cwd()}/apps/web/package.json`);
const requireColyseus = createRequire(requireWeb.resolve('colyseus.js'));
const nativeWebSocket = globalThis.WebSocket;
globalThis.WebSocket = requireColyseus('ws');
const { Client } = requireWeb('colyseus.js');
globalThis.WebSocket = nativeWebSocket;

for (const mode of ['community', 'race']) {
  test(`${mode} keeps sender colors and hidden chat only announces unread messages`, async ({
    page,
  }) => {
    test.setTimeout(60000);
    const client = new Client(
      process.env.E2E_SERVER_URL || 'ws://127.0.0.1:2567',
    );
    const host = await client.create(
      mode === 'race' ? 'original_race' : 'original_tower',
      { campaign: 'original', nickname: 'Cùng biệt danh' },
    );
    host.onMessage('*', () => {});
    const peer = await client.joinById(host.roomId, {
      nickname: 'Cùng biệt danh',
    });
    peer.onMessage('*', () => {});
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      if (mode === 'community')
        await page.route('**/matchmake/joinOrCreate/original_tower', (route) =>
          route.continue({
            url: route
              .request()
              .url()
              .replace(
                '/joinOrCreate/original_tower',
                `/joinById/${host.roomId}`,
              ),
          }),
        );
      await page.goto(mode === 'race' ? `/race/${host.roomId}` : '/community');
      await setNickname(page, 'Người quan sát');
      await expect(page.getByTestId('game-state')).toHaveAttribute(
        'data-status',
        'PLAYING',
        {
          timeout: 30000,
        },
      );
      const panel = page.locator('.room-chat-panel');
      const chat = page.getByRole('region', { name: 'Chat trong phòng' });
      const log = page.getByRole('log');
      host.send('chat', 'Tin của chủ phòng');
      await expect(log).toContainText('Cùng biệt danh: Tin của chủ phòng');
      peer.send('chat', 'Tin của bạn');
      await expect(log).toContainText('Cùng biệt danh: Tin của bạn');
      const hostColor = await log
        .locator('p')
        .nth(0)
        .evaluate((element) => getComputedStyle(element).color);
      const peerColor = await log
        .locator('p')
        .nth(1)
        .evaluate((element) => getComputedStyle(element).color);
      expect(hostColor).not.toBe(peerColor);
      expect(hostColor).not.toBe('rgb(255, 255, 255)');
      await expect(log.locator('strong').first()).toHaveCSS('color', hostColor);
      const chatWidth = await chat.evaluate(
        (element) => element.getBoundingClientRect().width,
      );
      const frameWidth = await page
        .getByTestId('game-state')
        .evaluate((element) => element.getBoundingClientRect().width);
      expect(chatWidth).toBeGreaterThan(frameWidth / 2);
      expect(chatWidth).toBeLessThan(frameWidth);
      const background = await panel.evaluate(
        (element) => getComputedStyle(element).backgroundColor,
      );
      const alpha = Number(background.match(/,\s*([\d.]+)\)$/)?.[1]);
      expect(alpha).toBeGreaterThan(0);
      expect(alpha).toBeLessThan(0.5);

      await page.keyboard.press('Enter');
      const input = page.getByRole('textbox', {
        name: 'Nhập tin nhắn',
        includeHidden: true,
      });
      await expect(input).toBeFocused();
      await page.getByRole('button', { name: 'Ẩn chat', exact: true }).click();
      await expect(panel).toBeHidden();
      await expect(input).not.toBeFocused();
      const trigger = page.getByRole('button', { name: /^Hiện chat/ });
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
      await trigger.hover();
      await expect(panel).toBeHidden();
      await expect(page.locator('.room-chat-unread')).toHaveCount(0);
      await new Promise((resolve) => setTimeout(resolve, 1050));
      host.send('chat', 'Tin mới thứ nhất');
      await expect(trigger.getByRole('status')).toHaveAccessibleName(
        '1 tin nhắn mới',
      );
      await expect(panel).toBeHidden();
      peer.send('chat', 'Tin mới thứ hai');
      await expect(trigger.getByRole('status')).toHaveAccessibleName(
        '2 tin nhắn mới',
      );
      await expect(trigger.getByRole('status')).toHaveCSS(
        'border-radius',
        '50%',
      );
      await expect(panel).toBeHidden();
      await page.mouse.move(0, 0);
      await page.waitForTimeout(6500);
      await expect(panel).toBeHidden();
      await expect(trigger.getByRole('status')).toHaveAccessibleName(
        '2 tin nhắn mới',
      );
      await expect(trigger).toHaveCSS('opacity', '1');
      await trigger.click();
      await expect(input).toBeFocused();
      await expect(panel).toBeVisible();
      await expect(
        chat.getByRole('button', { name: 'Chat · Enter', exact: true }),
      ).toHaveAttribute('aria-expanded', 'true');
      await expect(page.locator('.room-chat-unread')).toHaveCount(0);
      await expect(log).toContainText('Tin mới thứ hai');
      await expect(log.locator('p').nth(2)).toHaveCSS('color', hostColor);

      await page.getByRole('button', { name: 'Ẩn chat', exact: true }).click();
      await page.mouse.move(0, 0);
      await page.keyboard.press('Enter');
      await expect(input).toBeFocused();
      await expect(panel).toBeVisible();
      await input.press('Escape');
      await expect(input).not.toBeFocused();
      await expect(page.getByTestId('game-state')).toHaveAttribute(
        'data-paused',
        'false',
      );

      await page.reload();
      await setNickname(page, 'Người quan sát');
      await expect(log).toContainText('Tin mới thứ hai', { timeout: 30000 });
      await expect(log.locator('p').first()).toHaveCSS('color', hostColor);
      await expect(log.locator('p').nth(1)).toHaveCSS('color', peerColor);
      expect(errors).toEqual([]);
      await page.goto('/');
    } finally {
      await peer.leave();
      await host.leave();
    }
  });
}
