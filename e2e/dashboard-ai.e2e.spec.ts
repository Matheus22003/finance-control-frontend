import { expect, Page, test } from '@playwright/test';

import { loginAsDemo, logout } from './support/auth';

test.skip(
  process.env['E2E_ISOLATED'] !== 'true',
  'O cenário altera dados e exige o ambiente Docker E2E descartável.',
);

function currentDate(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function createTransaction(
  page: Page,
  kind: 'Receita' | 'Despesa',
  description: string,
  amount: string,
  category?: string,
): Promise<void> {
  await page.getByRole('button', { name: 'Novo lançamento' }).click();
  const dialog = page.getByRole('dialog', { name: 'Adicionar lançamento' });
  await dialog.getByRole('button', { name: kind }).click();
  await dialog.locator('#transaction-description').fill(description);
  await dialog.locator('#transaction-amount').fill(amount);
  await dialog.locator('#transaction-date').fill(currentDate());
  if (category) {
    await dialog.locator('#transaction-category').selectOption(category);
  }
  await dialog.getByRole('button', { name: 'Adicionar lançamento' }).click();
  await expect(page.locator('.transaction-row').filter({ hasText: description })).toBeVisible();
}

test('agrega finanças no dashboard e responde perguntas com o provedor mock', async ({ page }) => {
  test.setTimeout(90_000);

  const suffix = Date.now();
  const incomeDescription = `Receita dashboard E2E ${suffix}`;
  const expenseDescription = `Alimentação dashboard E2E ${suffix}`;
  const question = 'Quanto gastei com alimentação?';

  await loginAsDemo(page);
  await page.goto('/finance');
  await expect(page.getByRole('heading', { name: 'Finanças' })).toBeVisible();
  await page.locator('.loading-state').waitFor({ state: 'detached' });

  await createTransaction(page, 'Receita', incomeDescription, '300');
  await createTransaction(page, 'Despesa', expenseDescription, '75', 'FOOD');

  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Olá, Conta demo' })).toBeVisible();

  const incomeCard = page
    .locator('.summary-card')
    .filter({ has: page.getByText('Receitas', { exact: true }) });
  const expenseCard = page
    .locator('.summary-card')
    .filter({ has: page.getByText('Despesas', { exact: true }) });
  await expect(incomeCard).toContainText('R$ 300,00');
  await expect(expenseCard).toContainText('R$ 75,00');
  await expect(page.locator('.category-item').filter({ hasText: 'Alimentação' })).toContainText(
    'R$ 75,00',
  );

  await page.getByRole('button', { name: 'Gerar análise' }).click();
  await expect(page.locator('.ai-overview')).toBeVisible();
  await expect(page.locator('.ai-disclaimer')).toContainText('Análise demonstrativa');
  await expect(
    page.locator('.ai-insight').filter({ hasText: 'Resultado mensal positivo' }),
  ).toBeVisible();

  await page.locator('#ai-financial-question').fill(question);
  await page.getByRole('button', { name: 'Perguntar' }).click();

  const conversation = page.locator('.ai-conversation');
  await expect(conversation.locator('.ai-message.user')).toContainText(question);
  const answer = conversation.locator('.ai-message:not(.user):not(.thinking)');
  await expect(answer).toBeVisible();
  await expect(answer.locator('p')).toContainText('Você gastou R$ 75,00 com alimentação');
  await expect(page.getByLabel('Sugestões de perguntas')).toContainText(question);

  await logout(page);
});
