import { expect, test } from '@playwright/test';

import { loginAsDemo, logout } from './support/auth';

test.describe('Autenticação e sessão', () => {
  test('redireciona visitantes para o login', async ({ page }) => {
    await page.goto('/dashboard');

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Bem-vindo de volta' })).toBeVisible();
  });

  test('mantém o visitante no login quando as credenciais são inválidas', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#email').fill('demo@financecontrol.local');
    await page.locator('#password').fill('senha-incorreta');
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('alert')).toContainText('E-mail ou senha incorretos');
    await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeEnabled();
  });

  test('restaura a sessão depois de recarregar a aplicação', async ({ page }) => {
    await loginAsDemo(page);

    await page.reload();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    await logout(page);
  });
});
