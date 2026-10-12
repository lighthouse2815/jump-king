import { test, expect, Page } from '@playwright/test';
import { createRequire } from 'node:module';
import { exitGame } from './helpers/gameMenu';

const requireWeb = createRequire(`${process.cwd()}/apps/web/package.json`);
// Colyseus 0.15 needs the Node ws constructor that supports its headers option.
const requireColyseus = createRequire(requireWeb.resolve('colyseus.js'));
const nativeWebSocket = globalThis.WebSocket;
globalThis.WebSocket = requireColyseus('ws');
const { Client, ErrorCode } = requireWeb('colyseus.js');
globalThis.WebSocket = nativeWebSocket;

async function playing(page: Page) {
  await expect(page.getByTestId('game-state')).toHaveAttribute(
    'data-status',
    'PLAYING',
    { timeout: 30000 },
  );
}

for (const mode of ['community', 'race']) {
  test(`${mode} chat broadcasts, fades, restores on hover and keeps typing out of gameplay`, async ({
    browser,
  }, testInfo) => {
    test.setTimeout(90000);
    const actor = await browser.newContext();
    const observer = await browser.newContext();
    const newcomer = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: browser.browserType().name() !== 'firefox',
      hasTouch: true,
    });
    let communityRoom: any;
    try {
      const first = await actor.newPage();
      const second = await observer.newPage();
      const errors: string[] = [];
      for (const page of [first, second])
        page.on('pageerror', (error) => errors.push(error.message));
      if (mode === 'race') {
        await first.goto('/race');
        await first.getByRole('button', { name: 'Create New Race' }).click();
        await playing(first);
        await second.goto(new URL(first.url()).pathname);
      } else {
        const client = new Client(
          process.env.E2E_SERVER_URL || 'ws://127.0.0.1:2567',
        );
        communityRoom = await client.create('original_tower', {
          campaign: 'original',
        });
        communityRoom.onMessage('*', () => {});
        for (const context of [actor, observer, newcomer]) {
          await context.route(
            '**/matchmake/joinOrCreate/original_tower',
            (route) =>
              route.continue({
                url: route
                  .request()
                  .url()
                  .replace(
                    '/joinOrCreate/original_tower',
                    `/joinById/${communityRoom.roomId}`,
                  ),
              }),
          );
        }
        await first.goto('/community');
        await playing(first);
        await second.goto('/community');
      }
      await playing(second);
      if (communityRoom) await communityRoom.leave();
      await expect(second.getByTestId('game-state')).toHaveAttribute(
        'data-room-id',
        (await first.getByTestId('game-state').getAttribute('data-room-id'))!,
      );
      await expect(second.getByTestId('player-count')).toHaveText(
        '● 2 người trong phòng',
      );
      const panel = second.locator('.room-chat-panel');
      await second.mouse.move(0, 0);
      await expect(panel).toHaveCSS('opacity', '0');
      await first.keyboard.press('Enter');
      const input = first.getByRole('textbox', { name: 'Nhập tin nhắn' });
      await expect(input).toBeFocused();
      const state = first.getByTestId('game-state');
      const jumps = await state.getAttribute('data-jumps');
      const x = await state.getAttribute('data-x');
      await input.pressSequentially('Chào cả phòng! a w d <b>Xin chào</b>', {
        delay: 25,
      });
      await input.press('Space');
      await input.press('ArrowRight');
      await expect(state).toHaveAttribute('data-jumps', jumps!);
      await expect(state).toHaveAttribute('data-x', x!);
      await expect(state).toHaveAttribute('data-paused', 'false');
      await input.press('Enter');
      const log = second.getByRole('log');
      await expect(log).toContainText('Chào cả phòng! a w d <b>Xin chào</b>');
      await expect(log.locator('b')).toHaveCount(0);
      await expect(panel).toHaveCSS('opacity', '1');
      await expect(input).toBeFocused();
      await input.press('Escape');
      await expect(input).not.toBeFocused();
      await expect(state).toHaveAttribute('data-paused', 'false');

      const third = await newcomer.newPage();
      await third.goto(new URL(first.url()).pathname);
      await playing(third);
      await expect(third.getByRole('log')).toContainText('Chào cả phòng!');
      await third.getByRole('button', { name: 'Chat · Enter' }).tap();
      const mobileInput = third.getByRole('textbox', { name: 'Nhập tin nhắn' });
      await expect(mobileInput).toBeFocused();
      await mobileInput.fill('Chào từ điện thoại');
      await third.getByRole('button', { name: 'Gửi', exact: true }).tap();
      await expect(log).toContainText('Chào từ điện thoại');
      await third.screenshot({
        path: testInfo.outputPath('room-chat-mobile.png'),
      });
      await expect(panel).toHaveCSS('opacity', '0', { timeout: 10000 });
      await second.getByRole('button', { name: 'Chat · Enter' }).hover();
      await expect(panel).toHaveCSS('opacity', '1');
      await second.getByRole('button', { name: 'Chat · Enter' }).click();
      await expect(
        second.getByRole('textbox', { name: 'Nhập tin nhắn' }),
      ).toBeFocused();
      await second
        .getByRole('textbox', { name: 'Nhập tin nhắn' })
        .press('Escape');

      if (mode === 'community') {
        await first.keyboard.down('Space');
        await expect
          .poll(async () => Number(await state.getAttribute('data-jumps')))
          .toBeGreaterThan(Number(jumps));
        await first.keyboard.up('Space');
      }
      await exitGame(first);
      await first.goto('/play');
      await playing(first);
      await expect(
        first.getByRole('region', { name: 'Chat trong phòng' }),
      ).toHaveCount(0);
      expect(errors).toEqual([]);
    } finally {
      if (communityRoom?.connection.isOpen) await communityRoom.leave();
      await actor.close();
      await observer.close();
      await newcomer.close();
    }
  });
}

