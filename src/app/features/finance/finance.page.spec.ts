import { TestBed } from '@angular/core/testing';
import { NEVER, of } from 'rxjs';
import { vi } from 'vitest';

import { FinanceControlApiService } from '../../core/api/finance-control-api.service';
import { NotificationCenterService } from '../../core/notifications/notification-center.service';
import { FinancePage } from './finance.page';

describe('FinancePage', () => {
  const expense = {
    id: 'expense-id',
    description: 'Mercado',
    amount: 125.4,
    transactionDate: '2026-08-01',
    category: 'FOOD' as const,
    createdAt: '2026-08-01T12:00:00Z',
    updatedAt: '2026-08-01T12:00:00Z',
  };

  const income = {
    id: 'income-id',
    description: 'Salário mensal',
    amount: 8000,
    transactionDate: '2026-08-05',
    createdAt: '2026-08-05T12:00:00Z',
    updatedAt: '2026-08-05T12:00:00Z',
    goalAllocatedAmount: 300,
    goalAvailableAmount: 7700,
  };

  const goal = {
    id: 'goal-id',
    name: 'Reserva',
    targetAmount: 1000,
    currentAmount: 100,
    remainingAmount: 900,
    progressPercentage: 10,
    targetDate: '2027-02-10',
    status: 'ACTIVE' as const,
    requiredMonthlyContribution: 150,
    createdAt: '2026-08-10T12:00:00Z',
    updatedAt: '2026-08-10T12:00:00Z',
  };

  const defaultCategories = [
    {
      id: 1,
      code: 'FOOD',
      name: 'Alimentação',
      defaultCategory: true,
      createdAt: '2026-08-01T12:00:00Z',
      updatedAt: '2026-08-01T12:00:00Z',
    },
    {
      id: 2,
      code: 'OTHER',
      name: 'Outros',
      defaultCategory: true,
      createdAt: '2026-08-01T12:00:00Z',
      updatedAt: '2026-08-01T12:00:00Z',
    },
  ];

  const api = {
    getIncomes: vi.fn(() => of([] as (typeof income)[])),
    getFinanceCategories: vi.fn(() => of(defaultCategories)),
    createFinanceCategory: vi.fn(),
    updateFinanceCategory: vi.fn(),
    deleteFinanceCategory: vi.fn(),
    getIncomeGoalAllocations: vi.fn(),
    getExpenses: vi.fn(() => of([])),
    getRecurringTransactions: vi.fn(() => of([])),
    getMonthlyBudget: vi.fn(() =>
      of({
        referenceMonth: '2026-08',
        totalPlanned: 0,
        totalSpent: 0,
        totalRemaining: 0,
        categories: [],
      }),
    ),
    getFinancialGoals: vi.fn(() => of([] as (typeof goal)[])),
    getFinancialGoal: vi.fn(() => of(goal)),
    getFinancialGoalContributions: vi.fn(() => of([])),
    getCashFlowProjection: vi.fn(() =>
      of({
        referenceDate: '2026-08-10',
        months: 6,
        currentRecordedBalance: 0,
        totalProjectedIncome: 0,
        totalProjectedExpenses: 0,
        projectedCumulativeBalance: 0,
        items: [],
      }),
    ),
    createFinancialGoal: vi.fn((request) =>
      of({
        id: 'goal-id',
        ...request,
        remainingAmount: request.targetAmount - request.currentAmount,
        progressPercentage: 10,
        status: 'ACTIVE' as const,
        requiredMonthlyContribution: 100,
        createdAt: '2026-08-10T12:00:00Z',
        updatedAt: '2026-08-10T12:00:00Z',
      }),
    ),
    updateFinancialGoal: vi.fn(),
    deleteFinancialGoal: vi.fn(),
    createFinancialGoalContribution: vi.fn((goalId, request) =>
      of({
        id: 'contribution-id',
        financialGoalId: goalId,
        amount: request.amount,
        contributionDate: request.contributionDate,
        note: request.note,
        type: 'CONTRIBUTION' as const,
        source: request.sourceIncomeId
          ? {
              incomeId: request.sourceIncomeId,
              description: income.description,
              incomeAmount: income.amount,
              transactionDate: income.transactionDate,
            }
          : null,
        createdAt: '2026-08-11T12:00:00Z',
      }),
    ),
    deleteFinancialGoalContribution: vi.fn(),
    createIncome: vi.fn(),
    updateIncome: vi.fn(),
    deleteIncome: vi.fn(),
    createExpense: vi.fn(() => of(expense)),
    updateExpense: vi.fn(),
    deleteExpense: vi.fn(),
    createRecurringTransaction: vi.fn(),
    updateRecurringTransaction: vi.fn(),
    deleteRecurringTransaction: vi.fn(),
    setMonthlyBudget: vi.fn(),
    deleteMonthlyBudget: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    api.getIncomes.mockReturnValue(of([] as (typeof income)[]));
    api.getFinanceCategories.mockReturnValue(of(defaultCategories));
    api.getExpenses.mockReturnValue(of([]));
    api.getRecurringTransactions.mockReturnValue(of([]));
    api.getMonthlyBudget.mockReturnValue(
      of({
        referenceMonth: '2026-08',
        totalPlanned: 0,
        totalSpent: 0,
        totalRemaining: 0,
        categories: [],
      }),
    );
    api.getFinancialGoals.mockReturnValue(of([]));
    api.getFinancialGoal.mockReturnValue(of(goal));
    api.getFinancialGoalContributions.mockReturnValue(of([]));
    api.createExpense.mockReturnValue(of(expense));
    api.createFinanceCategory.mockReturnValue(
      of({
        id: 3,
        code: 'CUSTOM_SUBSCRIPTIONS',
        name: 'Assinaturas',
        defaultCategory: false,
        createdAt: '2026-08-11T12:00:00Z',
        updatedAt: '2026-08-11T12:00:00Z',
      }),
    );

    await TestBed.configureTestingModule({
      imports: [FinancePage],
      providers: [
        { provide: FinanceControlApiService, useValue: api },
        { provide: NotificationCenterService, useValue: { changes$: NEVER } },
      ],
    }).compileComponents();
  });

  it('validates required transaction fields before sending', () => {
    const fixture = TestBed.createComponent(FinancePage);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    element.querySelector<HTMLButtonElement>('.page-header .primary-button')?.click();
    fixture.detectChanges();
    element.querySelector<HTMLButtonElement>('.transaction-modal button[type="submit"]')?.click();
    fixture.detectChanges();

    expect(api.createExpense).not.toHaveBeenCalled();
    expect(element.querySelectorAll('.field-error').length).toBeGreaterThan(0);
  });

  it('creates an expense and updates the visible totals', () => {
    const fixture = TestBed.createComponent(FinancePage);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    element.querySelector<HTMLButtonElement>('.page-header .primary-button')?.click();
    fixture.detectChanges();

    const description = element.querySelector<HTMLInputElement>('#transaction-description');
    const amount = element.querySelector<HTMLInputElement>('#transaction-amount');
    if (!description || !amount) {
      throw new Error('Transaction fields were not rendered.');
    }

    description.value = 'Mercado';
    description.dispatchEvent(new Event('input'));
    amount.value = '125.40';
    amount.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    element.querySelector<HTMLButtonElement>('.transaction-modal button[type="submit"]')?.click();
    fixture.detectChanges();

    expect(api.createExpense).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'Mercado',
        amount: 125.4,
        category: 'FOOD',
      }),
    );
    expect(element.textContent).toContain('Mercado');
    expect(element.textContent).toContain('Lançamento criado com sucesso.');
  });

  it('creates a financial goal through the BFF facade', () => {
    const fixture = TestBed.createComponent(FinancePage);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    element.querySelector<HTMLButtonElement>('.compact-primary-button')?.click();
    fixture.detectChanges();
    const name = element.querySelector<HTMLInputElement>('#goal-name');
    const target = element.querySelector<HTMLInputElement>('#goal-target-amount');
    const current = element.querySelector<HTMLInputElement>('#goal-current-amount');
    if (!name || !target || !current) {
      throw new Error('Goal fields were not rendered.');
    }
    name.value = 'Reserva';
    name.dispatchEvent(new Event('input'));
    target.value = '1000';
    target.dispatchEvent(new Event('input'));
    current.value = '100';
    current.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    element.querySelector<HTMLButtonElement>('.goal-modal button[type="submit"]')?.click();
    fixture.detectChanges();

    expect(api.createFinancialGoal).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Reserva', targetAmount: 1000, currentAmount: 100 }),
    );
    expect(element.textContent).toContain('Reserva');
  });

  it('registers a contribution and keeps goal progress in the server ledger', () => {
    api.getIncomes
      .mockReturnValueOnce(of([income]))
      .mockReturnValueOnce(of([income]))
      .mockReturnValueOnce(
        of([{ ...income, goalAllocatedAmount: 800, goalAvailableAmount: 7200 }]),
      );
    api.getFinancialGoals.mockReturnValue(of([goal]));
    api.getFinancialGoal.mockReturnValue(
      of({
        ...goal,
        currentAmount: 600,
        remainingAmount: 400,
        progressPercentage: 60,
      }),
    );
    api.getFinancialGoalContributions.mockReturnValue(of([]));
    const fixture = TestBed.createComponent(FinancePage);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    element.querySelector<HTMLButtonElement>('.goal-contribution-button')?.click();
    fixture.detectChanges();
    const amount = element.querySelector<HTMLInputElement>('#contribution-amount');
    const note = element.querySelector<HTMLInputElement>('#contribution-note');
    const sourceIncome = element.querySelector<HTMLSelectElement>('#contribution-source-income');
    if (!amount || !note || !sourceIncome) {
      throw new Error('Contribution fields were not rendered.');
    }
    amount.value = '500';
    amount.dispatchEvent(new Event('input'));
    note.value = 'Economia do mês';
    note.dispatchEvent(new Event('input'));
    sourceIncome.value = income.id;
    sourceIncome.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    element.querySelector<HTMLButtonElement>('.contribution-form button[type="submit"]')?.click();
    fixture.detectChanges();

    expect(api.createFinancialGoalContribution).toHaveBeenCalledWith(
      'goal-id',
      expect.objectContaining({
        amount: 500,
        note: 'Economia do mês',
        sourceIncomeId: income.id,
      }),
    );
    expect(element.textContent).toContain('60%');
    expect(element.querySelector('.transaction-row .description small')?.textContent).toContain(
      '800',
    );
  });

  it('prevents a linked contribution from exceeding the available income amount', () => {
    api.getFinancialGoals.mockReturnValue(of([goal]));
    api.getIncomes.mockReturnValue(
      of([
        {
          ...income,
          amount: 500,
          goalAllocatedAmount: 300,
          goalAvailableAmount: 200,
        },
      ]),
    );
    const fixture = TestBed.createComponent(FinancePage);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    element.querySelector<HTMLButtonElement>('.goal-contribution-button')?.click();
    fixture.detectChanges();
    const amount = element.querySelector<HTMLInputElement>('#contribution-amount');
    const sourceIncome = element.querySelector<HTMLSelectElement>('#contribution-source-income');
    if (!amount || !sourceIncome) {
      throw new Error('Contribution allocation fields were not rendered.');
    }
    sourceIncome.value = income.id;
    sourceIncome.dispatchEvent(new Event('change'));
    amount.value = '250';
    amount.dispatchEvent(new Event('input'));
    amount.dispatchEvent(new Event('blur'));
    fixture.detectChanges();

    expect(element.textContent).toContain('já reservado');
    expect(element.textContent).toContain('disponível de');
    expect(element.textContent).toContain('O aporte supera o valor disponível dessa receita.');
    expect(
      element.querySelector<HTMLButtonElement>('.contribution-form button[type="submit"]')
        ?.disabled,
    ).toBe(true);
    expect(api.createFinancialGoalContribution).not.toHaveBeenCalled();
  });

  it('creates a custom category and makes it available in the transaction form', () => {
    const fixture = TestBed.createComponent(FinancePage);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    element.querySelector<HTMLButtonElement>('.page-header .secondary-button')?.click();
    fixture.detectChanges();
    const name = element.querySelector<HTMLInputElement>('#category-name');
    if (!name) {
      throw new Error('Category name field was not rendered.');
    }
    name.value = 'Assinaturas';
    name.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    element.querySelector<HTMLButtonElement>('.category-form button[type="submit"]')?.click();
    fixture.detectChanges();

    expect(api.createFinanceCategory).toHaveBeenCalledWith({ name: 'Assinaturas' });
    expect(element.textContent).toContain('Assinaturas');
    expect(element.textContent).toContain('Categoria personalizada criada.');

    element.querySelector<HTMLButtonElement>('.category-modal .modal-close')?.click();
    fixture.detectChanges();
    element.querySelector<HTMLButtonElement>('.page-header .primary-button')?.click();
    fixture.detectChanges();
    const options = Array.from(
      element.querySelectorAll<HTMLOptionElement>('#transaction-category option'),
    );
    expect(options.some((option) => option.value === 'CUSTOM_SUBSCRIPTIONS')).toBe(true);
  });

  it('shows the financial goals that consume an income', () => {
    api.getIncomes.mockReturnValue(of([income]));
    api.getIncomeGoalAllocations.mockReturnValue(
      of({
        incomeId: income.id,
        incomeDescription: income.description,
        incomeAmount: income.amount,
        transactionDate: income.transactionDate,
        goalAllocatedAmount: 300,
        goalAvailableAmount: 7700,
        allocations: [
          {
            contributionId: 'contribution-id',
            financialGoalId: goal.id,
            financialGoalName: goal.name,
            amount: 300,
            contributionDate: '2026-08-11',
            note: 'Reserva do mês',
            createdAt: '2026-08-11T12:00:00Z',
          },
        ],
      }),
    );
    const fixture = TestBed.createComponent(FinancePage);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    element
      .querySelector<HTMLButtonElement>('[aria-label^="Ver distribuição da receita"]')
      ?.click();
    fixture.detectChanges();

    expect(api.getIncomeGoalAllocations).toHaveBeenCalledWith(income.id);
    expect(element.querySelector('.income-allocation-modal')?.textContent).toContain('Reserva');
    expect(element.querySelector('.income-allocation-modal')?.textContent).toContain(
      'Reserva do mês',
    );
  });
});
