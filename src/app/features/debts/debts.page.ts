import { CurrencyPipe, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnDestroy,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, forkJoin } from 'rxjs';

import {
  CreateDebtRequest,
  DebtCategory,
  DebtHistoryResponse,
  DebtResponse,
  DebtShareResponse,
  DebtSummary,
  GroupResponse,
  PersonResponse,
  PaymentResponse,
  ProblemDetails,
  SettlementTransferResponse,
  SimplifiedTransfer,
  SimplifiedSettlementResponse,
  UpdateDebtRequest,
} from '../../core/api/api.models';
import { FinanceControlApiService } from '../../core/api/finance-control-api.service';
import { NotificationCenterService } from '../../core/notifications/notification-center.service';

interface CategoryOption {
  value: DebtCategory;
  label: string;
}

interface PaymentTarget {
  debt: DebtResponse;
  share: DebtShareResponse;
}

interface SettlementPaymentTarget {
  transfer: SimplifiedTransfer;
}

@Component({
  selector: 'app-debts-page',
  imports: [CurrencyPipe, DatePipe, ReactiveFormsModule],
  templateUrl: './debts.page.html',
  styleUrl: './debts.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DebtsPage implements OnDestroy {
  private readonly api = inject(FinanceControlApiService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly notificationCenter = inject(NotificationCenterService);
  private successTimer: ReturnType<typeof setTimeout> | undefined;

  protected readonly debts = signal<DebtResponse[]>([]);
  protected readonly people = signal<PersonResponse[]>([]);
  protected readonly groups = signal<GroupResponse[]>([]);
  protected readonly summary = signal<DebtSummary>({
    totalOwed: 0,
    totalToReceive: 0,
    openDebtsCount: 0,
  });
  protected readonly settlements = signal<SimplifiedSettlementResponse>({
    totalOpenAmount: 0,
    originalTransferCount: 0,
    simplifiedTransferCount: 0,
    transfers: [],
  });
  protected readonly settlementGroupId = signal('');
  protected readonly isLoadingSettlements = signal(false);
  protected readonly settlementError = signal<string | null>(null);
  protected readonly activeSettlementTransfers = signal<SettlementTransferResponse[]>([]);
  protected readonly settlementPaymentTarget = signal<SettlementPaymentTarget | null>(null);
  protected readonly isSavingSettlementPayment = signal(false);
  protected readonly processingSettlementTransferId = signal<string | null>(null);
  protected readonly settlementOperationError = signal<string | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly hasError = signal(false);
  protected readonly isFormOpen = signal(false);
  protected readonly isSaving = signal(false);
  protected readonly editingDebt = signal<DebtResponse | null>(null);
  protected readonly deleteTarget = signal<DebtResponse | null>(null);
  protected readonly isDeleting = signal(false);
  protected readonly expandedDebtId = signal<string | null>(null);
  protected readonly paymentsByDebt = signal<Record<string, PaymentResponse[]>>({});
  protected readonly historyByDebt = signal<Record<string, DebtHistoryResponse[]>>({});
  protected readonly loadingActivityDebtId = signal<string | null>(null);
  protected readonly activityError = signal<string | null>(null);
  protected readonly paymentTarget = signal<PaymentTarget | null>(null);
  protected readonly isSavingPayment = signal(false);
  protected readonly processingPaymentId = signal<string | null>(null);
  protected readonly selectedShares = signal<Record<string, number | null>>({});
  protected readonly isPersonFormOpen = signal(false);
  protected readonly isCreatingPerson = signal(false);
  protected readonly operationError = signal<string | null>(null);
  protected readonly personError = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);

  protected readonly categories: readonly CategoryOption[] = [
    { value: 'FOOD', label: 'Alimentação' },
    { value: 'RENT', label: 'Moradia' },
    { value: 'TRANSPORT', label: 'Transporte' },
    { value: 'TRAVEL', label: 'Viagem' },
    { value: 'LOAN', label: 'Empréstimo' },
    { value: 'OTHER', label: 'Outros' },
  ];

  protected readonly debtForm = this.formBuilder.nonNullable.group({
    description: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(200)]],
    totalAmount: [null as number | null, [Validators.required, Validators.min(0.01)]],
    paidByPersonId: ['', Validators.required],
    groupId: [''],
    category: this.formBuilder.nonNullable.control<DebtCategory>('OTHER', Validators.required),
    dueDate: [''],
  });

  protected readonly personForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(120)]],
    email: ['', [Validators.email, Validators.maxLength(254)]],
    isCurrentUser: [false],
  });

  protected readonly paymentForm = this.formBuilder.nonNullable.group({
    amount: [null as number | null, [Validators.required, Validators.min(0.01)]],
    paymentDate: [this.today(), Validators.required],
    note: ['', Validators.maxLength(500)],
  });

  protected readonly settlementPaymentForm = this.formBuilder.nonNullable.group({
    paymentDate: [this.today(), Validators.required],
    note: ['', Validators.maxLength(500)],
  });

  protected readonly hasCurrentUser = computed(() =>
    this.people().some((person) => person.isCurrentUser),
  );

  constructor() {
    this.loadDebts();
    this.notificationCenter.changes$.pipe(takeUntilDestroyed()).subscribe((notification) => {
      if (
        notification.type.startsWith('DEBT_') ||
        notification.type.startsWith('PAYMENT_') ||
        notification.type.startsWith('SETTLEMENT_') ||
        notification.type.startsWith('GROUP_')
      ) {
        this.loadDebts();
      }
    });
  }

  ngOnDestroy(): void {
    if (this.successTimer) {
      clearTimeout(this.successTimer);
    }
  }

  protected loadDebts(): void {
    this.isLoading.set(true);
    this.hasError.set(false);
    forkJoin({
      debts: this.api.getDebts(),
      people: this.api.getPeople(),
      summary: this.api.getDebtSummary(),
      settlements: this.api.getSimplifiedSettlements(this.settlementGroupId() || undefined),
      activeSettlementTransfers: this.api.getActiveSettlementTransfers(
        this.settlementGroupId() || undefined,
      ),
      groups: this.api.getGroups(),
    })
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: ({ debts, people, summary, settlements, activeSettlementTransfers, groups }) => {
          this.debts.set(debts);
          this.people.set(people);
          this.summary.set(summary);
          this.settlements.set(settlements);
          this.activeSettlementTransfers.set(activeSettlementTransfers);
          this.groups.set(groups);
        },
        error: () => this.hasError.set(true),
      });
  }

  protected openNewDebt(): void {
    this.editingDebt.set(null);
    this.selectedShares.set({});
    this.operationError.set(null);
    const suggestedPayer = this.people().find((person) => person.isCurrentUser) ?? this.people()[0];
    this.debtForm.reset({
      description: '',
      totalAmount: null,
      paidByPersonId: suggestedPayer?.id ?? '',
      groupId: '',
      category: 'OTHER',
      dueDate: '',
    });
    this.resetPersonForm();
    this.isPersonFormOpen.set(this.people().length === 0);
    this.isFormOpen.set(true);
  }

  protected openEditDebt(debt: DebtResponse): void {
    this.editingDebt.set(debt);
    this.selectedShares.set(
      Object.fromEntries(debt.shares.map((share) => [share.person.id, share.amount])),
    );
    this.operationError.set(null);
    this.isPersonFormOpen.set(false);
    this.debtForm.reset({
      description: debt.description,
      totalAmount: debt.totalAmount,
      paidByPersonId: debt.paidBy.id,
      groupId: debt.groupId ?? '',
      category: debt.category,
      dueDate: debt.dueDate ?? '',
    });
    this.isFormOpen.set(true);
  }

  protected closeForm(): void {
    if (this.isSaving() || this.isCreatingPerson()) {
      return;
    }
    this.isFormOpen.set(false);
    this.editingDebt.set(null);
    this.operationError.set(null);
    this.personError.set(null);
  }

  protected saveDebt(): void {
    this.operationError.set(null);
    if (this.debtForm.invalid) {
      this.debtForm.markAllAsTouched();
      return;
    }

    const editing = this.editingDebt();
    if (!this.sharesAreValid()) {
      this.operationError.set(
        'Selecione ao menos um participante e distribua exatamente o valor total entre as cotas.',
      );
      return;
    }

    const value = this.debtForm.getRawValue();
    this.isSaving.set(true);
    const request$ = editing
      ? this.api.updateDebt(editing.id, this.buildUpdateRequest(value))
      : this.api.createDebt(this.buildCreateRequest(value));

    request$.pipe(finalize(() => this.isSaving.set(false))).subscribe({
      next: () => {
        this.isFormOpen.set(false);
        this.editingDebt.set(null);
        this.showSuccess(editing ? 'Dívida atualizada com sucesso.' : 'Dívida criada com sucesso.');
        this.loadDebts();
      },
      error: (error: unknown) => this.operationError.set(this.getOperationError(error, 'salvar')),
    });
  }

  protected toggleParticipant(personId: string, selected: boolean): void {
    this.selectedShares.update((shares) => {
      const updated = { ...shares };
      if (selected) {
        updated[personId] = null;
      } else {
        delete updated[personId];
      }
      return updated;
    });
    this.operationError.set(null);
  }

  protected isParticipantSelected(personId: string): boolean {
    return Object.hasOwn(this.selectedShares(), personId);
  }

  protected shareAmount(personId: string): number | null {
    return this.selectedShares()[personId] ?? null;
  }

  protected setShareAmount(personId: string, value: string): void {
    const amount = value === '' ? null : Number(value);
    this.selectedShares.update((shares) => ({ ...shares, [personId]: amount }));
    this.operationError.set(null);
  }

  protected splitEqually(): void {
    const personIds = Object.keys(this.selectedShares());
    const total = Number(this.debtForm.controls.totalAmount.value);
    if (personIds.length === 0 || !Number.isFinite(total) || total <= 0) {
      this.operationError.set(
        'Informe o valor total e selecione os participantes antes de dividir.',
      );
      return;
    }

    const totalCents = Math.round(total * 100);
    const baseCents = Math.floor(totalCents / personIds.length);
    let remainder = totalCents - baseCents * personIds.length;
    const shares: Record<string, number> = {};
    for (const personId of personIds) {
      shares[personId] = (baseCents + (remainder-- > 0 ? 1 : 0)) / 100;
    }
    this.selectedShares.set(shares);
    this.operationError.set(null);
  }

  protected selectedShareCount(): number {
    return Object.keys(this.selectedShares()).length;
  }

  protected sharesTotal(): number {
    return this.roundMoney(
      Object.values(this.selectedShares()).reduce<number>(
        (total, amount) => total + Number(amount ?? 0),
        0,
      ),
    );
  }

  protected remainingToSplit(): number {
    return this.roundMoney(
      Number(this.debtForm.controls.totalAmount.value ?? 0) - this.sharesTotal(),
    );
  }

  protected sharesAreValid(): boolean {
    const values = Object.values(this.selectedShares());
    const total = Number(this.debtForm.controls.totalAmount.value);
    return (
      values.length > 0 &&
      values.every((amount) => amount !== null && amount > 0) &&
      this.roundMoney(this.sharesTotal()) === this.roundMoney(total)
    );
  }

  protected togglePersonForm(): void {
    this.personError.set(null);
    this.resetPersonForm();
    this.isPersonFormOpen.update((open) => !open);
  }

  protected createPerson(): void {
    this.personError.set(null);
    if (this.personForm.invalid) {
      this.personForm.markAllAsTouched();
      return;
    }

    const value = this.personForm.getRawValue();
    this.isCreatingPerson.set(true);
    this.api
      .createPerson({
        name: value.name.trim(),
        email: value.email.trim() || null,
        isCurrentUser: value.isCurrentUser,
      })
      .pipe(finalize(() => this.isCreatingPerson.set(false)))
      .subscribe({
        next: (person) => {
          const wasEmpty = this.people().length === 0;
          this.people.update((people) => [...people, person]);
          if (!this.debtForm.controls.paidByPersonId.value || person.isCurrentUser) {
            this.debtForm.controls.paidByPersonId.setValue(person.id);
          }
          if (!person.isCurrentUser || !wasEmpty) {
            this.toggleParticipant(person.id, true);
          }
          this.isPersonFormOpen.set(false);
          this.resetPersonForm();
        },
        error: (error: unknown) =>
          this.personError.set(this.getOperationError(error, 'cadastrar a pessoa')),
      });
  }

  protected requestDelete(debt: DebtResponse): void {
    this.operationError.set(null);
    this.deleteTarget.set(debt);
  }

  protected cancelDelete(): void {
    if (!this.isDeleting()) {
      this.deleteTarget.set(null);
      this.operationError.set(null);
    }
  }

  protected confirmDelete(): void {
    const target = this.deleteTarget();
    if (!target) {
      return;
    }

    this.operationError.set(null);
    this.isDeleting.set(true);
    this.api
      .deleteDebt(target.id)
      .pipe(finalize(() => this.isDeleting.set(false)))
      .subscribe({
        next: () => {
          this.deleteTarget.set(null);
          this.showSuccess('Dívida excluída com sucesso.');
          this.loadDebts();
        },
        error: (error: unknown) =>
          this.operationError.set(this.getOperationError(error, 'excluir')),
      });
  }

  protected toggleDetails(debtId: string): void {
    if (this.expandedDebtId() === debtId) {
      this.expandedDebtId.set(null);
      return;
    }

    this.expandedDebtId.set(debtId);
    this.loadDebtActivity(debtId);
  }

  protected paymentsFor(debtId: string): PaymentResponse[] {
    return this.paymentsByDebt()[debtId] ?? [];
  }

  protected historyFor(debtId: string): DebtHistoryResponse[] {
    return this.historyByDebt()[debtId] ?? [];
  }

  protected canRecordPayment(debt: DebtResponse, share: DebtShareResponse): boolean {
    return (
      !share.isPayer &&
      share.remainingAmount > 0 &&
      (share.person.isCurrentUser || debt.paidBy.isCurrentUser)
    );
  }

  protected openPayment(debt: DebtResponse, share: DebtShareResponse): void {
    this.activityError.set(null);
    this.paymentTarget.set({ debt, share });
    this.paymentForm.reset({
      amount: share.remainingAmount,
      paymentDate: this.today(),
      note: '',
    });
  }

  protected closePayment(): void {
    if (!this.isSavingPayment()) {
      this.paymentTarget.set(null);
    }
  }

  protected savePayment(): void {
    const target = this.paymentTarget();
    if (!target || this.paymentForm.invalid) {
      this.paymentForm.markAllAsTouched();
      return;
    }

    const value = this.paymentForm.getRawValue();
    if (Number(value.amount) > target.share.remainingAmount) {
      this.paymentForm.controls.amount.setErrors({ max: true });
      return;
    }

    this.isSavingPayment.set(true);
    this.api
      .createDebtPayment(target.debt.id, target.share.id, {
        amount: Number(value.amount),
        paymentDate: value.paymentDate,
        note: value.note.trim() || null,
      })
      .pipe(finalize(() => this.isSavingPayment.set(false)))
      .subscribe({
        next: (payment) => {
          this.paymentTarget.set(null);
          this.showSuccess(
            payment.status === 'PENDING'
              ? 'Pagamento enviado para confirmação.'
              : 'Pagamento registrado e confirmado.',
          );
          this.refreshAfterPayment(target.debt.id);
        },
        error: (error: unknown) =>
          this.activityError.set(this.getOperationError(error, 'registrar o pagamento')),
      });
  }

  protected confirmPayment(debtId: string, paymentId: string): void {
    this.processPaymentAction(debtId, paymentId, true);
  }

  protected rejectPayment(debtId: string, paymentId: string): void {
    this.processPaymentAction(debtId, paymentId, false);
  }

  protected paymentStatusLabel(status: PaymentResponse['status']): string {
    return status === 'PENDING'
      ? 'Aguardando confirmação'
      : status === 'CONFIRMED'
        ? 'Confirmado'
        : 'Recusado';
  }

  protected historyLabel(type: string): string {
    const labels: Record<string, string> = {
      CREATED: 'Dívida criada.',
      UPDATED: 'Detalhes da dívida atualizados.',
      PAYMENT_ADDED: 'Pagamento registrado.',
      PAYMENT_PENDING: 'Pagamento enviado para confirmação.',
      PAYMENT_CONFIRMED: 'Pagamento confirmado.',
      PAYMENT_REJECTED: 'Pagamento recusado.',
      SPLIT_UPDATED: 'Participantes e cotas atualizados.',
      PAYMENT_UPDATED: 'Pagamento atualizado.',
      PAYMENT_DELETED: 'Pagamento excluído.',
      PAID: 'Dívida quitada.',
      REOPENED: 'Dívida reaberta.',
    };
    return labels[type] ?? 'Dívida atualizada.';
  }

  protected categoryLabel(category: DebtCategory): string {
    return this.categories.find((option) => option.value === category)?.label ?? 'Outros';
  }

  protected categoryInitials(category: DebtCategory): string {
    const label = this.categoryLabel(category);
    return label.slice(0, 2).toLocaleUpperCase('pt-BR');
  }

  protected absolute(value: number): number {
    return Math.abs(value);
  }

  protected groupLabel(groupId: string | null): string | null {
    return groupId ? (this.groups().find((group) => group.id === groupId)?.name ?? 'Grupo') : null;
  }

  protected selectSettlementGroup(groupId: string): void {
    this.settlementGroupId.set(groupId);
    this.settlementError.set(null);
    this.isLoadingSettlements.set(true);
    forkJoin({
      settlements: this.api.getSimplifiedSettlements(groupId || undefined),
      activeTransfers: this.api.getActiveSettlementTransfers(groupId || undefined),
    })
      .pipe(finalize(() => this.isLoadingSettlements.set(false)))
      .subscribe({
        next: ({ settlements, activeTransfers }) => {
          this.settlements.set(settlements);
          this.activeSettlementTransfers.set(activeTransfers);
        },
        error: (error: unknown) =>
          this.settlementError.set(
            this.getOperationError(error, 'calcular os pagamentos simplificados'),
          ),
      });
  }

  protected savedTransferCount(): number {
    return Math.max(
      0,
      this.settlements().originalTransferCount - this.settlements().simplifiedTransferCount,
    );
  }

  protected activeSettlementTransfer(
    suggestion: SimplifiedTransfer,
  ): SettlementTransferResponse | null {
    return (
      this.activeSettlementTransfers().find(
        (transfer) =>
          transfer.fromIdentityId === suggestion.fromIdentityId &&
          transfer.toIdentityId === suggestion.toIdentityId &&
          transfer.amount === suggestion.amount,
      ) ?? null
    );
  }

  protected openSettlementPayment(suggestion: SimplifiedTransfer): void {
    const activeTransfer = this.activeSettlementTransfer(suggestion);
    if (
      (!activeTransfer && !suggestion.fromPerson.isCurrentUser) ||
      (activeTransfer && !activeTransfer.canRecord)
    ) {
      return;
    }

    this.settlementOperationError.set(null);
    this.settlementPaymentForm.reset({ paymentDate: this.today(), note: '' });
    this.settlementPaymentTarget.set({ transfer: suggestion });
  }

  protected closeSettlementPayment(): void {
    if (!this.isSavingSettlementPayment()) {
      this.settlementPaymentTarget.set(null);
      this.settlementOperationError.set(null);
    }
  }

  protected saveSettlementPayment(): void {
    const target = this.settlementPaymentTarget();
    if (!target || this.settlementPaymentForm.invalid) {
      this.settlementPaymentForm.markAllAsTouched();
      return;
    }

    const value = this.settlementPaymentForm.getRawValue();
    this.isSavingSettlementPayment.set(true);
    this.settlementOperationError.set(null);
    this.api
      .recordSettlementTransfer({
        groupId: this.settlementGroupId() || null,
        fromPersonId: target.transfer.fromPerson.id,
        toPersonId: target.transfer.toPerson.id,
        amount: target.transfer.amount,
        paymentDate: value.paymentDate,
        note: value.note.trim() || null,
      })
      .pipe(finalize(() => this.isSavingSettlementPayment.set(false)))
      .subscribe({
        next: () => {
          this.settlementPaymentTarget.set(null);
          this.showSuccess('Transferência enviada para confirmação do destinatário.');
          this.refreshSettlementContext();
        },
        error: (error: unknown) =>
          this.settlementOperationError.set(
            this.getOperationError(error, 'registrar a transferência simplificada'),
          ),
      });
  }

  protected confirmSettlementTransfer(transferId: string): void {
    this.processSettlementTransfer(transferId, true);
  }

  protected rejectSettlementTransfer(transferId: string): void {
    this.processSettlementTransfer(transferId, false);
  }

  protected settlementTransferStatus(transfer: SettlementTransferResponse): string {
    const labels: Record<SettlementTransferResponse['status'], string> = {
      AWAITING_PAYMENT: transfer.canRecord ? 'Pronto para registrar' : 'Aguardando o pagador',
      PENDING: transfer.canConfirm ? 'Confirme o recebimento' : 'Aguardando confirmação',
      CONFIRMED: 'Confirmada',
      REJECTED: 'Recusada',
    };
    return labels[transfer.status];
  }

  private buildCreateRequest(value: typeof this.debtForm.value): CreateDebtRequest {
    return {
      description: value.description?.trim() ?? '',
      totalAmount: Number(value.totalAmount),
      paidByPersonId: value.paidByPersonId ?? '',
      groupId: value.groupId || null,
      category: value.category ?? 'OTHER',
      dueDate: value.dueDate || null,
      shares: Object.entries(this.selectedShares()).map(([personId, amount]) => ({
        personId,
        amount: Number(amount),
      })),
    };
  }

  private buildUpdateRequest(value: typeof this.debtForm.value): UpdateDebtRequest {
    return {
      description: value.description?.trim() ?? '',
      paidByPersonId: value.paidByPersonId ?? '',
      category: value.category ?? 'OTHER',
      dueDate: value.dueDate || null,
      shares: Object.entries(this.selectedShares()).map(([personId, amount]) => ({
        personId,
        amount: Number(amount),
      })),
    };
  }

  private resetPersonForm(): void {
    if (this.hasCurrentUser()) {
      this.personForm.controls.isCurrentUser.disable({ emitEvent: false });
    } else {
      this.personForm.controls.isCurrentUser.enable({ emitEvent: false });
    }
    this.personForm.reset({
      name: '',
      email: '',
      isCurrentUser: !this.hasCurrentUser(),
    });
    this.personError.set(null);
  }

  private loadDebtActivity(debtId: string): void {
    this.loadingActivityDebtId.set(debtId);
    this.activityError.set(null);
    forkJoin({
      payments: this.api.getDebtPayments(debtId),
      history: this.api.getDebtHistory(debtId),
    })
      .pipe(finalize(() => this.loadingActivityDebtId.set(null)))
      .subscribe({
        next: ({ payments, history }) => {
          this.paymentsByDebt.update((current) => ({ ...current, [debtId]: payments }));
          this.historyByDebt.update((current) => ({ ...current, [debtId]: history }));
        },
        error: (error: unknown) =>
          this.activityError.set(this.getOperationError(error, 'carregar os pagamentos')),
      });
  }

  private processPaymentAction(debtId: string, paymentId: string, confirm: boolean): void {
    this.processingPaymentId.set(paymentId);
    this.activityError.set(null);
    const request$ = confirm
      ? this.api.confirmDebtPayment(debtId, paymentId)
      : this.api.rejectDebtPayment(debtId, paymentId);
    request$.pipe(finalize(() => this.processingPaymentId.set(null))).subscribe({
      next: () => {
        this.showSuccess(confirm ? 'Pagamento confirmado.' : 'Pagamento recusado.');
        this.refreshAfterPayment(debtId);
      },
      error: (error: unknown) =>
        this.activityError.set(
          this.getOperationError(error, confirm ? 'confirmar o pagamento' : 'recusar o pagamento'),
        ),
    });
  }

  private refreshAfterPayment(debtId: string): void {
    this.loadDebtActivity(debtId);
    this.loadDebts();
  }

  private processSettlementTransfer(transferId: string, confirm: boolean): void {
    this.processingSettlementTransferId.set(transferId);
    this.settlementOperationError.set(null);
    const request$ = confirm
      ? this.api.confirmSettlementTransfer(transferId)
      : this.api.rejectSettlementTransfer(transferId);
    request$.pipe(finalize(() => this.processingSettlementTransferId.set(null))).subscribe({
      next: () => {
        this.showSuccess(
          confirm
            ? 'Transferência confirmada. O plano será aplicado quando todos confirmarem.'
            : 'Transferência recusada. O plano foi cancelado.',
        );
        this.refreshSettlementContext();
        this.loadDebts();
      },
      error: (error: unknown) =>
        this.settlementOperationError.set(
          this.getOperationError(
            error,
            confirm ? 'confirmar a transferência' : 'recusar a transferência',
          ),
        ),
    });
  }

  private refreshSettlementContext(): void {
    const groupId = this.settlementGroupId() || undefined;
    forkJoin({
      settlements: this.api.getSimplifiedSettlements(groupId),
      activeTransfers: this.api.getActiveSettlementTransfers(groupId),
    }).subscribe({
      next: ({ settlements, activeTransfers }) => {
        this.settlements.set(settlements);
        this.activeSettlementTransfers.set(activeTransfers);
      },
      error: (error: unknown) =>
        this.settlementError.set(
          this.getOperationError(error, 'atualizar o plano de pagamentos simplificados'),
        ),
    });
  }

  private today(): string {
    const date = new Date();
    const offset = date.getTimezoneOffset() * 60_000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 10);
  }

  private getOperationError(error: unknown, action: string): string {
    if (error instanceof HttpErrorResponse) {
      const problem = error.error as Partial<ProblemDetails> | null;
      if (error.status === 400) {
        return 'Revise os dados e confira se a soma das cotas corresponde ao valor total.';
      }
      if (error.status === 404) {
        return 'Um dos registros utilizados não existe mais. Atualize a página e tente novamente.';
      }
      if (error.status === 409) {
        return 'A operação conflita com pagamentos ou dados já registrados para esta dívida.';
      }
      if (problem?.detail && !problem.detail.toLowerCase().includes('upstream')) {
        return problem.detail;
      }
    }
    return `Não foi possível ${action} agora. Tente novamente em instantes.`;
  }

  private showSuccess(message: string): void {
    if (this.successTimer) {
      clearTimeout(this.successTimer);
    }
    this.successMessage.set(message);
    this.successTimer = setTimeout(() => this.successMessage.set(null), 4000);
  }

  private roundMoney(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}
