import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { FinanceControlApiService } from '../../core/api/finance-control-api.service';
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

  const api = {
    getIncomes: vi.fn(() => of([])),
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
    api.getIncomes.mockReturnValue(of([]));
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
    api.createExpense.mockReturnValue(of(expense));

    await TestBed.configureTestingModule({
      imports: [FinancePage],
      providers: [{ provide: FinanceControlApiService, useValue: api }],
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
});
