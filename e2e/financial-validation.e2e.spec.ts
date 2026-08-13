import { expect, Page, test } from '@playwright/test';

import { loginAsDemo, logout } from './support/auth';

test.skip(
  process.env['E2E_ISOLATED'] !== 'true',
  'Os cenários financeiros alteram dados e exigem o ambiente Docker E2E descartável.',
);

function dateValue(daysFromToday = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function openFinance(page: Page): Promise<void> {
  await loginAsDemo(page);
  await page.goto('/finance');
  await expect(page.getByRole('heading', { name: 'Finanças' })).toBeVisible();
  await page.locator('.loading-state').waitFor({ state: 'detached' });
}

async function createCategory(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: 'Categorias' }).click();
  const dialog = page.getByRole('dialog', { name: 'Categorias de despesas' });
  await dialog.locator('#category-name').fill(name);
  await dialog.getByRole('button', { name: 'Criar categoria' }).click();
  await expect(dialog.locator('.category-manage-row').filter({ hasText: name })).toBeVisible();
  await dialog.getByRole('button', { name: 'Fechar categorias' }).click();
}

async function createTransaction(
  page: Page,
  kind: 'Receita' | 'Despesa',
  description: string,
  amount: string,
  categoryName?: string,
): Promise<void> {
  await page.getByRole('button', { name: 'Novo lançamento' }).click();
  const dialog = page.getByRole('dialog', { name: 'Adicionar lançamento' });
  await dialog.getByRole('button', { name: kind }).click();
  await dialog.locator('#transaction-description').fill(description);
  await dialog.locator('#transaction-amount').fill(amount);
  await dialog.locator('#transaction-date').fill(dateValue());
  if (categoryName) {
    await dialog.locator('#transaction-category').selectOption({ label: categoryName });
  }
  await dialog.getByRole('button', { name: 'Adicionar lançamento' }).click();
  await expect(page.locator('.transaction-row').filter({ hasText: description })).toBeVisible();
}

test('impede categoria duplicada e preserva categoria que já está em uso', async ({ page }) => {
  const suffix = Date.now();
  const categoryName = `Categoria protegida ${suffix}`;
  const expenseName = `Despesa protegida ${suffix}`;

  await openFinance(page);
  await page.getByRole('button', { name: 'Categorias' }).click();
  const categoryDialog = page.getByRole('dialog', { name: 'Categorias de despesas' });
  await categoryDialog.locator('#category-name').fill(categoryName);
  await categoryDialog.getByRole('button', { name: 'Criar categoria' }).click();
  const categoryRow = categoryDialog
    .locator('.category-manage-row')
    .filter({ hasText: categoryName });
  await expect(categoryRow).toBeVisible();

  await categoryDialog.locator('#category-name').fill(categoryName);
  await categoryDialog.getByRole('button', { name: 'Criar categoria' }).click();
  await expect(categoryDialog.getByRole('alert')).toContainText(
    'Já existe uma categoria com esse nome',
  );
  await expect(
    categoryDialog.locator('.category-manage-row').filter({ hasText: categoryName }),
  ).toHaveCount(1);
  await categoryDialog.getByRole('button', { name: 'Fechar categorias' }).click();

  await createTransaction(page, 'Despesa', expenseName, '10', categoryName);

  await page.getByRole('button', { name: 'Categorias' }).click();
  const protectedRow = categoryDialog
    .locator('.category-manage-row')
    .filter({ hasText: categoryName });
  await protectedRow.getByRole('button', { name: `Excluir categoria ${categoryName}` }).click();
  await expect(categoryDialog.getByRole('alert')).toContainText('Esta categoria está em uso');
  await expect(protectedRow).toBeVisible();
  await categoryDialog.getByRole('button', { name: 'Fechar categorias' }).click();

  await logout(page);
});

test('alerta orçamento excedido e bloqueia aporte acima da receita disponível', async ({
  page,
}) => {
  const suffix = Date.now();
  const categoryName = `Limite E2E ${suffix}`;
  const expenseName = `Excesso E2E ${suffix}`;
  const incomeName = `Receita limitada ${suffix}`;
  const goalName = `Meta limitada ${suffix}`;

  await openFinance(page);
  await createCategory(page, categoryName);

  const budgetCategory = page.locator('.budget-category').filter({ hasText: categoryName });
  await budgetCategory.click();
  const budgetDialog = page.getByRole('dialog', { name: categoryName });
  await budgetDialog.locator('#budget-amount').fill('100');
  await budgetDialog.getByRole('button', { name: 'Salvar orçamento' }).click();

  await createTransaction(page, 'Despesa', expenseName, '125', categoryName);
  await expect(budgetCategory).toContainText('125% utilizado');

  await page.locator('.desktop-toolbar .notification-button').click();
  const budgetNotification = page
    .getByLabel('Central de notificações')
    .locator('.notification-item')
    .filter({ hasText: `Orçamento de ${categoryName} excedido` });
  await expect(budgetNotification).toBeVisible({ timeout: 15_000 });
  await expect(budgetNotification).toContainText('125%');
  await budgetNotification.click();

  await createTransaction(page, 'Receita', incomeName, '100');

  await page.getByRole('button', { name: '+ Nova meta' }).click();
  const goalDialog = page.getByRole('dialog', { name: 'Planejar um objetivo' });
  await goalDialog.locator('#goal-name').fill(goalName);
  await goalDialog.locator('#goal-target-amount').fill('1000');
  await goalDialog.locator('#goal-current-amount').fill('0');
  await goalDialog.locator('#goal-target-date').fill(dateValue(90));
  await goalDialog.getByRole('button', { name: 'Salvar meta' }).click();

  const goalItem = page.locator('.goal-item').filter({ hasText: goalName });
  await goalItem.getByRole('button', { name: '+ Registrar aporte' }).click();
  const contributionDialog = page.getByRole('dialog', { name: goalName });
  const sourceSelect = contributionDialog.locator('#contribution-source-income');
  const incomeOption = sourceSelect.locator('option').filter({ hasText: incomeName });
  const incomeId = await incomeOption.getAttribute('value');
  expect(incomeId).toBeTruthy();
  await sourceSelect.selectOption(incomeId!);
  await contributionDialog.locator('#contribution-amount').fill('100.01');

  await expect(contributionDialog.getByText('O aporte supera o valor disponível')).toBeVisible();
  await expect(contributionDialog.getByRole('button', { name: 'Registrar aporte' })).toBeDisabled();
  await expect(contributionDialog.locator('.contribution-item')).toHaveCount(0);
  await contributionDialog.locator('.modal-close').click();

  await logout(page);
});
