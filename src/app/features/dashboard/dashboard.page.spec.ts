import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NEVER, of } from 'rxjs';
import { vi } from 'vitest';

import {
  DashboardViewData,
  FinanceControlApiService,
} from '../../core/api/finance-control-api.service';
import { DebtNotificationsService } from '../../core/debts/debt-notifications.service';
import { NotificationCenterService } from '../../core/notifications/notification-center.service';
import { DashboardPage } from './dashboard.page';

describe('DashboardPage', () => {
  const pendingPayment = {
    id: 'payment-id',
    debtId: 'debt-id',
    debtShareId: 'share-id',
    fromPerson: { id: 'friend-person-id', name: 'Conta amiga', isCurrentUser: false },
    toPerson: { id: 'demo-person-id', name: 'Conta demo', isCurrentUser: true },
    amount: 50,
    paymentDate: '2026-08-01',
    note: 'PIX',
    recordedByUserId: 'friend-user-id',
    confirmationRequiredFromUserId: 'demo-user-id',
    status: 'PENDING' as const,
    confirmedAt: null,
    rejectedAt: null,
    canConfirm: true,
    canReject: true,
    canEdit: false,
    canDelete: false,
    createdAt: '2026-08-01T12:00:00Z',
    updatedAt: '2026-08-01T12:00:00Z',
  };
  const pendingSettlement = {
    id: 'settlement-transfer-id',
    settlementPlanId: 'settlement-plan-id',
    groupId: 'group-id',
    fromIdentityId: 'friend-user-id',
    fromPerson: { id: 'friend-person-id', name: 'Conta amiga', isCurrentUser: false },
    toIdentityId: 'demo-user-id',
    toPerson: { id: 'demo-person-id', name: 'Conta demo', isCurrentUser: true },
    amount: 30,
    paymentDate: '2026-08-03',
    note: 'PIX simplificado',
    status: 'PENDING' as const,
    canRecord: false,
    canConfirm: true,
    canReject: true,
    confirmedAt: null,
    rejectedAt: null,
    createdAt: '2026-08-03T12:00:00Z',
    updatedAt: '2026-08-03T12:00:00Z',
  };
  const dashboard: DashboardViewData = {
    summary: {
      balance: 1000,
      totalIncome: 1500,
      totalExpenses: 500,
      debtsSummary: { totalOwed: 0, totalToReceive: 50, openDebtsCount: 1 },
      budget: {
        referenceMonth: '2026-08',
        totalPlanned: 1000,
        totalSpent: 500,
        totalRemaining: 500,
        categories: [],
      },
      monthlyTrend: [],
      budgetAlerts: [],
      goals: [],
      cashFlowProjection: {
        referenceDate: '2026-08-10',
        months: 6,
        currentRecordedBalance: 1000,
        totalProjectedIncome: 0,
        totalProjectedExpenses: 0,
        projectedCumulativeBalance: 0,
        items: [],
      },
    },
    currentUser: {
      id: 'demo-user-id',
      displayName: 'Conta demo',
      email: 'demo@financecontrol.local',
    },
    recentTransactions: [],
    categoryTotals: [],
    debts: [
      {
        id: 'debt-id',
        description: 'Hotel compartilhado',
        totalAmount: 100,
        paidBy: { id: 'demo-person-id', name: 'Conta demo', isCurrentUser: true },
        groupId: null,
        category: 'TRAVEL',
        status: 'OPEN',
        dueDate: null,
        createdByCurrentUser: false,
        createdAt: '2026-08-01T11:00:00Z',
        updatedAt: '2026-08-01T11:00:00Z',
        shares: [],
      },
    ],
    pendingConfirmations: [pendingPayment],
    pendingSettlementConfirmations: [],
    settlements: {
      totalOpenAmount: 0,
      originalTransferCount: 0,
      simplifiedTransferCount: 0,
      transfers: [],
    },
  };
  const api = {
    getDashboard: vi.fn(() => of(dashboard)),
    confirmDebtPayment: vi.fn(() => of({ ...pendingPayment, status: 'CONFIRMED' as const })),
    rejectDebtPayment: vi.fn(),
    confirmSettlementTransfer: vi.fn(),
    rejectSettlementTransfer: vi.fn(),
    analyzeFinancialLife: vi.fn(() =>
      of({
        generatedAt: '2026-08-04T12:00:00Z',
        provider: 'mock',
        referenceMonth: '2026-08',
        overview: 'Seu mês está equilibrado e há valores a receber.',
        metrics: {
          totalIncome: 1500,
          totalExpenses: 500,
          balance: 1000,
          totalOwed: 0,
          totalToReceive: 50,
          openDebtsCount: 1,
          overdueDebtsCount: 0,
          dueSoonDebtsCount: 0,
          originalTransferCount: 0,
          simplifiedTransferCount: 0,
        },
        financeInsights: [
          { severity: 'POSITIVE', title: 'Resultado positivo', description: 'Saldo saudável.' },
        ],
        debtInsights: [
          { severity: 'INFO', title: 'Posição nas dívidas', description: 'Você tem valores a receber.' },
        ],
        recommendations: ['Continue acompanhando os lançamentos.'],
      }),
    ),
    askAboutFinancialLife: vi.fn(() =>
      of({
        generatedAt: '2026-08-04T12:00:00Z',
        provider: 'mock',
        answer: 'Conta amiga ainda deve R$ 50,00 pela alimentação.',
        suggestedQuestions: ['De onde acumulei minhas dívidas?'],
      }),
    ),
  };
  const notifications = { setCount: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    api.getDashboard.mockReturnValue(of(dashboard));
    api.confirmDebtPayment.mockReturnValue(of({ ...pendingPayment, status: 'CONFIRMED' as const }));
    await TestBed.configureTestingModule({
      imports: [DashboardPage],
      providers: [
        provideRouter([]),
        { provide: FinanceControlApiService, useValue: api },
        { provide: DebtNotificationsService, useValue: notifications },
        { provide: NotificationCenterService, useValue: { changes$: NEVER } },
      ],
    }).compileComponents();
  });

  it('shows pending confirmations and confirms from the dashboard', () => {
    const fixture = TestBed.createComponent(DashboardPage);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('Olá, Conta demo');
    expect(element.textContent).toContain('Hotel compartilhado');
    expect(element.textContent).toContain('Conta amiga');
    element.querySelector<HTMLButtonElement>('.pending-actions .primary-button')?.click();

    expect(api.confirmDebtPayment).toHaveBeenCalledWith('debt-id', 'payment-id');
    expect(notifications.setCount).toHaveBeenCalledWith(1);
  });

  it('confirms a simplified settlement transfer from the dashboard', () => {
    api.getDashboard.mockReturnValue(
      of({
        ...dashboard,
        pendingConfirmations: [],
        pendingSettlementConfirmations: [pendingSettlement],
      }),
    );
    api.confirmSettlementTransfer.mockReturnValue(
      of({ ...pendingSettlement, status: 'CONFIRMED' as const, canConfirm: false }),
    );
    const fixture = TestBed.createComponent(DashboardPage);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('Pagamento simplificado');
    element.querySelector<HTMLButtonElement>('.settlement-pending-item .primary-button')?.click();

    expect(api.confirmSettlementTransfer).toHaveBeenCalledWith('settlement-transfer-id');
    expect(notifications.setCount).toHaveBeenCalledWith(1);
  });

  it('generates the financial and debt analysis on demand', () => {
    const fixture = TestBed.createComponent(DashboardPage);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    element.querySelector<HTMLButtonElement>('.ai-action')?.click();
    fixture.detectChanges();

    expect(api.analyzeFinancialLife).toHaveBeenCalledOnce();
    expect(element.textContent).toContain('Seu mês está equilibrado');
    expect(element.textContent).toContain('Posição nas dívidas');
    expect(element.textContent).toContain('Análise demonstrativa');
  });

  it('asks a suggested question and shows the answer in the conversation', () => {
    const fixture = TestBed.createComponent(DashboardPage);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    element.querySelector<HTMLButtonElement>('.question-suggestions button')?.click();
    fixture.detectChanges();

    expect(api.askAboutFinancialLife).toHaveBeenCalledWith('Quem ainda me deve dinheiro?');
    expect(element.textContent).toContain('Conta amiga ainda deve R$ 50,00');
    expect(element.querySelectorAll('.ai-message')).toHaveLength(2);
  });
});
