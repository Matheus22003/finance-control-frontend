import { expect, test } from '@playwright/test';

import { loginAsDemo, logout } from './support/auth';

test.describe('Autenticação e sessão', () => {
  test('redireciona visitantes para o login', async ({ page }) => {
    await page.goto('/dashboard');

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Bem-vindo de volta' })).toBeVisible();
  });

  test('restaura a sessão depois de recarregar a aplicação', async ({ page }) => {
    await loginAsDemo(page);

    await page.reload();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    await logout(page);
  });
});
