import { CurrencyPipe, DatePipe, DecimalPipe, PercentPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import {
  CategoryTotal,
  DashboardViewData,
  FinanceControlApiService,
} from '../../core/api/finance-control-api.service';
import {
  AiAnalysisResponse,
  BudgetCategoryResponse,
  DebtResponse,
  FinanceCategory,
  FinanceTrendMonth,
  PaymentResponse,
  SettlementTransferResponse,
} from '../../core/api/api.models';
import { DebtNotificationsService } from '../../core/debts/debt-notifications.service';
import { NotificationCenterService } from '../../core/notifications/notification-center.service';

const CATEGORY_LABELS: Record<FinanceCategory, string> = {
  FOOD: 'Alimentação',
  TRANSPORT: 'Transporte',
  RENT: 'Moradia',
  LEISURE: 'Lazer',
  HEALTH: 'Saúde',
  OTHER: 'Outros',
};

const CATEGORY_ICONS: Record<FinanceCategory, string> = {
  FOOD: 'FO',
  TRANSPORT: 'TR',
  RENT: 'MO',
  LEISURE: 'LA',
  HEALTH: 'SA',
  OTHER: 'OU',
};

interface AiChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

@Component({
  selector: 'app-dashboard-page',
  imports: [CurrencyPipe, DatePipe, DecimalPipe, PercentPipe, RouterLink],
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPage {
  private readonly api = inject(FinanceControlApiService);
  private readonly debtNotifications = inject(DebtNotificationsService);
  private readonly notificationCenter = inject(NotificationCenterService);

  protected readonly data = signal<DashboardViewData | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly actionMessage = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);
  protected readonly processingPaymentId = signal<string | null>(null);
  protected readonly processingSettlementTransferId = signal<string | null>(null);
  protected readonly aiAnalysis = signal<AiAnalysisResponse | null>(null);
  protected readonly isAnalyzing = signal(false);
  protected readonly aiError = signal<string | null>(null);
  protected readonly aiQuestion = signal('');
  protected readonly aiConversation = signal<AiChatMessage[]>([]);
  protected readonly isAskingAi = signal(false);
  protected readonly aiQuestionError = signal<string | null>(null);
  protected readonly suggestedQuestions = signal<string[]>([
    'Quem ainda me deve dinheiro?',
    'De onde acumulei minhas dívidas?',
    'Quanto gastei com alimentação?',
  ]);
  protected readonly referenceMonthValue = `${new Date().getFullYear()}-${String(
    new Date().getMonth() + 1,
  ).padStart(2, '0')}`;
  protected readonly referenceMonth = new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  protected readonly balanceTrend = computed(() => {
    const summary = this.data()?.summary;
    if (!summary || summary.totalIncome === 0) {
      return 0;
    }

    return summary.balance / summary.totalIncome;
  });

  protected readonly recentSharedDebts = computed(() =>
    (this.data()?.debts ?? [])
      .filter((debt) => !debt.createdByCurrentUser)
      .sort(
        (first, second) =>
          new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime(),
      )
      .slice(0, 4),
  );

  constructor() {
    this.loadDashboard();
    this.notificationCenter.changes$
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.loadDashboard());
  }

  protected loadDashboard(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.api
      .getDashboard()
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (data) => {
          this.data.set(data);
          this.debtNotifications.setCount(
            data.pendingConfirmations.length + data.pendingSettlementConfirmations.length,
          );
        },
        error: (error: unknown) => this.handleError(error),
      });
  }

  protected categoryLabel(category: FinanceCategory): string {
    return CATEGORY_LABELS[category];
  }

  protected categoryIcon(category: FinanceCategory): string {
    return CATEGORY_ICONS[category];
  }

  protected categoryBarWidth(category: CategoryTotal): number {
    return Math.max(category.percentage * 100, category.amount > 0 ? 4 : 0);
  }

  protected trendBarHeight(item: FinanceTrendMonth, kind: 'income' | 'expense'): number {
    const trend = this.data()?.summary.monthlyTrend ?? [];
    const maximum = Math.max(
      1,
      ...trend.flatMap((month) => [month.totalIncome, month.totalExpenses]),
    );
    const value = kind === 'income' ? item.totalIncome : item.totalExpenses;
    return Math.max((value / maximum) * 100, value > 0 ? 4 : 0);
  }

  protected monthLabel(referenceMonth: string): string {
    const [year, month] = referenceMonth.split('-').map(Number);
    return new Intl.DateTimeFormat('pt-BR', { month: 'short' })
      .format(new Date(year, month - 1, 1))
      .replace('.', '');
  }

  protected budgetBarWidth(category: BudgetCategoryResponse): number {
    return Math.min(Math.max(category.usagePercentage, category.spent > 0 ? 3 : 0), 100);
  }

  protected debtDescription(payment: PaymentResponse): string {
    return (
      this.data()?.debts.find((debt) => debt.id === payment.debtId)?.description ??
      'Dívida compartilhada'
    );
  }

  protected debtPositionLabel(debt: DebtResponse): string {
    if (debt.paidBy.isCurrentUser) {
      return 'Você pagou';
    }

    return debt.shares.some((share) => share.person.isCurrentUser)
      ? 'Você participa'
      : 'Compartilhada com você';
  }

  protected debtPositionAmount(debt: DebtResponse): number {
    if (debt.paidBy.isCurrentUser) {
      return debt.shares
        .filter((share) => !share.isPayer)
        .reduce((total, share) => total + share.remainingAmount, 0);
    }

    return (
      debt.shares.find((share) => share.person.isCurrentUser)?.remainingAmount ?? debt.totalAmount
    );
  }

  protected confirmPayment(payment: PaymentResponse): void {
    this.processPayment(payment, true);
  }

  protected rejectPayment(payment: PaymentResponse): void {
    this.processPayment(payment, false);
  }

  protected confirmSettlementTransfer(transfer: SettlementTransferResponse): void {
    this.processSettlementTransfer(transfer, true);
  }

  protected rejectSettlementTransfer(transfer: SettlementTransferResponse): void {
    this.processSettlementTransfer(transfer, false);
  }

  protected analyzeFinancialLife(): void {
    this.isAnalyzing.set(true);
    this.aiError.set(null);
    this.api
      .analyzeFinancialLife(this.referenceMonthValue)
      .pipe(finalize(() => this.isAnalyzing.set(false)))
      .subscribe({
        next: (analysis) => this.aiAnalysis.set(analysis),
        error: (error: unknown) => {
          this.aiError.set(
            error instanceof HttpErrorResponse && error.status === 429
              ? 'O limite temporário de análises foi atingido. Tente novamente em alguns minutos.'
              : 'Não foi possível gerar a análise agora. Tente novamente em instantes.',
          );
        },
      });
  }

  protected updateAiQuestion(event: Event): void {
    this.aiQuestion.set((event.target as HTMLInputElement).value);
  }

  protected submitAiQuestion(event: Event): void {
    event.preventDefault();
    this.askAiQuestion(this.aiQuestion());
  }

  protected askSuggestedQuestion(question: string): void {
    this.aiQuestion.set(question);
    this.askAiQuestion(question);
  }

  private askAiQuestion(rawQuestion: string): void {
    const question = rawQuestion.trim();
    if (question.length < 3 || question.length > 500 || this.isAskingAi()) {
      return;
    }

    this.aiConversation.update((messages) => [...messages, { role: 'user', text: question }]);
    this.aiQuestion.set('');
    this.aiQuestionError.set(null);
    this.isAskingAi.set(true);
    this.api
      .askAboutFinancialLife(question)
      .pipe(finalize(() => this.isAskingAi.set(false)))
      .subscribe({
        next: (response) => {
          this.aiConversation.update((messages) => [
            ...messages,
            { role: 'assistant', text: response.answer },
          ]);
          this.suggestedQuestions.set(response.suggestedQuestions);
        },
        error: (error: unknown) => {
          this.aiQuestionError.set(
            error instanceof HttpErrorResponse && error.status === 429
              ? 'O limite temporário de perguntas foi atingido. Tente novamente em alguns minutos.'
              : 'Não foi possível responder agora. Tente novamente em instantes.',
          );
        },
      });
  }

  private processPayment(payment: PaymentResponse, confirm: boolean): void {
    this.processingPaymentId.set(payment.id);
    this.actionError.set(null);
    this.actionMessage.set(null);
    const request$ = confirm
      ? this.api.confirmDebtPayment(payment.debtId, payment.id)
      : this.api.rejectDebtPayment(payment.debtId, payment.id);

    request$.pipe(finalize(() => this.processingPaymentId.set(null))).subscribe({
      next: () => {
        this.actionMessage.set(confirm ? 'Pagamento confirmado.' : 'Pagamento recusado.');
        this.loadDashboard();
      },
      error: () =>
        this.actionError.set(
          confirm
            ? 'Não foi possível confirmar este pagamento.'
            : 'Não foi possível recusar este pagamento.',
        ),
    });
  }

  private processSettlementTransfer(transfer: SettlementTransferResponse, confirm: boolean): void {
    this.processingSettlementTransferId.set(transfer.id);
    this.actionError.set(null);
    this.actionMessage.set(null);
    const request$ = confirm
      ? this.api.confirmSettlementTransfer(transfer.id)
      : this.api.rejectSettlementTransfer(transfer.id);

    request$.pipe(finalize(() => this.processingSettlementTransferId.set(null))).subscribe({
      next: () => {
        this.actionMessage.set(
          confirm
            ? 'Transferência simplificada confirmada.'
            : 'Transferência simplificada recusada.',
        );
        this.loadDashboard();
      },
      error: () =>
        this.actionError.set(
          confirm
            ? 'Não foi possível confirmar esta transferência.'
            : 'Não foi possível recusar esta transferência.',
        ),
    });
  }

  private handleError(error: unknown): void {
    if (error instanceof HttpErrorResponse && error.status === 0) {
      this.errorMessage.set(
        'Não foi possível conectar ao BFF. Confirme se o ambiente está em execução.',
      );
      return;
    }

    this.errorMessage.set('Não foi possível carregar seu resumo financeiro agora.');
  }
}
