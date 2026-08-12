import { expect, Locator, test } from '@playwright/test';

import { loginAsDemo, logout } from './support/auth';

async function verticalDistance(upper: Locator, lower: Locator): Promise<number> {
  const upperBox = await upper.boundingBox();
  const lowerBox = await lower.boundingBox();

  expect(upperBox).not.toBeNull();
  expect(lowerBox).not.toBeNull();

  return lowerBox!.y - (upperBox!.y + upperBox!.height);
}

test.describe('Amigos e grupos', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDemo(page);
    await page.goto('/social');
    await expect(page.getByRole('heading', { name: 'Amigos & grupos' })).toBeVisible();
  });

  test.afterEach(async ({ page }) => {
    await logout(page);
  });

  test('mantém espaçamento consistente entre as seções', async ({ page }) => {
    const socialGrid = page.locator('.social-grid');
    const friendsCard = page.locator('.friends-card');
    const groupsLayout = page.locator('.groups-layout');

    await expect(socialGrid).toBeVisible();
    await expect(friendsCard).toBeVisible();
    await expect(groupsLayout).toBeVisible();

    expect(await verticalDistance(socialGrid, friendsCard)).toBeGreaterThanOrEqual(19);
    expect(await verticalDistance(friendsCard, groupsLayout)).toBeGreaterThanOrEqual(19);

    await page.setViewportSize({ width: 390, height: 844 });

    expect(await verticalDistance(socialGrid, friendsCard)).toBeGreaterThanOrEqual(19);
    expect(await verticalDistance(friendsCard, groupsLayout)).toBeGreaterThanOrEqual(19);

    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test('cria e remove um grupo pelo BFF', async ({ page }) => {
    const groupName = `Grupo E2E ${Date.now()}`;

    await page.getByLabel('Nome').fill(groupName);
    await page.getByLabel('Descrição').fill('Grupo temporário criado pelo teste automatizado.');
    await page.getByRole('button', { name: 'Criar grupo' }).click();

    const createdGroup = page.locator('.group-row').filter({ hasText: groupName });
    try {
      await expect(createdGroup).toBeVisible();
    } finally {
      if (await createdGroup.isVisible()) {
        await createdGroup.getByRole('button', { name: 'Excluir' }).click();
      }
    }
    await expect(createdGroup).toHaveCount(0);
  });
});
