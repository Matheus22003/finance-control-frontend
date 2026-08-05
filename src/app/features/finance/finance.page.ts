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
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, forkJoin, Observable } from 'rxjs';

import {
  ExpenseRequest,
  ExpenseResponse,
  BudgetCategoryResponse,
  FinanceCategory,
  IncomeRequest,
  IncomeResponse,
  ProblemDetails,
  RecentTransaction,
  RecurrenceFrequency,
  RecurringTransactionResponse,
} from '../../core/api/api.models';
import { FinanceControlApiService } from '../../core/api/finance-control-api.service';

type TransactionFilter = 'all' | 'income' | 'expense';
type TransactionKind = 'income' | 'expense';
type CategoryFilter = 'ALL' | FinanceCategory;

interface CategoryOption {
  value: FinanceCategory;
  label: string;
}

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
  private successTimer: ReturnType<typeof setTimeout> | undefined;

  protected readonly incomes = signal<IncomeResponse[]>([]);
  protected readonly expenses = signal<ExpenseResponse[]>([]);
  protected readonly recurringTransactions = signal<RecurringTransactionResponse[]>([]);
  protected readonly budgets = signal<BudgetCategoryResponse[]>([]);
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

  protected readonly categories: readonly CategoryOption[] = [
    { value: 'FOOD', label: 'Alimentação' },
    { value: 'TRANSPORT', label: 'Transporte' },
    { value: 'RENT', label: 'Moradia' },
    { value: 'LEISURE', label: 'Lazer' },
    { value: 'HEALTH', label: 'Saúde' },
    { value: 'OTHER', label: 'Outros' },
  ];

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
        this.selectedCategory() === 'ALL' ? undefined : this.selectedCategory() as FinanceCategory,
    };
    forkJoin({
      incomes: this.api.getIncomes(range),
      expenses: this.api.getExpenses(filters),
      recurring: this.api.getRecurringTransactions(),
      budget: this.api.getMonthlyBudget(this.selectedMonth()),
    })
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: ({ incomes, expenses, recurring, budget }) => {
          this.incomes.set(incomes);
          this.expenses.set(expenses);
          this.recurringTransactions.set(recurring);
          this.budgets.set(budget.categories);
          this.totalBudgetPlanned.set(budget.totalPlanned);
          this.totalBudgetSpent.set(budget.totalSpent);
          this.totalBudgetRemaining.set(budget.totalRemaining);
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
      category: 'FOOD',
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
      category: transaction.category ?? 'OTHER',
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
    return this.categories.find((option) => option.value === category)?.label ?? 'Outros';
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
          this.applyBudget(budget.categories, budget.totalPlanned, budget.totalSpent, budget.totalRemaining);
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
          this.applyBudget(budget.categories, budget.totalPlanned, budget.totalSpent, budget.totalRemaining);
          this.budgetEditing.set(null);
          this.showSuccess('Limite removido do orçamento.');
        },
        error: (error: unknown) => this.operationError.set(this.getOperationError(error, 'excluir')),
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
        error: (error: unknown) => this.operationError.set(this.getOperationError(error, 'excluir')),
      });
  }

  protected frequencyLabel(frequency: RecurrenceFrequency): string {
    return { WEEKLY: 'Semanal', MONTHLY: 'Mensal', YEARLY: 'Anual' }[frequency];
  }

  protected budgetProgress(category: BudgetCategoryResponse): number {
    return Math.min(Math.max(category.usagePercentage, 0), 100);
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

  private upsert<T extends { id: string }>(items: T[], saved: T): T[] {
    return items.some((item) => item.id === saved.id)
      ? items.map((item) => (item.id === saved.id ? saved : item))
      : [...items, saved];
  }

  private getOperationError(error: unknown, action: 'salvar' | 'excluir'): string {
    if (error instanceof HttpErrorResponse) {
      const problem = error.error as Partial<ProblemDetails> | null;
      if (error.status === 400) {
        return 'Revise os dados informados e tente novamente.';
      }
      if (error.status === 404) {
        return 'Esse lançamento não existe mais. Atualize a página e tente novamente.';
      }
      if (problem?.detail && !problem.detail.toLowerCase().includes('upstream')) {
        return problem.detail;
      }
    }

    return `Não foi possível ${action} o lançamento agora. Tente novamente em instantes.`;
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

  private monthRange(month: string): { from: string; to: string } {
    const [year, monthNumber] = month.split('-').map(Number);
    const lastDay = new Date(year, monthNumber, 0).getDate();
    return {
      from: `${month}-01`,
      to: `${month}-${String(lastDay).padStart(2, '0')}`,
    };
  }
}
