import { expect, Page } from '@playwright/test';

export async function setNickname(page: Page, nickname = 'Người chơi thử') {
  await page.getByRole('textbox', { name: 'Biệt danh', exact: true }).fill(nickname);
  await page.getByRole('button', { name: 'Vào phòng', exact: true }).click();
}

export async function pauseGame(page: Page) {
  if (
    (await page
      .getByTestId('game-state')
      .getAttribute('data-paused')) !== 'true'
  )
    await page.keyboard.press('Escape');
  const root = page.getByRole('navigation', {
    name: 'Pause menu',
    exact: true,
  });
  await expect(root).toBeVisible();
  for (
    let depth = 0;
    depth < 4 &&
    !(await root
      .getByRole('button', { name: 'Resume', exact: true })
      .isEnabled());
    depth++
  )
    await page.keyboard.press('Escape');
  await expect(
    root.getByRole('button', { name: 'Resume', exact: true }),
  ).toBeEnabled();
  return root;
}

export async function exitGame(page: Page) {
  const root = await pauseGame(page);
  await root
    .getByRole('button', { name: /^(Save & Exit|Leave Room)$/ })
    .click();
  await page
    .getByRole('navigation', { name: 'Save and exit' })
    .getByRole('button', { name: 'Yes', exact: true })
    .click();
  await expect(page).toHaveURL(/\/$/);
}

export async function openInventory(page: Page) {
  const root = await pauseGame(page);
  await root
    .getByRole('button', { name: 'Inventory', exact: true })
    .click();
  return page.getByRole('navigation', {
    name: 'Inventory',
    exact: true,
  });
}

export async function openAchievements(page: Page) {
  const root = await pauseGame(page);
  await root
    .getByRole('button', { name: 'Options', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Achievements', exact: true })
    .click();
}

export async function openDeveloper(page: Page) {
  const root = await pauseGame(page);
  await root
    .getByRole('button', { name: 'Options', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Developer', exact: true })
    .click();
  await expect(
    page.getByLabel('Mã cheat', { exact: true }),
  ).toBeVisible();
}
