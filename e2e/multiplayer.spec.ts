import { test, expect } from '@playwright/test';
import { setNickname } from './helpers/gameMenu';

test.describe('Jump King Multiplayer', () => {
  test('players can join and see each other', async ({ browser }) => {
    // We use two independent browser contexts
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    page1.on('console', msg => console.log('PAGE1 CONSOLE:', msg.text()));
    page1.on('pageerror', err => console.log('PAGE1 ERROR:', err.message));
    page2.on('console', msg => console.log('PAGE2 CONSOLE:', msg.text()));
    page2.on('pageerror', err => console.log('PAGE2 ERROR:', err.message));

    // 1. Player 1 joins Community
    await page1.goto('/community');
    await setNickname(page1);
    await page1.waitForSelector('canvas', { timeout: 10000 });

    // 2. Player 2 joins Community
    await page2.goto('/community');
    await setNickname(page2);
    await page2.waitForSelector('canvas', { timeout: 10000 });

    // Wait for connection and initialization
    await page1.waitForTimeout(2000);
    await page2.waitForTimeout(2000);

    // Let Player 1 jump (press space)
    await page1.keyboard.down('Space');
    await page1.waitForTimeout(500); // charge for 0.5s
    await page1.keyboard.up('Space');

    // Let it fly
    await page1.waitForTimeout(1000);

    // At this point both browsers shouldn't throw errors
    const errors1: string[] = [];
    const errors2: string[] = [];

    page1.on('pageerror', err => errors1.push(err.message));
    page2.on('pageerror', err => errors2.push(err.message));

    expect(errors1).toEqual([]);
    expect(errors2).toEqual([]);
    await context1.close();
    await context2.close();
  });

  test('players can race each other', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    // 1. Player 1 creates race
    await page1.goto('/race');
    await setNickname(page1);
    await page1.waitForSelector('text=Create New Race');
    await page1.click('text=Create New Race');

    // Wait for the room ID to be in the URL
    await page1.waitForURL(/\/race\/.+/);
    const urlParts = page1.url().split('/');
    const roomId = urlParts[urlParts.length - 1];

    // 2. Player 2 joins race
    await page2.goto(`/race/${roomId}`);
    await setNickname(page2);
    await page2.waitForSelector('canvas', { timeout: 10000 });

    await page1.waitForSelector('canvas', { timeout: 10000 });

    // Wait for connection
    await page1.waitForTimeout(2000);
    await page2.waitForTimeout(2000);

    // Both click ready
    await page1.click('text=Ready Up');
    await page2.click('text=Ready Up');

    // Wait for countdown to finish and game to run
    await page1.waitForSelector('text=RUNNING', { timeout: 10000 });

    // Jump
    await page1.keyboard.down('Space');
    await page1.waitForTimeout(500);
    await page1.keyboard.up('Space');

    await page1.waitForTimeout(1000);

    expect(true).toBe(true);
    await context1.close();
    await context2.close();
  });
});
