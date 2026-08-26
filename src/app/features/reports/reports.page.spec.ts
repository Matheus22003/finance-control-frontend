import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { ReportOverviewResponse } from '../../core/api/api.models';
import { FinanceControlApiService } from '../../core/api/finance-control-api.service';
import { ReportsPage } from './reports.page';

describe('ReportsPage', () => {
  const report: ReportOverviewResponse = {
    fromMonth: '2026-01',
    toMonth: '2026-06',
    monthCount: 6,
    generatedAt: '2026-08-26T12:00:00Z',
    finance: {
      totalIncome: 12000,
      totalExpenses: 7500,
      balance: 4500,
      savingsRatePercentage: 37.5,
      incomeCount: 6,
      expenseCount: 18,
      months: [
        {
          referenceMonth: '2026-06',
          totalIncome: 2000,
          totalExpenses: 1250,
          balance: 750,
        },
      ],
      expenseCategories: [{ category: 'FOOD', name: 'Alimentação', amount: 3000, percentage: 40 }],
      topExpenses: [
        {
          id: 'expense-id',
          description: 'Supermercado',
          amount: 450,
          transactionDate: '2026-06-15',
          category: 'FOOD',
          categoryName: 'Alimentação',
        },
      ],
    },
    debts: {
      totalVolume: 900,
      totalOwed: 300,
      totalToReceive: 150,
      openDebtsCount: 4,
      paidDebtsCount: 2,
      months: [],
      categories: [
        {
          category: 'TRAVEL',
          totalVolume: 500,
          totalOwed: 200,
          totalToReceive: 50,
          debtCount: 2,
        },
      ],
      topDebts: [
        {
          id: 'debt-id',
          description: 'Viagem compartilhada',
          category: 'TRAVEL',
          totalAmount: 500,
          totalOwed: 200,
          totalToReceive: 0,
          status: 'OPEN',
          dueDate: null,
          createdAt: '2026-06-10T12:00:00Z',
        },
      ],
    },
    highlights: {
      averageMonthlyIncome: 2000,
      averageMonthlyExpenses: 1250,
      bestBalanceMonth: '2026-06',
      highestExpenseCategory: 'Alimentação',
    },
  };
  const api = {
    getReportOverview: vi.fn(() => of(report)),
    exportReportCsv: vi.fn(() => of(new Blob(['report']))),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    api.getReportOverview.mockReturnValue(of(report));
    await TestBed.configureTestingModule({
      imports: [ReportsPage],
      providers: [{ provide: FinanceControlApiService, useValue: api }],
    }).compileComponents();
  });

  it('loads and renders the analytical finance and debt history', () => {
    const fixture = TestBed.createComponent(ReportsPage);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(api.getReportOverview).toHaveBeenCalledOnce();
    expect(element.textContent).toContain('Histórico analítico');
    expect(element.textContent).toContain('Alimentação');
    expect(element.textContent).toContain('Supermercado');
    expect(element.textContent).toContain('Viagem compartilhada');
    expect(element.querySelectorAll('.chart-column')).toHaveLength(1);
  });
});
