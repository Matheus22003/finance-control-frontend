import { expect, Locator, Page, test } from '@playwright/test';

import { demoAccount, friendAccount, loginAsDemo, loginAsFriend, logout } from './support/auth';

const friendName = 'Conta amiga';
const ownerName = 'Conta demo';

test.skip(
  process.env['E2E_ISOLATED'] !== 'true',
  'O fluxo multiusuário altera dados e exige o ambiente Docker E2E descartável.',
);

async function resetAndCreateFriendship(ownerPage: Page, friendPage: Page): Promise<void> {
  await ownerPage.goto('/social');
  await expect(ownerPage.getByRole('heading', { name: 'Amigos & grupos' })).toBeVisible();
  await ownerPage.locator('.loading-state').waitFor({ state: 'detached' });

  const existingFriend = ownerPage.locator('.friend-card').filter({ hasText: friendAccount.email });
  if (await existingFriend.isVisible()) {
    await existingFriend.getByRole('button', { name: 'Remover' }).click();
    await expect(existingFriend).toHaveCount(0);
  }

  await ownerPage.locator('#friend-email').fill(friendAccount.email);
  await ownerPage.getByRole('button', { name: 'Enviar convite' }).click();
  await expect(ownerPage.getByRole('status')).toContainText('Convite enviado');

  await friendPage.goto('/social');
  await expect(friendPage.getByRole('heading', { name: 'Amigos & grupos' })).toBeVisible();
  await friendPage.locator('.loading-state').waitFor({ state: 'detached' });

  const incomingRequest = friendPage.locator('.request-row').filter({ hasText: demoAccount.email });
  await expect(incomingRequest).toBeVisible();
  await incomingRequest.getByRole('button', { name: 'Aceitar' }).click();
  await expect(friendPage.getByRole('status')).toContainText('Amizade aceita');

  await ownerPage.goto('/social');
  await expect(
    ownerPage.locator('.friend-card').filter({ hasText: friendAccount.email }),
  ).toBeVisible();
}

async function createSharedDebt(page: Page, debtName: string): Promise<void> {
  await page.goto('/debts');
  await expect(page.getByRole('heading', { name: 'Dívidas', exact: true })).toBeVisible();
  await page.locator('.loading-state').waitFor({ state: 'detached' });
  await page.getByRole('button', { name: 'Nova dívida' }).click();

  const dialog = page.getByRole('dialog', { name: 'Dividir uma despesa' });
  await dialog.locator('#debt-description').fill(debtName);
  await dialog.locator('#debt-total').fill('60');
  await dialog.locator('#debt-category').selectOption('FOOD');
  await dialog.locator('#debt-payer').selectOption({ label: `${ownerName} (você)` });

  const friendParticipant = dialog
    .locator('.participant-row')
    .filter({ hasText: friendAccount.email });
  await friendParticipant.getByRole('checkbox').check();
  await dialog.getByLabel(`Parte de ${friendName}`).fill('60');
  await dialog.getByRole('button', { name: 'Criar dívida' }).click();

  await expect(page.locator('.debt-item').filter({ hasText: debtName })).toBeVisible();
}

async function editSharedDebt(page: Page, currentName: string, updatedName: string): Promise<void> {
  const currentDebt = page.locator('.debt-item').filter({ hasText: currentName });
  await currentDebt.getByRole('button', { name: `Editar ${currentName}` }).click();

  const dialog = page.getByRole('dialog', { name: 'Atualizar dívida' });
  await expect(
    dialog
      .locator('.participant-row')
      .filter({ hasText: friendAccount.email })
      .getByRole('checkbox'),
  ).toBeChecked();
  await dialog.locator('#debt-description').fill(updatedName);
  await dialog.getByRole('button', { name: 'Salvar alterações' }).click();

  await expect(page.locator('.debt-item').filter({ hasText: updatedName })).toBeVisible();
  await expect(
    page.locator('.debt-copy > strong').getByText(currentName, { exact: true }),
  ).toHaveCount(0);
}

async function getSettlementTransfer(page: Page): Promise<Locator> {
  await page.goto('/debts');
  await expect(page.getByRole('heading', { name: 'Dívidas', exact: true })).toBeVisible();
  await page.locator('.loading-state').waitFor({ state: 'detached' });
  await expect(page.locator('#settlement-group')).toHaveValue('');

  const transfer = page
    .locator('.transfer-item')
    .filter({ hasText: friendName })
    .filter({ hasText: ownerName });
  await expect(transfer).toBeVisible();
  return transfer;
}

test('autoriza amizade e quita uma dívida por pagamento simplificado entre duas contas', async ({
  browser,
  page,
}, testInfo) => {
  const friendContext = await browser.newContext({
    baseURL: testInfo.project.use.baseURL,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  });
  const friendPage = await friendContext.newPage();
  const initialDebtName = `Dívida E2E compartilhada ${Date.now()}-${testInfo.workerIndex}`;
  const debtName = `${initialDebtName} editada`;

  await loginAsDemo(page);
  await loginAsFriend(friendPage);

  try {
    await resetAndCreateFriendship(page, friendPage);
    await createSharedDebt(page, initialDebtName);
    await editSharedDebt(page, initialDebtName, debtName);

    const payerTransfer = await getSettlementTransfer(friendPage);
    await payerTransfer.getByRole('button', { name: 'Registrar pagamento' }).click();

    const paymentDialog = friendPage.getByRole('dialog', { name: 'Registrar transferência' });
    await paymentDialog
      .locator('#settlement-payment-note')
      .fill('PIX E2E enviado pela conta amiga.');
    await paymentDialog.getByRole('button', { name: 'Enviar para confirmação' }).click();
    await expect(friendPage.getByRole('status')).toContainText(
      'Transferência enviada para confirmação',
    );

    const receiverTransfer = await getSettlementTransfer(page);
    await receiverTransfer.getByRole('button', { name: 'Confirmar recebimento' }).click();
    await expect(page.getByRole('status')).toContainText('Transferência confirmada');

    const paidDebt = page.locator('.debt-item').filter({ hasText: debtName });
    await expect(paidDebt.locator('.status-badge')).toHaveText('Paga');
  } finally {
    if (!friendPage.isClosed()) await logout(friendPage);
    await friendContext.close();
    if (!page.isClosed()) await logout(page);
  }
});
