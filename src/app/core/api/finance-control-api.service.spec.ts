import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { FinanceControlApiService } from './finance-control-api.service';

describe('FinanceControlApiService', () => {
  let service: FinanceControlApiService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(FinanceControlApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('builds the dashboard using only BFF endpoints', () => {
    let resultDescription = '';
    service.getDashboard().subscribe((result) => {
      resultDescription = result.recentTransactions[0]?.description ?? '';
    });

    httpTesting.expectOne('/api/v1/dashboard').flush({
      balance: 750,
      totalIncome: 1000,
      totalExpenses: 250,
      debtsSummary: { totalOwed: 0, totalToReceive: 120, openDebtsCount: 1 },
      budget: {
        referenceMonth: '2026-08',
        totalPlanned: 0,
        totalSpent: 250,
        totalRemaining: -250,
        categories: [],
      },
      monthlyTrend: [],
      budgetAlerts: [],
    });
    httpTesting.expectOne('/api/v1/users/me').flush({
      id: 'user-id',
      displayName: 'Conta demo',
      email: 'demo@financecontrol.local',
    });
    httpTesting.expectOne('/api/v1/finance/incomes').flush([
      {
        id: 'income-id',
        description: 'Salário',
        amount: 1000,
        transactionDate: '2026-08-01',
        createdAt: '2026-08-01T12:00:00Z',
        updatedAt: '2026-08-01T12:00:00Z',
      },
    ]);
    httpTesting.expectOne('/api/v1/finance/expenses').flush([]);
    httpTesting.expectOne('/api/v1/debts').flush([]);
    httpTesting.expectOne('/api/v1/debts/payments/pending-confirmation').flush([]);
    httpTesting
      .expectOne('/api/v1/debts/settlements/simplified/transfers/pending-confirmation')
      .flush([]);
    httpTesting.expectOne('/api/v1/debts/settlements/simplified').flush({
      totalOpenAmount: 0,
      originalTransferCount: 0,
      simplifiedTransferCount: 0,
      transfers: [],
    });

    expect(resultDescription).toBe('Salário');
  });

  it('sends finance mutations only through versioned BFF endpoints', () => {
    const incomeRequest = {
      description: 'Salário',
      amount: 5000,
      transactionDate: '2026-08-01',
    };
    const expenseRequest = {
      description: 'Mercado',
      amount: 350.5,
      transactionDate: '2026-08-02',
      category: 'FOOD' as const,
    };

    service.createIncome(incomeRequest).subscribe();
    const createIncome = httpTesting.expectOne('/api/v1/finance/incomes');
    expect(createIncome.request.method).toBe('POST');
    expect(createIncome.request.body).toEqual(incomeRequest);
    createIncome.flush({ id: 'income-id', ...incomeRequest, createdAt: '', updatedAt: '' });

    service.updateIncome('income-id', incomeRequest).subscribe();
    const updateIncome = httpTesting.expectOne('/api/v1/finance/incomes/income-id');
    expect(updateIncome.request.method).toBe('PUT');
    updateIncome.flush({ id: 'income-id', ...incomeRequest, createdAt: '', updatedAt: '' });

    service.deleteIncome('income-id').subscribe();
    const deleteIncome = httpTesting.expectOne('/api/v1/finance/incomes/income-id');
    expect(deleteIncome.request.method).toBe('DELETE');
    deleteIncome.flush(null);

    service.createExpense(expenseRequest).subscribe();
    const createExpense = httpTesting.expectOne('/api/v1/finance/expenses');
    expect(createExpense.request.method).toBe('POST');
    expect(createExpense.request.body).toEqual(expenseRequest);
    createExpense.flush({ id: 'expense-id', ...expenseRequest, createdAt: '', updatedAt: '' });

    service.updateExpense('expense-id', expenseRequest).subscribe();
    const updateExpense = httpTesting.expectOne('/api/v1/finance/expenses/expense-id');
    expect(updateExpense.request.method).toBe('PUT');
    updateExpense.flush({ id: 'expense-id', ...expenseRequest, createdAt: '', updatedAt: '' });

    service.deleteExpense('expense-id').subscribe();
    const deleteExpense = httpTesting.expectOne('/api/v1/finance/expenses/expense-id');
    expect(deleteExpense.request.method).toBe('DELETE');
    deleteExpense.flush(null);
  });

  it('sends debt and quick-person mutations only through versioned BFF endpoints', () => {
    const personRequest = { name: 'Ana', email: 'ana@example.com', isCurrentUser: false };
    service.createPerson(personRequest).subscribe();
    const createPerson = httpTesting.expectOne('/api/v1/people');
    expect(createPerson.request.method).toBe('POST');
    expect(createPerson.request.body).toEqual(personRequest);
    createPerson.flush({
      id: 'person-id',
      ...personRequest,
      createdAt: '',
      updatedAt: '',
    });

    const debtRequest = {
      description: 'Jantar',
      totalAmount: 120,
      paidByPersonId: 'payer-id',
      groupId: null,
      category: 'FOOD' as const,
      dueDate: null,
      shares: [{ personId: 'person-id', amount: 120 }],
    };
    service.createDebt(debtRequest).subscribe();
    const createDebt = httpTesting.expectOne('/api/v1/debts');
    expect(createDebt.request.method).toBe('POST');
    expect(createDebt.request.body).toEqual(debtRequest);
    createDebt.flush({});

    const updateRequest = {
      description: 'Jantar atualizado',
      paidByPersonId: 'payer-id',
      category: 'FOOD' as const,
      dueDate: null,
      shares: [{ personId: 'person-id', amount: 120 }],
    };
    service.updateDebt('debt-id', updateRequest).subscribe();
    const updateDebt = httpTesting.expectOne('/api/v1/debts/debt-id');
    expect(updateDebt.request.method).toBe('PUT');
    expect(updateDebt.request.body).toEqual(updateRequest);
    updateDebt.flush({});

    service.deleteDebt('debt-id').subscribe();
    const deleteDebt = httpTesting.expectOne('/api/v1/debts/debt-id');
    expect(deleteDebt.request.method).toBe('DELETE');
    deleteDebt.flush(null);
  });

  it('uses only BFF endpoints for payment confirmation and history', () => {
    const paymentRequest = {
      amount: 50,
      paymentDate: '2026-08-01',
      note: 'PIX',
    };

    service.createDebtPayment('debt-id', 'share-id', paymentRequest).subscribe();
    const createPayment = httpTesting.expectOne('/api/v1/debts/debt-id/shares/share-id/payments');
    expect(createPayment.request.method).toBe('POST');
    expect(createPayment.request.body).toEqual(paymentRequest);
    createPayment.flush({});

    service.getDebtPayments('debt-id').subscribe();
    const payments = httpTesting.expectOne('/api/v1/debts/debt-id/payments');
    expect(payments.request.method).toBe('GET');
    payments.flush([]);

    service.getPendingPaymentConfirmations().subscribe();
    const pending = httpTesting.expectOne('/api/v1/debts/payments/pending-confirmation');
    expect(pending.request.method).toBe('GET');
    pending.flush([]);

    service.confirmDebtPayment('debt-id', 'payment-id').subscribe();
    const confirm = httpTesting.expectOne('/api/v1/debts/debt-id/payments/payment-id/confirm');
    expect(confirm.request.method).toBe('POST');
    confirm.flush({});

    service.rejectDebtPayment('debt-id', 'payment-id').subscribe();
    const reject = httpTesting.expectOne('/api/v1/debts/debt-id/payments/payment-id/reject');
    expect(reject.request.method).toBe('POST');
    reject.flush({});

    service.getDebtHistory('debt-id').subscribe();
    const history = httpTesting.expectOne('/api/v1/debts/debt-id/history');
    expect(history.request.method).toBe('GET');
    history.flush([]);
  });

  it('requests the simplified plan for the selected group through the BFF', () => {
    service.getSimplifiedSettlements('group-id').subscribe();

    const request = httpTesting.expectOne(
      (candidate) =>
        candidate.url === '/api/v1/debts/settlements/simplified' &&
        candidate.params.get('groupId') === 'group-id',
    );
    expect(request.request.method).toBe('GET');
    request.flush({
      totalOpenAmount: 150,
      originalTransferCount: 3,
      simplifiedTransferCount: 2,
      transfers: [],
    });
  });

  it('uses only BFF endpoints for simplified settlement transfers', () => {
    const requestBody = {
      groupId: 'group-id',
      fromPersonId: 'payer-id',
      toPersonId: 'recipient-id',
      amount: 30,
      paymentDate: '2026-08-03',
      note: 'PIX',
    };

    service.getActiveSettlementTransfers('group-id').subscribe();
    const active = httpTesting.expectOne(
      (request) =>
        request.url === '/api/v1/debts/settlements/simplified/transfers' &&
        request.params.get('groupId') === 'group-id',
    );
    expect(active.request.method).toBe('GET');
    active.flush([]);

    service.getPendingSettlementTransferConfirmations().subscribe();
    const pending = httpTesting.expectOne(
      '/api/v1/debts/settlements/simplified/transfers/pending-confirmation',
    );
    expect(pending.request.method).toBe('GET');
    pending.flush([]);

    service.recordSettlementTransfer(requestBody).subscribe();
    const record = httpTesting.expectOne('/api/v1/debts/settlements/simplified/transfers');
    expect(record.request.method).toBe('POST');
    expect(record.request.body).toEqual(requestBody);
    record.flush({});

    service.confirmSettlementTransfer('transfer-id').subscribe();
    const confirm = httpTesting.expectOne(
      '/api/v1/debts/settlements/simplified/transfers/transfer-id/confirm',
    );
    expect(confirm.request.method).toBe('POST');
    confirm.flush({});

    service.rejectSettlementTransfer('transfer-id').subscribe();
    const reject = httpTesting.expectOne(
      '/api/v1/debts/settlements/simplified/transfers/transfer-id/reject',
    );
    expect(reject.request.method).toBe('POST');
    reject.flush({});
  });

  it('uses only protected BFF endpoints for the notification center', () => {
    service.getNotifications(true, 20).subscribe();
    const list = httpTesting.expectOne(
      (request) =>
        request.url === '/api/v1/notifications' &&
        request.params.get('unreadOnly') === 'true' &&
        request.params.get('limit') === '20',
    );
    expect(list.request.method).toBe('GET');
    list.flush([]);

    service.getUnreadNotificationCount().subscribe();
    const count = httpTesting.expectOne('/api/v1/notifications/unread-count');
    expect(count.request.method).toBe('GET');
    count.flush({ unreadCount: 2 });

    service.markNotificationAsRead('notification-id').subscribe();
    const markRead = httpTesting.expectOne('/api/v1/notifications/notification-id/read');
    expect(markRead.request.method).toBe('POST');
    expect(markRead.request.body).toBeNull();
    markRead.flush({});

    service.markAllNotificationsAsRead().subscribe();
    const markAll = httpTesting.expectOne('/api/v1/notifications/read-all');
    expect(markAll.request.method).toBe('POST');
    expect(markAll.request.body).toBeNull();
    markAll.flush({ unreadCount: 0 });
  });

  it('requests AI analysis only through the protected BFF endpoint', () => {
    service.analyzeFinancialLife('2026-08').subscribe();

    const request = httpTesting.expectOne('/api/v1/ai/analyze');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ month: '2026-08' });
    request.flush({
      generatedAt: '2026-08-04T12:00:00Z',
      provider: 'mock',
      referenceMonth: '2026-08',
      overview: 'Resumo',
      metrics: {},
      financeInsights: [],
      debtInsights: [],
      recommendations: [],
    });
  });

  it('sends financial questions only to the protected BFF endpoint', () => {
    service.askAboutFinancialLife('Quem ainda me deve?').subscribe();

    const request = httpTesting.expectOne('/api/v1/ai/ask');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ question: 'Quem ainda me deve?' });
    request.flush({
      generatedAt: '2026-08-04T12:00:00Z',
      provider: 'mock',
      answer: 'Ana ainda deve R$ 50,00.',
      suggestedQuestions: [],
    });
  });
});
