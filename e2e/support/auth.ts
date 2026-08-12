import { expect, Page } from '@playwright/test';

export const demoAccount = {
  email: 'demo@financecontrol.local',
  password: 'ChangeMe123!',
} as const;

export const friendAccount = {
  email: 'friend@financecontrol.local',
  password: 'ChangeMe123!',
} as const;

type TestAccount = typeof demoAccount | typeof friendAccount;

export async function login(page: Page, account: TestAccount): Promise<void> {
  await page.goto('/login');
  await page.locator('#email').fill(account.email);
  await page.locator('#password').fill(account.password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

export async function loginAsDemo(page: Page): Promise<void> {
  await login(page, demoAccount);
}

export async function loginAsFriend(page: Page): Promise<void> {
  await login(page, friendAccount);
}

export async function logout(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page).toHaveURL(/\/login$/);
}
