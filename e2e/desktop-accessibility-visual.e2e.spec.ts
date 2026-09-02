import { expect, Locator, Page, test } from '@playwright/test';

import { loginAsDemo, logout } from './support/auth';

type Viewport = { width: number; height: number };

const desktopViewport: Viewport = { width: 1440, height: 900 };
// An 800px CSS viewport exercises the desktop-pointer breakpoint as a person
// using a large browser zoom would, without turning the test into a mobile test.
const desktopZoomViewport: Viewport = { width: 800, height: 900 };

async function expectInsideViewport(locator: Locator, viewport: Viewport): Promise<void> {
  const box = await locator.boundingBox();

  expect(box, 'o elemento precisa ter uma caixa visível').not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
}

async function expectDesktopChrome(page: Page, viewport: Viewport): Promise<void> {
  await expect(page.locator('.sidebar')).toBeVisible();
  await expect(page.locator('.desktop-toolbar')).toBeVisible();
  await expect(page.locator('.mobile-header')).toBeHidden();
  await expect(page.locator('.mobile-nav')).toBeHidden();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
    'o layout não deve introduzir rolagem horizontal no viewport desktop',
  ).toBe(viewport.width);
}

test.describe('Acessibilidade visual no desktop', () => {
  test('preserva navegação, foco e diálogo no desktop e em zoom alto', async ({ page }) => {
    test.setTimeout(45_000);

    await page.setViewportSize(desktopViewport);
    await loginAsDemo(page);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectDesktopChrome(page, desktopViewport);

    const wideSidebar = page.locator('.sidebar');
    const wideSidebarBox = await wideSidebar.boundingBox();
    expect(wideSidebarBox?.width).toBeGreaterThan(200);
    await expect(page.getByRole('link', { name: 'Relatórios' })).toBeVisible();
    await expectInsideViewport(page.locator('.desktop-toolbar'), desktopViewport);

    await page.setViewportSize(desktopZoomViewport);
    await expectDesktopChrome(page, desktopZoomViewport);

    const compactSidebarBox = await page.locator('.sidebar').boundingBox();
    expect(compactSidebarBox?.width).toBe(72);
    await expect(page.getByRole('link', { name: 'Relatórios' })).toBeVisible();

    const notificationButton = page.locator('.desktop-toolbar .notification-button');
    await notificationButton.focus();
    await expect(notificationButton).toBeFocused();
    await page.keyboard.press('Enter');

    const dialog = page.getByRole('dialog', { name: 'Notificações' });
    await expect(dialog).toBeVisible();
    await expectInsideViewport(dialog, desktopZoomViewport);
    await expect(dialog.getByRole('button', { name: 'Fechar' })).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(dialog.locator(':focus')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(notificationButton).toBeFocused();

    await logout(page);
  });
});
