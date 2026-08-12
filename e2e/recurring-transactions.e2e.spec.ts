import { expect, test } from '@playwright/test';

import { loginAsDemo, logout } from './support/auth';

test.skip(
  process.env['E2E_ISOLATED'] !== 'true',
  'O ciclo de recorrências altera dados e exige o ambiente Docker E2E descartável.',
);

function firstDayOfCurrentMonth(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
}

function expectedWeeklyOccurrences(): number {
  return Math.floor((new Date().getDate() - 1) / 7) + 1;
}

test('materializa, pausa, reativa e exclui uma recorrência sem duplicar lançamentos', async ({
  page,
}) => {
  const description = `Recorrência E2E ${Date.now()}`;
  const expectedOccurrences = expectedWeeklyOccurrences();

  await loginAsDemo(page);
  await page.goto('/finance');
  await expect(page.getByRole('heading', { name: 'Finanças' })).toBeVisible();
  await page.locator('.loading-state').waitFor({ state: 'detached' });

  await page.getByRole('button', { name: 'Novo lançamento' }).click();
  const dialog = page.getByRole('dialog', { name: 'Adicionar lançamento' });
  await dialog.getByRole('button', { name: 'Despesa' }).click();
  await dialog.locator('#transaction-description').fill(description);
  await dialog.locator('#transaction-amount').fill('25');
  await dialog.locator('#transaction-date').fill(firstDayOfCurrentMonth());
  await dialog.locator('#transaction-category').selectOption('FOOD');
  const recurringCheckbox = dialog.locator('input[formControlName="recurring"]');
  await dialog.locator('label.switch-field').click();
  await expect(recurringCheckbox).toBeChecked();
  await dialog.locator('#transaction-frequency').selectOption('WEEKLY');
  await dialog.getByRole('button', { name: 'Adicionar lançamento' }).click();

  const recurringRule = page.locator('.recurring-row').filter({ hasText: description });
  const generatedTransactions = page.locator('.transaction-row').filter({ hasText: description });
  await expect(recurringRule).toContainText('Semanal');
  await expect(recurringRule).toContainText('Ativa');
  await expect(generatedTransactions).toHaveCount(expectedOccurrences);
  for (let index = 0; index < expectedOccurrences; index += 1) {
    await expect(generatedTransactions.nth(index)).toContainText('Recorrente');
  }

  await recurringRule.getByRole('button', { name: 'Pausar recorrência' }).click();
  await expect(recurringRule).toContainText('Pausada');
  await expect(page.getByRole('status')).toContainText('Recorrência pausada');

  await recurringRule.getByRole('button', { name: 'Reativar recorrência' }).click();
  await expect(recurringRule).toContainText('Ativa');
  await expect(page.getByRole('status')).toContainText('Recorrência reativada');
  await page.locator('.loading-state').waitFor({ state: 'detached' });
  await expect(generatedTransactions).toHaveCount(expectedOccurrences);

  await recurringRule.getByRole('button', { name: 'Excluir regra recorrente' }).click();
  await expect(recurringRule).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('lançamentos já gerados foram mantidos');

  await page.reload();
  await page.locator('.loading-state').waitFor({ state: 'detached' });
  await expect(page.locator('.recurring-row').filter({ hasText: description })).toHaveCount(0);
  await expect(page.locator('.transaction-row').filter({ hasText: description })).toHaveCount(
    expectedOccurrences,
  );

  await logout(page);
});