test('server validates chat, bounds room history and discards it when a room closes', async ({
  baseURL,
}) => {
  const serverUrl = process.env.E2E_SERVER_URL || 'ws://127.0.0.1:2567';
  test.skip(
    !!baseURL &&
      !/localhost|127\.0\.0\.1/.test(baseURL) &&
      !process.env.E2E_SERVER_URL,
    'Needs the game server URL.',
  );
  const client = new Client(serverUrl);
  const rooms: any[] = [];
  const messages: any[] = [];
  const errors: string[] = [];
  const history: any[][] = [];
  try {
    const room = await client.create('original_tower', {
      nickname: 'Người gửi',
    });
    rooms.push(room);
    room.onMessage('chat', (message: unknown) => messages.push(message));
    room.onMessage('chatError', (error: string) => errors.push(error));
    room.onMessage('chatHistory', (messages: any[]) => history.push(messages));
    room.send('chat', { text: 'invalid payload' });
    room.send('chat', '   ');
    room.send('chat', 'x'.repeat(201));
    await expect.poll(() => errors.length).toBe(1);
    expect(messages).toHaveLength(0);
    room.send('chat', '  Xin\nchào  ');
    room.send('chat', 'Too fast');
    await expect.poll(() => messages.length).toBe(1);
    await expect.poll(() => errors.length).toBe(2);
    expect(messages[0]).toMatchObject({
      nickname: 'Người gửi',
      sessionId: room.sessionId,
      text: 'Xin chào',
    });

    const separate = await client.create('original_tower');
    rooms.push(separate);
    const isolated: unknown[] = [];
    separate.onMessage('chat', (message: unknown) => isolated.push(message));
    separate.onMessage('chatHistory', (messages: unknown[]) =>
      isolated.push(messages),
    );
    separate.send('chatHistory');
    await expect.poll(() => isolated.length).toBe(1);
    expect(isolated).toEqual([[]]);

    for (let i = 0; i < 5; i++) {
      const peer = await client.joinById(room.roomId, {
        nickname: `Peer ${i}`,
      });
      peer.onMessage('chat', () => {});
      peer.onMessage('chatError', (error: string) => errors.push(error));
      rooms.push(peer);
    }
    const peers = rooms.filter((peer) => peer !== separate && peer !== room);
    await expect.poll(() => room.state.players.size).toBe(6);
    for (let round = 0; round < 11; round++) {
      for (const peer of peers) peer.send('chat', `Round ${round}`);
      await expect
        .poll(() => messages.length)
        .toBe(1 + (round + 1) * peers.length);
      if (round < 10) await new Promise((resolve) => setTimeout(resolve, 1050));
    }
    expect(errors).toHaveLength(2);
    room.send('chatHistory');
    await expect.poll(() => history.length).toBe(1);
    expect(history[0]).toHaveLength(50);
    expect(history[0]).toEqual(messages.slice(-50));
    expect(isolated).toEqual([[]]);
    const oldId = room.roomId;
    await Promise.all([room, ...peers].map((peer) => peer.leave()));
    await expect
      .poll(async () => {
        try {
          const stale = await client.joinById(oldId);
          await stale.leave();
          return false;
        } catch (error) {
          return (
            (error as { code: number }).code ===
            ErrorCode.MATCHMAKE_INVALID_ROOM_ID
          );
        }
      })
      .toBe(true);
    const fresh = await client.create('original_tower');
    rooms.push(fresh);
    const freshHistory: unknown[][] = [];
    fresh.onMessage('chatHistory', (messages: unknown[]) =>
      freshHistory.push(messages),
    );
    fresh.send('chatHistory');
    await expect.poll(() => freshHistory.length).toBe(1);
    expect(freshHistory).toEqual([[]]);
  } finally {
    await Promise.all(
      rooms
        .filter((room) => room.connection.isOpen)
        .map((room) => room.leave()),
    );
  }
});
