import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
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
import { auditTime, filter, finalize, forkJoin, Observable } from 'rxjs';

import {
  ExpenseRequest,
  ExpenseResponse,
  BudgetCategoryResponse,
  CashFlowProjectionResponse,
  FinanceCategory,
  FinanceCategoryResponse,
  FinancialGoalContributionRequest,
  FinancialGoalContributionResponse,
  FinancialGoalRequest,
  FinancialGoalResponse,
  IncomeRequest,
  IncomeResponse,
  IncomeGoalAllocationResponse,
  ProblemDetails,
  RecentTransaction,
  RecurrenceFrequency,
  RecurringTransactionResponse,
} from '../../core/api/api.models';
import { FinanceControlApiService } from '../../core/api/finance-control-api.service';
import { NotificationCenterService } from '../../core/notifications/notification-center.service';

type TransactionFilter = 'all' | 'income' | 'expense';
type TransactionKind = 'income' | 'expense';
type CategoryFilter = 'ALL' | FinanceCategory;

@Component({
  selector: 'app-finance-page',
  imports: [CurrencyPipe, DatePipe, DecimalPipe, ReactiveFormsModule],
  templateUrl: './finance.page.html',
  styleUrl: './finance.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FinancePage implements OnDestroy {
  private readonly api = inject(FinanceControlApiService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly notificationCenter = inject(NotificationCenterService);
  private successTimer: ReturnType<typeof setTimeout> | undefined;

  protected readonly incomes = signal<IncomeResponse[]>([]);
  protected readonly expenses = signal<ExpenseResponse[]>([]);
  protected readonly recurringTransactions = signal<RecurringTransactionResponse[]>([]);
  protected readonly budgets = signal<BudgetCategoryResponse[]>([]);
  protected readonly goals = signal<FinancialGoalResponse[]>([]);
  protected readonly cashFlowProjection = signal<CashFlowProjectionResponse | null>(null);
  protected readonly categories = signal<FinanceCategoryResponse[]>([]);
  protected readonly selectedMonth = signal(this.currentMonth());
  protected readonly selectedCategory = signal<CategoryFilter>('ALL');
  protected readonly filter = signal<TransactionFilter>('all');
  protected readonly search = signal('');
  protected readonly isLoading = signal(true);
  protected readonly hasError = signal(false);
  protected readonly isFormOpen = signal(false);
  protected readonly isSaving = signal(false);
  protected readonly editingTransaction = signal<RecentTransaction | null>(null);
  protected readonly deleteTarget = signal<RecentTransaction | null>(null);
  protected readonly isDeleting = signal(false);
  protected readonly operationError = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);
  protected readonly budgetEditing = signal<BudgetCategoryResponse | null>(null);
  protected readonly isBudgetSaving = signal(false);
  protected readonly recurringBusyId = signal<string | null>(null);
  protected readonly totalBudgetPlanned = signal(0);
  protected readonly totalBudgetSpent = signal(0);
  protected readonly totalBudgetRemaining = signal(0);
  protected readonly goalEditing = signal<FinancialGoalResponse | null | undefined>(undefined);
  protected readonly isGoalSaving = signal(false);
  protected readonly contributionGoal = signal<FinancialGoalResponse | null>(null);
  protected readonly goalContributions = signal<FinancialGoalContributionResponse[]>([]);
  protected readonly contributionIncomeOptions = signal<IncomeResponse[]>([]);
  protected readonly isContributionLoading = signal(false);
  protected readonly isContributionSaving = signal(false);
  protected readonly contributionDeletingId = signal<string | null>(null);
  protected readonly isCategoryManagerOpen = signal(false);
  protected readonly categoryEditing = signal<FinanceCategoryResponse | null>(null);
  protected readonly isCategorySaving = signal(false);
  protected readonly categoryDeletingId = signal<number | null>(null);
  protected readonly allocationIncome = signal<RecentTransaction | null>(null);
  protected readonly incomeAllocationDetails = signal<IncomeGoalAllocationResponse | null>(null);
  protected readonly isIncomeAllocationLoading = signal(false);
  protected readonly todayValue = this.today();

  protected readonly transactionForm = this.formBuilder.nonNullable.group({
    kind: this.formBuilder.nonNullable.control<TransactionKind>('expense'),
    description: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(200)]],
    amount: [null as number | null, [Validators.required, Validators.min(0.01)]],
    transactionDate: [this.today(), Validators.required],
    category: this.formBuilder.nonNullable.control<FinanceCategory>('FOOD', Validators.required),
    recurring: false,
    frequency: this.formBuilder.nonNullable.control<RecurrenceFrequency>('MONTHLY'),
    endDate: '',
  });

  protected readonly budgetForm = this.formBuilder.group({
    amount: [null as number | null, [Validators.required, Validators.min(0.01)]],
  });

  protected readonly goalForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(120)]],
    targetAmount: [null as number | null, [Validators.required, Validators.min(0.01)]],
    currentAmount: [0, [Validators.required, Validators.min(0)]],
    targetDate: [this.futureDate(6), Validators.required],
  });

  protected readonly contributionForm = this.formBuilder.group({
    amount: [null as number | null, [Validators.required, Validators.min(0.01)]],
    contributionDate: [this.today(), Validators.required],
    note: ['', Validators.maxLength(200)],
    sourceIncomeId: [''],
  });

  protected readonly categoryForm = this.formBuilder.nonNullable.group({
    name: [
      '',
      [
        Validators.required,
        Validators.pattern(/\S/),
        Validators.minLength(2),
        Validators.maxLength(80),
      ],
    ],
  });

  protected readonly totalIncome = computed(() =>
    this.incomes().reduce((total, item) => total + item.amount, 0),
  );
  protected readonly totalExpenses = computed(() =>
    this.expenses().reduce((total, item) => total + item.amount, 0),
  );
  protected readonly balance = computed(() => this.totalIncome() - this.totalExpenses());
  protected readonly transactions = computed(() => {
    const incomes: RecentTransaction[] = this.incomes().map((income) => ({
      ...income,
      kind: 'income',
    }));
    const expenses: RecentTransaction[] = this.expenses().map((expense) => ({
      ...expense,
      kind: 'expense',
    }));
    const normalizedSearch = this.search().trim().toLocaleLowerCase('pt-BR');

    return [...incomes, ...expenses]
      .filter((transaction) => this.filter() === 'all' || transaction.kind === this.filter())
      .filter(
        (transaction) =>
          !normalizedSearch ||
          transaction.description.toLocaleLowerCase('pt-BR').includes(normalizedSearch),
      )
      .sort(
        (first, second) =>
          new Date(second.transactionDate).getTime() - new Date(first.transactionDate).getTime(),
      );
  });

  constructor() {
    this.loadTransactions();
    this.notificationCenter.changes$
      .pipe(
        filter(
          (notification) =>
            notification.type.startsWith('BUDGET_') || notification.type.startsWith('GOAL_'),
        ),
        auditTime(100),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.loadTransactions());
  }

  ngOnDestroy(): void {
    if (this.successTimer) {
      clearTimeout(this.successTimer);
    }
  }

  protected loadTransactions(): void {
    this.isLoading.set(true);
    this.hasError.set(false);
    const range = this.monthRange(this.selectedMonth());
    const filters = {
      ...range,
      category:
        this.selectedCategory() === 'ALL'
          ? undefined
          : (this.selectedCategory() as FinanceCategory),
    };
    forkJoin({
      incomes: this.api.getIncomes(range),
      expenses: this.api.getExpenses(filters),
      recurring: this.api.getRecurringTransactions(),
      budget: this.api.getMonthlyBudget(this.selectedMonth()),
      goals: this.api.getFinancialGoals(),
      projection: this.api.getCashFlowProjection(6),
      categories: this.api.getFinanceCategories(),
    })
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: ({ incomes, expenses, recurring, budget, goals, projection, categories }) => {
          this.incomes.set(incomes);
          this.expenses.set(expenses);
          this.recurringTransactions.set(recurring);
          this.budgets.set(budget.categories);
          this.totalBudgetPlanned.set(budget.totalPlanned);
          this.totalBudgetSpent.set(budget.totalSpent);
          this.totalBudgetRemaining.set(budget.totalRemaining);
          this.goals.set(goals);
          this.cashFlowProjection.set(projection);
          this.categories.set(categories);
        },
        error: () => this.hasError.set(true),
      });
  }

  protected openNewTransaction(kind: TransactionKind = 'expense'): void {
    this.editingTransaction.set(null);
    this.operationError.set(null);
    this.transactionForm.reset({
      kind,
      description: '',
      amount: null,
      transactionDate: this.today(),
      category: this.defaultCategoryCode(),
      recurring: false,
      frequency: 'MONTHLY',
      endDate: '',
    });
    this.isFormOpen.set(true);
  }

  protected openEditTransaction(transaction: RecentTransaction): void {
    this.editingTransaction.set(transaction);
    this.operationError.set(null);
    this.transactionForm.reset({
      kind: transaction.kind,
      description: transaction.description,
      amount: transaction.amount,
      transactionDate: transaction.transactionDate,
      category: transaction.category ?? this.defaultCategoryCode(),
      recurring: false,
      frequency: 'MONTHLY',
      endDate: '',
    });
    this.isFormOpen.set(true);
  }

  protected closeForm(): void {
    if (this.isSaving()) {
      return;
    }

    this.isFormOpen.set(false);
    this.editingTransaction.set(null);
    this.operationError.set(null);
  }

  protected saveTransaction(): void {
    this.operationError.set(null);

    if (this.transactionForm.invalid) {
      this.transactionForm.markAllAsTouched();
      return;
    }

    const formValue = this.transactionForm.getRawValue();
    const baseRequest: IncomeRequest = {
      description: formValue.description.trim(),
      amount: Number(formValue.amount),
      transactionDate: formValue.transactionDate,
    };
    const editing = this.editingTransaction();
    if (!editing && formValue.recurring) {
      this.isSaving.set(true);
      this.api
        .createRecurringTransaction({
          kind: formValue.kind === 'income' ? 'INCOME' : 'EXPENSE',
          description: baseRequest.description,
          amount: baseRequest.amount,
          category: formValue.kind === 'expense' ? formValue.category : null,
          frequency: formValue.frequency,
          startDate: baseRequest.transactionDate,
          endDate: formValue.endDate || null,
        })
        .pipe(finalize(() => this.isSaving.set(false)))
        .subscribe({
          next: () => {
            this.isFormOpen.set(false);
            this.showSuccess('Recorrência criada e ocorrências vencidas geradas.');
            this.loadTransactions();
          },
          error: (error: unknown) =>
            this.operationError.set(this.getOperationError(error, 'salvar')),
        });
      return;
    }
    const request$ = this.buildSaveRequest(
      formValue.kind,
      baseRequest,
      formValue.category,
      editing,
    );

    this.isSaving.set(true);
    request$.pipe(finalize(() => this.isSaving.set(false))).subscribe({
      next: (saved) => {
        this.storeSavedTransaction(formValue.kind, saved);
        this.isFormOpen.set(false);
        this.editingTransaction.set(null);
        this.showSuccess(
          editing ? 'Lançamento atualizado com sucesso.' : 'Lançamento criado com sucesso.',
        );
      },
      error: (error: unknown) => this.operationError.set(this.getOperationError(error, 'salvar')),
    });
  }

  protected requestDelete(transaction: RecentTransaction): void {
    this.operationError.set(null);
    this.deleteTarget.set(transaction);
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
    const request$ =
      target.kind === 'income'
        ? this.api.deleteIncome(target.id)
        : this.api.deleteExpense(target.id);

    request$.pipe(finalize(() => this.isDeleting.set(false))).subscribe({
      next: () => {
        if (target.kind === 'income') {
          this.incomes.update((items) => items.filter((item) => item.id !== target.id));
        } else {
          this.expenses.update((items) => items.filter((item) => item.id !== target.id));
        }
        this.deleteTarget.set(null);
        this.showSuccess('Lançamento excluído com sucesso.');
      },
      error: (error: unknown) => this.operationError.set(this.getOperationError(error, 'excluir')),
    });
  }

  protected categoryLabel(category?: FinanceCategory): string {
    return this.categories().find((option) => option.code === category)?.name ?? 'Outros';
  }

  protected openCategoryManager(): void {
    this.operationError.set(null);
    this.categoryEditing.set(null);
    this.categoryForm.reset({ name: '' });
    this.isCategoryManagerOpen.set(true);
  }

  protected closeCategoryManager(): void {
    if (!this.isCategorySaving() && !this.categoryDeletingId()) {
      this.isCategoryManagerOpen.set(false);
      this.categoryEditing.set(null);
      this.operationError.set(null);
    }
  }

  protected startNewCategory(): void {
    this.operationError.set(null);
    this.categoryEditing.set(null);
    this.categoryForm.reset({ name: '' });
  }

  protected editCategory(category: FinanceCategoryResponse): void {
    if (category.defaultCategory) {
      return;
    }
    this.operationError.set(null);
    this.categoryEditing.set(category);
    this.categoryForm.reset({ name: category.name });
  }

  protected saveCategory(): void {
    if (this.categoryForm.invalid) {
      this.categoryForm.markAllAsTouched();
      return;
    }
    const request = { name: this.categoryForm.controls.name.value.trim() };
    const editing = this.categoryEditing();
    const request$ = editing
      ? this.api.updateFinanceCategory(editing.id, request)
      : this.api.createFinanceCategory(request);
    this.isCategorySaving.set(true);
    this.operationError.set(null);
    request$.pipe(finalize(() => this.isCategorySaving.set(false))).subscribe({
      next: (category) => {
        this.categories.update((items) => this.sortCategories(this.upsert(items, category)));
        this.categoryEditing.set(null);
        this.categoryForm.reset({ name: '' });
        this.showSuccess(editing ? 'Categoria renomeada.' : 'Categoria personalizada criada.');
        if (!editing) {
          this.api.getMonthlyBudget(this.selectedMonth()).subscribe({
            next: (budget) =>
              this.applyBudget(
                budget.categories,
                budget.totalPlanned,
                budget.totalSpent,
                budget.totalRemaining,
              ),
          });
        }
      },
      error: (error: unknown) =>
        this.operationError.set(this.getOperationError(error, 'salvar a categoria')),
    });
  }

  protected deleteCategory(category: FinanceCategoryResponse): void {
    if (category.defaultCategory) {
      return;
    }
    this.categoryDeletingId.set(category.id);
    this.operationError.set(null);
    this.api
      .deleteFinanceCategory(category.id)
      .pipe(finalize(() => this.categoryDeletingId.set(null)))
      .subscribe({
        next: () => {
          this.categories.update((items) => items.filter((item) => item.id !== category.id));
          this.budgets.update((items) => items.filter((item) => item.category !== category.code));
          if (this.selectedCategory() === category.code) {
            this.selectedCategory.set('ALL');
          }
          if (this.categoryEditing()?.id === category.id) {
            this.startNewCategory();
          }
          this.showSuccess('Categoria excluída.');
        },
        error: (error: unknown) =>
          this.operationError.set(this.getOperationError(error, 'excluir a categoria')),
      });
  }

  protected openIncomeAllocations(transaction: RecentTransaction): void {
    if (transaction.kind !== 'income') {
      return;
    }
    this.operationError.set(null);
    this.allocationIncome.set(transaction);
    this.incomeAllocationDetails.set(null);
    this.isIncomeAllocationLoading.set(true);
    this.api
      .getIncomeGoalAllocations(transaction.id)
      .pipe(finalize(() => this.isIncomeAllocationLoading.set(false)))
      .subscribe({
        next: (details) => this.incomeAllocationDetails.set(details),
        error: (error: unknown) =>
          this.operationError.set(this.getOperationError(error, 'carregar as alocações')),
      });
  }

  protected closeIncomeAllocations(): void {
    if (!this.isIncomeAllocationLoading()) {
      this.allocationIncome.set(null);
      this.incomeAllocationDetails.set(null);
      this.operationError.set(null);
    }
  }

  protected changeMonth(month: string): void {
    if (month && month !== this.selectedMonth()) {
      this.selectedMonth.set(month);
      this.loadTransactions();
    }
  }

  protected changeCategory(category: string): void {
    this.selectedCategory.set(category as CategoryFilter);
    this.loadTransactions();
  }

  protected openBudget(category: BudgetCategoryResponse): void {
    this.operationError.set(null);
    this.budgetEditing.set(category);
    this.budgetForm.reset({ amount: category.planned > 0 ? category.planned : null });
  }

  protected closeBudget(): void {
    if (!this.isBudgetSaving()) {
      this.budgetEditing.set(null);
      this.operationError.set(null);
    }
  }

  protected saveBudget(): void {
    const editing = this.budgetEditing();
    if (!editing || this.budgetForm.invalid) {
      this.budgetForm.markAllAsTouched();
      return;
    }
    this.isBudgetSaving.set(true);
    this.api
      .setMonthlyBudget(
        this.selectedMonth(),
        editing.category,
        Number(this.budgetForm.controls.amount.value),
      )
      .pipe(finalize(() => this.isBudgetSaving.set(false)))
      .subscribe({
        next: (budget) => {
          this.applyBudget(
            budget.categories,
            budget.totalPlanned,
            budget.totalSpent,
            budget.totalRemaining,
          );
          this.budgetEditing.set(null);
          this.showSuccess('Orçamento mensal atualizado.');
        },
        error: (error: unknown) => this.operationError.set(this.getOperationError(error, 'salvar')),
      });
  }

  protected removeBudget(): void {
    const editing = this.budgetEditing();
    if (!editing || editing.planned <= 0) {
      return;
    }
    this.isBudgetSaving.set(true);
    this.api
      .deleteMonthlyBudget(this.selectedMonth(), editing.category)
      .pipe(finalize(() => this.isBudgetSaving.set(false)))
      .subscribe({
        next: (budget) => {
          this.applyBudget(
            budget.categories,
            budget.totalPlanned,
            budget.totalSpent,
            budget.totalRemaining,
          );
          this.budgetEditing.set(null);
          this.showSuccess('Limite removido do orçamento.');
        },
        error: (error: unknown) =>
          this.operationError.set(this.getOperationError(error, 'excluir')),
      });
  }

  protected toggleRecurring(recurring: RecurringTransactionResponse): void {
    this.recurringBusyId.set(recurring.id);
    this.api
      .updateRecurringTransaction(recurring.id, {
        description: recurring.description,
        amount: recurring.amount,
        category: recurring.category,
        endDate: recurring.endDate,
        active: !recurring.active,
      })
      .pipe(finalize(() => this.recurringBusyId.set(null)))
      .subscribe({
        next: (updated) => {
          this.recurringTransactions.update((items) => this.upsert(items, updated));
          this.showSuccess(updated.active ? 'Recorrência reativada.' : 'Recorrência pausada.');
          if (updated.active) {
            this.loadTransactions();
          }
        },
        error: (error: unknown) => this.operationError.set(this.getOperationError(error, 'salvar')),
      });
  }

  protected deleteRecurring(recurring: RecurringTransactionResponse): void {
    this.recurringBusyId.set(recurring.id);
    this.api
      .deleteRecurringTransaction(recurring.id)
      .pipe(finalize(() => this.recurringBusyId.set(null)))
      .subscribe({
        next: () => {
          this.recurringTransactions.update((items) =>
            items.filter((item) => item.id !== recurring.id),
          );
          this.showSuccess('Regra recorrente excluída. Os lançamentos já gerados foram mantidos.');
        },
        error: (error: unknown) =>
          this.operationError.set(this.getOperationError(error, 'excluir')),
      });
  }

  protected frequencyLabel(frequency: RecurrenceFrequency): string {
    return { WEEKLY: 'Semanal', MONTHLY: 'Mensal', YEARLY: 'Anual' }[frequency];
  }

  protected budgetProgress(category: BudgetCategoryResponse): number {
    return Math.min(Math.max(category.usagePercentage, 0), 100);
  }

  protected openGoal(goal: FinancialGoalResponse | null = null): void {
    this.operationError.set(null);
    this.goalEditing.set(goal);
    this.goalForm.reset({
      name: goal?.name ?? '',
      targetAmount: goal?.targetAmount ?? null,
      currentAmount: goal?.currentAmount ?? 0,
      targetDate: goal?.targetDate ?? this.futureDate(6),
    });
  }

  protected closeGoal(): void {
    if (!this.isGoalSaving()) {
      this.goalEditing.set(undefined);
      this.operationError.set(null);
    }
  }

  protected saveGoal(): void {
    if (this.goalForm.invalid) {
      this.goalForm.markAllAsTouched();
      return;
    }

    const value = this.goalForm.getRawValue();
    const request: FinancialGoalRequest = {
      name: value.name.trim(),
      targetAmount: Number(value.targetAmount),
      currentAmount: Number(value.currentAmount),
      targetDate: value.targetDate,
    };
    const editing = this.goalEditing();
    const request$ = editing
      ? this.api.updateFinancialGoal(editing.id, request)
      : this.api.createFinancialGoal(request);

    this.isGoalSaving.set(true);
    request$.pipe(finalize(() => this.isGoalSaving.set(false))).subscribe({
      next: (goal) => {
        this.goals.update((items) =>
          this.upsert(items, goal).sort((a, b) => a.targetDate.localeCompare(b.targetDate)),
        );
        this.goalEditing.set(undefined);
        this.showSuccess(editing ? 'Meta atualizada com sucesso.' : 'Meta criada com sucesso.');
      },
      error: (error: unknown) => this.operationError.set(this.getOperationError(error, 'salvar')),
    });
  }

  protected deleteGoal(): void {
    const goal = this.goalEditing();
    if (!goal) {
      return;
    }
    this.isGoalSaving.set(true);
    this.api
      .deleteFinancialGoal(goal.id)
      .pipe(finalize(() => this.isGoalSaving.set(false)))
      .subscribe({
        next: () => {
          this.goals.update((items) => items.filter((item) => item.id !== goal.id));
          this.goalEditing.set(undefined);
          this.showSuccess('Meta excluída com sucesso.');
        },
        error: (error: unknown) =>
          this.operationError.set(this.getOperationError(error, 'excluir')),
      });
  }

  protected openContributions(goal: FinancialGoalResponse): void {
    this.operationError.set(null);
    this.contributionGoal.set(goal);
    this.goalContributions.set([]);
    this.contributionForm.reset({
      amount: null,
      contributionDate: this.today(),
      note: '',
      sourceIncomeId: '',
    });
    this.loadContributions(goal.id);
  }

  protected closeContributions(): void {
    if (!this.isContributionSaving() && !this.contributionDeletingId()) {
      this.contributionGoal.set(null);
      this.goalContributions.set([]);
      this.contributionIncomeOptions.set([]);
      this.operationError.set(null);
    }
  }

  protected saveContribution(): void {
    const goal = this.contributionGoal();
    if (!goal || this.contributionForm.invalid || this.contributionExceedsAvailable()) {
      this.contributionForm.markAllAsTouched();
      return;
    }

    const value = this.contributionForm.getRawValue();
    const request: FinancialGoalContributionRequest = {
      amount: Number(value.amount),
      contributionDate: value.contributionDate ?? this.today(),
      note: value.note?.trim() || null,
      sourceIncomeId: value.sourceIncomeId || null,
    };
    this.isContributionSaving.set(true);
    this.operationError.set(null);
    this.api
      .createFinancialGoalContribution(goal.id, request)
      .pipe(finalize(() => this.isContributionSaving.set(false)))
      .subscribe({
        next: () => {
          this.contributionForm.reset({
            amount: null,
            contributionDate: this.today(),
            note: '',
            sourceIncomeId: '',
          });
          this.refreshContributionGoal(goal.id);
          this.showSuccess('Aporte registrado e progresso da meta atualizado.');
        },
        error: (error: unknown) =>
          this.operationError.set(this.getOperationError(error, 'registrar o aporte')),
      });
  }

  protected deleteContribution(contribution: FinancialGoalContributionResponse): void {
    const goal = this.contributionGoal();
    if (!goal) {
      return;
    }

    this.contributionDeletingId.set(contribution.id);
    this.operationError.set(null);
    this.api
      .deleteFinancialGoalContribution(goal.id, contribution.id)
      .pipe(finalize(() => this.contributionDeletingId.set(null)))
      .subscribe({
        next: () => {
          this.refreshContributionGoal(goal.id);
          this.showSuccess('Aporte removido e progresso recalculado.');
        },
        error: (error: unknown) =>
          this.operationError.set(this.getOperationError(error, 'remover o aporte')),
      });
  }

  protected contributionTypeLabel(contribution: FinancialGoalContributionResponse): string {
    return contribution.type === 'INITIAL' ? 'Saldo inicial' : 'Aporte';
  }

  protected selectedContributionIncome(): IncomeResponse | null {
    const sourceIncomeId = this.contributionForm.controls.sourceIncomeId.value;
    return this.contributionIncomeOptions().find((income) => income.id === sourceIncomeId) ?? null;
  }

  protected contributionExceedsAvailable(): boolean {
    const sourceIncome = this.selectedContributionIncome();
    const amount = Number(this.contributionForm.controls.amount.value ?? 0);
    return !!sourceIncome && amount > sourceIncome.goalAvailableAmount;
  }

  protected goalProgress(goal: FinancialGoalResponse): number {
    return Math.min(Math.max(goal.progressPercentage, 0), 100);
  }

  private loadContributions(goalId: string): void {
    this.isContributionLoading.set(true);
    forkJoin({
      contributions: this.api.getFinancialGoalContributions(goalId),
      incomes: this.api.getIncomes(),
    })
      .pipe(finalize(() => this.isContributionLoading.set(false)))
      .subscribe({
        next: ({ contributions, incomes }) => {
          this.goalContributions.set(contributions);
          this.contributionIncomeOptions.set(incomes.slice(0, 50));
        },
        error: (error: unknown) =>
          this.operationError.set(this.getOperationError(error, 'carregar os aportes')),
      });
  }

  private refreshContributionGoal(goalId: string): void {
    forkJoin({
      goal: this.api.getFinancialGoal(goalId),
      contributions: this.api.getFinancialGoalContributions(goalId),
      incomes: this.api.getIncomes(),
    }).subscribe({
      next: ({ goal, contributions, incomes }) => {
        const incomesById = new Map(incomes.map((income) => [income.id, income]));
        this.goals.update((items) =>
          this.upsert(items, goal).sort((a, b) => a.targetDate.localeCompare(b.targetDate)),
        );
        this.incomes.update((items) => items.map((income) => incomesById.get(income.id) ?? income));
        this.contributionGoal.set(goal);
        this.goalContributions.set(contributions);
        this.contributionIncomeOptions.set(incomes.slice(0, 50));
      },
      error: (error: unknown) =>
        this.operationError.set(this.getOperationError(error, 'atualizar a meta')),
    });
  }

  protected goalStatusLabel(goal: FinancialGoalResponse): string {
    return { ACTIVE: 'Em andamento', COMPLETED: 'Concluída', OVERDUE: 'Prazo vencido' }[
      goal.status
    ];
  }

  protected projectionBarHeight(value: number): number {
    const maximum = Math.max(
      1,
      ...(this.cashFlowProjection()?.items ?? []).map((item) => Math.abs(item.projectedNet)),
    );
    return Math.max((Math.abs(value) / maximum) * 100, value !== 0 ? 5 : 0);
  }

  protected projectionMonthLabel(referenceMonth: string): string {
    const [year, month] = referenceMonth.split('-').map(Number);
    return new Intl.DateTimeFormat('pt-BR', { month: 'short' })
      .format(new Date(year, month - 1, 1))
      .replace('.', '');
  }

  private applyBudget(
    categories: BudgetCategoryResponse[],
    planned: number,
    spent: number,
    remaining: number,
  ): void {
    this.budgets.set(categories);
    this.totalBudgetPlanned.set(planned);
    this.totalBudgetSpent.set(spent);
    this.totalBudgetRemaining.set(remaining);
  }

  private buildSaveRequest(
    kind: TransactionKind,
    baseRequest: IncomeRequest,
    category: FinanceCategory,
    editing: RecentTransaction | null,
  ): Observable<IncomeResponse | ExpenseResponse> {
    if (kind === 'income') {
      return editing
        ? this.api.updateIncome(editing.id, baseRequest)
        : this.api.createIncome(baseRequest);
    }

    const expenseRequest: ExpenseRequest = { ...baseRequest, category };
    return editing
      ? this.api.updateExpense(editing.id, expenseRequest)
      : this.api.createExpense(expenseRequest);
  }

  private storeSavedTransaction(
    kind: TransactionKind,
    saved: IncomeResponse | ExpenseResponse,
  ): void {
    if (kind === 'income') {
      this.incomes.update((items) => this.upsert(items, saved));
      return;
    }

    this.expenses.update((items) => this.upsert(items, saved as ExpenseResponse));
  }

  private upsert<T extends { id: string | number }>(items: T[], saved: T): T[] {
    return items.some((item) => item.id === saved.id)
      ? items.map((item) => (item.id === saved.id ? saved : item))
      : [...items, saved];
  }

  private sortCategories(categories: FinanceCategoryResponse[]): FinanceCategoryResponse[] {
    return [...categories].sort((first, second) => {
      if (first.defaultCategory !== second.defaultCategory) {
        return first.defaultCategory ? -1 : 1;
      }
      return first.name.localeCompare(second.name, 'pt-BR');
    });
  }

  private defaultCategoryCode(): FinanceCategory {
    return (
      this.categories().find((category) => category.code === 'FOOD')?.code ??
      this.categories()[0]?.code ??
      'OTHER'
    );
  }

  private getOperationError(error: unknown, action: string): string {
    if (error instanceof HttpErrorResponse) {
      const problem = error.error as Partial<ProblemDetails> | null;
      if (error.status === 400) {
        const detail = problem?.detail ?? '';
        if (detail.includes('Categories in use cannot be deleted')) {
          return 'Esta categoria está em uso. Mova primeiro as despesas, os orçamentos e as recorrências vinculadas.';
        }
        if (detail.includes('A category with this name already exists')) {
          return 'Já existe uma categoria com esse nome.';
        }
        return 'Revise os dados informados e tente novamente.';
      }
      if (error.status === 404) {
        return 'Esse lançamento não existe mais. Atualize a página e tente novamente.';
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

  private today(): string {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day}`;
  }

  private currentMonth(): string {
    return this.today().slice(0, 7);
  }

  private futureDate(months: number): string {
    const date = new Date();
    date.setMonth(date.getMonth() + months);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate(),
    ).padStart(2, '0')}`;
  }

  private monthRange(month: string): { from: string; to: string } {
    const [year, monthNumber] = month.split('-').map(Number);
    const lastDay = new Date(year, monthNumber, 0).getDate();
    return {
      from: `${month}-01`,
      to: `${month}-${String(lastDay).padStart(2, '0')}`,
    };
  }
}
