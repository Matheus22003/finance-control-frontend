import { expect, test } from '@playwright/test';

import { loginAsDemo, logout } from './support/auth';

test.skip(
  process.env['E2E_ISOLATED'] !== 'true',
  'O fluxo financeiro altera dados e exige o ambiente Docker E2E descartável.',
);

function dateValue(daysFromToday = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

test('conecta categoria, orçamento, alerta, receita e meta financeira', async ({ page }) => {
  test.setTimeout(90_000);

  const suffix = Date.now();
  const categoryName = `Assinaturas E2E ${suffix}`;
  const expenseName = `Despesa E2E ${suffix}`;
  const incomeName = `Receita E2E ${suffix}`;
  const goalName = `Meta E2E ${suffix}`;
  const contributionNote = `Aporte E2E ${suffix}`;

  await loginAsDemo(page);
  await page.goto('/finance');
  await expect(page.getByRole('heading', { name: 'Finanças' })).toBeVisible();
  await page.locator('.loading-state').waitFor({ state: 'detached' });

  await page.getByRole('button', { name: 'Categorias' }).click();
  const categoryDialog = page.getByRole('dialog', { name: 'Categorias de despesas' });
  await categoryDialog.locator('#category-name').fill(categoryName);
  await categoryDialog.getByRole('button', { name: 'Criar categoria' }).click();
  await expect(
    categoryDialog.locator('.category-manage-row').filter({ hasText: categoryName }),
  ).toBeVisible();
  await categoryDialog.getByRole('button', { name: 'Fechar categorias' }).click();

  const budgetCategory = page.locator('.budget-category').filter({ hasText: categoryName });
  await expect(budgetCategory).toBeVisible();
  await budgetCategory.click();
  const budgetDialog = page.getByRole('dialog', { name: categoryName });
  await budgetDialog.locator('#budget-amount').fill('100');
  await budgetDialog.getByRole('button', { name: 'Salvar orçamento' }).click();
  await expect(budgetDialog).toBeHidden();
  await expect(budgetCategory).toContainText('0% utilizado');

  await page.getByRole('button', { name: 'Novo lançamento' }).click();
  const expenseDialog = page.getByRole('dialog', { name: 'Adicionar lançamento' });
  await expenseDialog.getByRole('button', { name: 'Despesa' }).click();
  await expenseDialog.locator('#transaction-description').fill(expenseName);
  await expenseDialog.locator('#transaction-amount').fill('85');
  await expenseDialog.locator('#transaction-date').fill(dateValue());
  await expenseDialog.locator('#transaction-category').selectOption({ label: categoryName });
  await expenseDialog.getByRole('button', { name: 'Adicionar lançamento' }).click();

  await expect(page.locator('.transaction-row').filter({ hasText: expenseName })).toBeVisible();
  await expect(budgetCategory).toContainText('85% utilizado');

  await page.locator('.desktop-toolbar .notification-button').click();
  const notificationPanel = page.getByRole('dialog', { name: 'Notificações' });
  const budgetNotification = notificationPanel
    .locator('.notification-item')
    .filter({ hasText: `Orçamento de ${categoryName} em atenção` });
  await expect(budgetNotification).toBeVisible({ timeout: 15_000 });
  await expect(budgetNotification).toContainText('85%');
  await budgetNotification.click();

  await page.getByRole('button', { name: 'Novo lançamento' }).click();
  const incomeDialog = page.getByRole('dialog', { name: 'Adicionar lançamento' });
  await incomeDialog.getByRole('button', { name: 'Receita' }).click();
  await incomeDialog.locator('#transaction-description').fill(incomeName);
  await incomeDialog.locator('#transaction-amount').fill('500');
  await incomeDialog.locator('#transaction-date').fill(dateValue());
  await incomeDialog.getByRole('button', { name: 'Adicionar lançamento' }).click();

  const incomeRow = page.locator('.transaction-row').filter({ hasText: incomeName });
  await expect(incomeRow).toBeVisible();

  await page.getByRole('button', { name: '+ Nova meta' }).click();
  const goalDialog = page.getByRole('dialog', { name: 'Planejar um objetivo' });
  await goalDialog.locator('#goal-name').fill(goalName);
  await goalDialog.locator('#goal-target-amount').fill('1000');
  await goalDialog.locator('#goal-current-amount').fill('0');
  await goalDialog.locator('#goal-target-date').fill(dateValue(20));
  await goalDialog.getByRole('button', { name: 'Salvar meta' }).click();

  const goalItem = page.locator('.goal-item').filter({ hasText: goalName });
  await expect(goalItem).toBeVisible();
  await goalItem.getByRole('button', { name: '+ Registrar aporte' }).click();

  const contributionDialog = page.getByRole('dialog', { name: goalName });
  const sourceIncomeSelect = contributionDialog.locator('#contribution-source-income');
  const sourceIncomeOption = sourceIncomeSelect.locator('option').filter({ hasText: incomeName });
  await expect(sourceIncomeOption).toHaveCount(1);
  const sourceIncomeId = await sourceIncomeOption.getAttribute('value');
  expect(sourceIncomeId).toBeTruthy();

  await sourceIncomeSelect.selectOption(sourceIncomeId!);
  await contributionDialog.locator('#contribution-amount').fill('200');
  await contributionDialog.locator('#contribution-date').fill(dateValue());
  await contributionDialog.locator('#contribution-note').fill(contributionNote);
  await contributionDialog.getByRole('button', { name: 'Registrar aporte' }).click();

  const contribution = contributionDialog
    .locator('.contribution-item')
    .filter({ hasText: contributionNote });
  await expect(contribution).toBeVisible();
  await expect(contribution).toContainText(incomeName);
  await expect(contribution).toContainText('R$ 200,00');
  await expect(contributionDialog.locator('.contribution-overview')).toContainText('20%');
  await contributionDialog.locator('.modal-close').click();

  await expect(goalItem).toContainText('R$ 200,00 reservados');
  await expect(incomeRow).toContainText('R$ 200,00 em metas');
  await incomeRow
    .getByRole('button', { name: `Ver distribuição da receita ${incomeName}` })
    .click();

  const allocationDialog = page.getByRole('dialog', { name: incomeName });
  const allocation = allocationDialog
    .locator('.income-allocation-item')
    .filter({ hasText: goalName });
  await expect(allocation).toContainText(contributionNote);
  await expect(allocation).toContainText('R$ 200,00');
  await allocationDialog.getByRole('button', { name: 'Fechar distribuição da receita' }).click();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Finanças' })).toBeVisible();
  await page.locator('.loading-state').waitFor({ state: 'detached' });
  await page.locator('.desktop-toolbar .notification-button').click();
  const goalNotification = page
    .getByRole('dialog', { name: 'Notificações' })
    .locator('.notification-item')
    .filter({ hasText: goalName });
  await expect(goalNotification).toContainText('Meta próxima do prazo', { timeout: 15_000 });
  await page.getByRole('button', { name: 'Fechar notificações' }).click();

  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Olá, Conta demo' })).toBeVisible();
  await expect(page.locator('.budget-item').filter({ hasText: categoryName })).toBeVisible();
  await expect(page.locator('.category-item').filter({ hasText: categoryName })).toBeVisible();

  await logout(page);
});
