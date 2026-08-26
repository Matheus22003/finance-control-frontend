import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { forkJoin, map, Observable } from 'rxjs';

import {
  AccountDeletionEligibilityResponse,
  AiAnalysisResponse,
  AiQuestionResponse,
  DashboardResponse,
  DeleteAccountRequest,
  CreateDebtRequest,
  DebtSummary,
  DebtResponse,
  DebtHistoryResponse,
  ExpenseRequest,
  ExpenseResponse,
  FinanceCategory,
  FinanceCategoryRequest,
  FinanceCategoryResponse,
  FinancialGoalRequest,
  FinancialGoalResponse,
  FinancialGoalContributionRequest,
  FinancialGoalContributionResponse,
  FinanceTransactionFilters,
  IncomeRequest,
  IncomeResponse,
  IncomeGoalAllocationResponse,
  MonthlyBudgetResponse,
  CashFlowProjectionResponse,
  RecurringTransactionRequest,
  RecurringTransactionResponse,
  UpdateRecurringTransactionRequest,
  PersonResponse,
  PersonRequest,
  PaymentRequest,
  PaymentResponse,
  RecordSettlementTransferRequest,
  NotificationResponse,
  NotificationPreferencesResponse,
  UpdateNotificationPreferencesRequest,
  PushNotificationConfigurationResponse,
  CreatePushSubscriptionRequest,
  PushSubscriptionResponse,
  NotificationSyncResponse,
  NotificationUnreadCountResponse,
  RecentTransaction,
  SettlementTransferResponse,
  SimplifiedSettlementResponse,
  UpdateDebtRequest,
  CreateGroupRequest,
  FriendResponse,
  FriendshipResponse,
  GroupResponse,
  UserDirectoryResponse,
  UserProfileResponse,
  UpdatePreferencesRequest,
} from './api.models';

export interface CategoryTotal {
  category: FinanceCategory;
  name: string;
  amount: number;
  percentage: number;
}

export interface DashboardViewData {
  summary: DashboardResponse;
  currentUser: UserDirectoryResponse;
  recentTransactions: RecentTransaction[];
  categoryTotals: CategoryTotal[];
  debts: DebtResponse[];
  pendingConfirmations: PaymentResponse[];
  pendingSettlementConfirmations: SettlementTransferResponse[];
  settlements: SimplifiedSettlementResponse;
}

@Injectable({ providedIn: 'root' })
export class FinanceControlApiService {
  private readonly http = inject(HttpClient);

  getDashboard(): Observable<DashboardViewData> {
    return forkJoin({
      summary: this.http.get<DashboardResponse>('/api/v1/dashboard'),
      currentUser: this.getCurrentUser(),
      incomes: this.getIncomes(),
      expenses: this.getExpenses(),
      categories: this.getFinanceCategories(),
      debts: this.getDebts(),
      pendingConfirmations: this.getPendingPaymentConfirmations(),
      pendingSettlementConfirmations: this.getPendingSettlementTransferConfirmations(),
      settlements: this.getSimplifiedSettlements(),
    }).pipe(
      map(
        ({
          summary,
          currentUser,
          incomes,
          expenses,
          categories,
          debts,
          pendingConfirmations,
          pendingSettlementConfirmations,
          settlements,
        }) => ({
          summary,
          currentUser,
          recentTransactions: this.buildRecentTransactions(incomes, expenses),
          categoryTotals: this.buildCategoryTotals(expenses, categories),
          debts,
          pendingConfirmations,
          pendingSettlementConfirmations,
          settlements,
        }),
      ),
    );
  }

  analyzeFinancialLife(month?: string): Observable<AiAnalysisResponse> {
    return this.http.post<AiAnalysisResponse>('/api/v1/ai/analyze', {
      month: month ?? null,
    });
  }

  askAboutFinancialLife(question: string): Observable<AiQuestionResponse> {
    return this.http.post<AiQuestionResponse>('/api/v1/ai/ask', { question });
  }

  getIncomes(filters: FinanceTransactionFilters = {}): Observable<IncomeResponse[]> {
    return this.http.get<IncomeResponse[]>('/api/v1/finance/incomes', {
      params: this.financeFilterParams(filters, false),
    });
  }

  getFinanceCategories(): Observable<FinanceCategoryResponse[]> {
    return this.http.get<FinanceCategoryResponse[]>('/api/v1/finance/categories');
  }

  createFinanceCategory(request: FinanceCategoryRequest): Observable<FinanceCategoryResponse> {
    return this.http.post<FinanceCategoryResponse>('/api/v1/finance/categories', request);
  }

  updateFinanceCategory(
    id: number,
    request: FinanceCategoryRequest,
  ): Observable<FinanceCategoryResponse> {
    return this.http.put<FinanceCategoryResponse>(`/api/v1/finance/categories/${id}`, request);
  }

  deleteFinanceCategory(id: number): Observable<void> {
    return this.http.delete<void>(`/api/v1/finance/categories/${id}`);
  }

  getIncomeGoalAllocations(id: string): Observable<IncomeGoalAllocationResponse> {
    return this.http.get<IncomeGoalAllocationResponse>(
      `/api/v1/finance/incomes/${id}/goal-allocations`,
    );
  }

  getNotifications(unreadOnly = false, limit = 30): Observable<NotificationResponse[]> {
    return this.http.get<NotificationResponse[]>('/api/v1/notifications', {
      params: { unreadOnly, limit },
    });
  }

  getUnreadNotificationCount(): Observable<NotificationUnreadCountResponse> {
    return this.http.get<NotificationUnreadCountResponse>('/api/v1/notifications/unread-count');
  }

  syncNotificationAlerts(): Observable<NotificationSyncResponse> {
    return this.http.post<NotificationSyncResponse>('/api/v1/notifications/sync', null);
  }

  markNotificationAsRead(notificationId: string): Observable<NotificationResponse> {
    return this.http.post<NotificationResponse>(
      `/api/v1/notifications/${notificationId}/read`,
      null,
    );
  }

  markAllNotificationsAsRead(): Observable<NotificationUnreadCountResponse> {
    return this.http.post<NotificationUnreadCountResponse>('/api/v1/notifications/read-all', null);
  }

  getNotificationPreferences(): Observable<NotificationPreferencesResponse> {
    return this.http.get<NotificationPreferencesResponse>('/api/v1/notifications/preferences');
  }

  updateNotificationPreferences(
    request: UpdateNotificationPreferencesRequest,
  ): Observable<NotificationPreferencesResponse> {
    return this.http.put<NotificationPreferencesResponse>(
      '/api/v1/notifications/preferences',
      request,
    );
  }

  getPushNotificationConfiguration(): Observable<PushNotificationConfigurationResponse> {
    return this.http.get<PushNotificationConfigurationResponse>(
      '/api/v1/notifications/push/configuration',
    );
  }

  getPushSubscriptions(): Observable<PushSubscriptionResponse[]> {
    return this.http.get<PushSubscriptionResponse[]>('/api/v1/notifications/push/subscriptions');
  }

  createPushSubscription(
    request: CreatePushSubscriptionRequest,
  ): Observable<PushSubscriptionResponse> {
    return this.http.post<PushSubscriptionResponse>(
      '/api/v1/notifications/push/subscriptions',
      request,
    );
  }

  removePushSubscription(subscriptionId: string): Observable<void> {
    return this.http.delete<void>(`/api/v1/notifications/push/subscriptions/${subscriptionId}`);
  }

  unsubscribeCurrentPushEndpoint(endpoint: string): Observable<void> {
    return this.http.post<void>('/api/v1/notifications/push/subscriptions/unsubscribe', {
      endpoint,
    });
  }

  createIncome(request: IncomeRequest): Observable<IncomeResponse> {
    return this.http.post<IncomeResponse>('/api/v1/finance/incomes', request);
  }

  updateIncome(id: string, request: IncomeRequest): Observable<IncomeResponse> {
    return this.http.put<IncomeResponse>(`/api/v1/finance/incomes/${id}`, request);
  }

  deleteIncome(id: string): Observable<void> {
    return this.http.delete<void>(`/api/v1/finance/incomes/${id}`);
  }

  getFinancialGoals(): Observable<FinancialGoalResponse[]> {
    return this.http.get<FinancialGoalResponse[]>('/api/v1/finance/goals');
  }

  getFinancialGoal(id: string): Observable<FinancialGoalResponse> {
    return this.http.get<FinancialGoalResponse>(`/api/v1/finance/goals/${id}`);
  }

  createFinancialGoal(request: FinancialGoalRequest): Observable<FinancialGoalResponse> {
    return this.http.post<FinancialGoalResponse>('/api/v1/finance/goals', request);
  }

  updateFinancialGoal(
    id: string,
    request: FinancialGoalRequest,
  ): Observable<FinancialGoalResponse> {
    return this.http.put<FinancialGoalResponse>(`/api/v1/finance/goals/${id}`, request);
  }

  deleteFinancialGoal(id: string): Observable<void> {
    return this.http.delete<void>(`/api/v1/finance/goals/${id}`);
  }

  getFinancialGoalContributions(goalId: string): Observable<FinancialGoalContributionResponse[]> {
    return this.http.get<FinancialGoalContributionResponse[]>(
      `/api/v1/finance/goals/${goalId}/contributions`,
    );
  }

  createFinancialGoalContribution(
    goalId: string,
    request: FinancialGoalContributionRequest,
  ): Observable<FinancialGoalContributionResponse> {
    return this.http.post<FinancialGoalContributionResponse>(
      `/api/v1/finance/goals/${goalId}/contributions`,
      request,
    );
  }

  deleteFinancialGoalContribution(goalId: string, contributionId: string): Observable<void> {
    return this.http.delete<void>(
      `/api/v1/finance/goals/${goalId}/contributions/${contributionId}`,
    );
  }

  getCashFlowProjection(months = 6): Observable<CashFlowProjectionResponse> {
    return this.http.get<CashFlowProjectionResponse>('/api/v1/finance/projections/cash-flow', {
      params: { months },
    });
  }

  getExpenses(filters: FinanceTransactionFilters = {}): Observable<ExpenseResponse[]> {
    return this.http.get<ExpenseResponse[]>('/api/v1/finance/expenses', {
      params: this.financeFilterParams(filters, true),
    });
  }

  createExpense(request: ExpenseRequest): Observable<ExpenseResponse> {
    return this.http.post<ExpenseResponse>('/api/v1/finance/expenses', request);
  }

  updateExpense(id: string, request: ExpenseRequest): Observable<ExpenseResponse> {
    return this.http.put<ExpenseResponse>(`/api/v1/finance/expenses/${id}`, request);
  }

  deleteExpense(id: string): Observable<void> {
    return this.http.delete<void>(`/api/v1/finance/expenses/${id}`);
  }

  getRecurringTransactions(): Observable<RecurringTransactionResponse[]> {
    return this.http.get<RecurringTransactionResponse[]>('/api/v1/finance/recurring-transactions');
  }

  createRecurringTransaction(
    request: RecurringTransactionRequest,
  ): Observable<RecurringTransactionResponse> {
    return this.http.post<RecurringTransactionResponse>(
      '/api/v1/finance/recurring-transactions',
      request,
    );
  }

  updateRecurringTransaction(
    id: string,
    request: UpdateRecurringTransactionRequest,
  ): Observable<RecurringTransactionResponse> {
    return this.http.put<RecurringTransactionResponse>(
      `/api/v1/finance/recurring-transactions/${id}`,
      request,
    );
  }

  deleteRecurringTransaction(id: string): Observable<void> {
    return this.http.delete<void>(`/api/v1/finance/recurring-transactions/${id}`);
  }

  getMonthlyBudget(month: string): Observable<MonthlyBudgetResponse> {
    return this.http.get<MonthlyBudgetResponse>('/api/v1/finance/budgets', {
      params: { month },
    });
  }

  setMonthlyBudget(
    month: string,
    category: FinanceCategory,
    amount: number,
  ): Observable<MonthlyBudgetResponse> {
    return this.http.put<MonthlyBudgetResponse>(
      `/api/v1/finance/budgets/${category}`,
      { amount },
      {
        params: { month },
      },
    );
  }

  deleteMonthlyBudget(month: string, category: FinanceCategory): Observable<MonthlyBudgetResponse> {
    return this.http.delete<MonthlyBudgetResponse>(`/api/v1/finance/budgets/${category}`, {
      params: { month },
    });
  }

  getDebts(): Observable<DebtResponse[]> {
    return this.http.get<DebtResponse[]>('/api/v1/debts');
  }

  createDebt(request: CreateDebtRequest): Observable<DebtResponse> {
    return this.http.post<DebtResponse>('/api/v1/debts', request);
  }

  updateDebt(id: string, request: UpdateDebtRequest): Observable<DebtResponse> {
    return this.http.put<DebtResponse>(`/api/v1/debts/${id}`, request);
  }

  deleteDebt(id: string): Observable<void> {
    return this.http.delete<void>(`/api/v1/debts/${id}`);
  }

  getDebtPayments(debtId: string): Observable<PaymentResponse[]> {
    return this.http.get<PaymentResponse[]>(`/api/v1/debts/${debtId}/payments`);
  }

  getPendingPaymentConfirmations(): Observable<PaymentResponse[]> {
    return this.http.get<PaymentResponse[]>('/api/v1/debts/payments/pending-confirmation');
  }

  createDebtPayment(
    debtId: string,
    shareId: string,
    request: PaymentRequest,
  ): Observable<PaymentResponse> {
    return this.http.post<PaymentResponse>(
      `/api/v1/debts/${debtId}/shares/${shareId}/payments`,
      request,
    );
  }

  confirmDebtPayment(debtId: string, paymentId: string): Observable<PaymentResponse> {
    return this.http.post<PaymentResponse>(
      `/api/v1/debts/${debtId}/payments/${paymentId}/confirm`,
      null,
    );
  }

  rejectDebtPayment(debtId: string, paymentId: string): Observable<PaymentResponse> {
    return this.http.post<PaymentResponse>(
      `/api/v1/debts/${debtId}/payments/${paymentId}/reject`,
      null,
    );
  }

  getDebtHistory(debtId: string): Observable<DebtHistoryResponse[]> {
    return this.http.get<DebtHistoryResponse[]>(`/api/v1/debts/${debtId}/history`);
  }

  getDebtSummary(): Observable<DebtSummary> {
    return this.http.get<DebtSummary>('/api/v1/debts/summary');
  }

  getPeople(): Observable<PersonResponse[]> {
    return this.http.get<PersonResponse[]>('/api/v1/people');
  }

  createPerson(request: PersonRequest): Observable<PersonResponse> {
    return this.http.post<PersonResponse>('/api/v1/people', request);
  }

  getSimplifiedSettlements(groupId?: string): Observable<SimplifiedSettlementResponse> {
    return this.http.get<SimplifiedSettlementResponse>('/api/v1/debts/settlements/simplified', {
      params: groupId ? { groupId } : {},
    });
  }

  getActiveSettlementTransfers(groupId?: string): Observable<SettlementTransferResponse[]> {
    return this.http.get<SettlementTransferResponse[]>(
      '/api/v1/debts/settlements/simplified/transfers',
      { params: groupId ? { groupId } : {} },
    );
  }

  getPendingSettlementTransferConfirmations(): Observable<SettlementTransferResponse[]> {
    return this.http.get<SettlementTransferResponse[]>(
      '/api/v1/debts/settlements/simplified/transfers/pending-confirmation',
    );
  }

  recordSettlementTransfer(
    request: RecordSettlementTransferRequest,
  ): Observable<SettlementTransferResponse> {
    return this.http.post<SettlementTransferResponse>(
      '/api/v1/debts/settlements/simplified/transfers',
      request,
    );
  }

  confirmSettlementTransfer(transferId: string): Observable<SettlementTransferResponse> {
    return this.http.post<SettlementTransferResponse>(
      `/api/v1/debts/settlements/simplified/transfers/${transferId}/confirm`,
      null,
    );
  }

  rejectSettlementTransfer(transferId: string): Observable<SettlementTransferResponse> {
    return this.http.post<SettlementTransferResponse>(
      `/api/v1/debts/settlements/simplified/transfers/${transferId}/reject`,
      null,
    );
  }

  getCurrentUser(): Observable<UserProfileResponse> {
    return this.http.get<UserProfileResponse>('/api/v1/users/me');
  }

  updateProfile(displayName: string): Observable<UserProfileResponse> {
    return this.http.put<UserProfileResponse>('/api/v1/users/me/profile', { displayName });
  }

  updatePreferences(request: UpdatePreferencesRequest): Observable<UserProfileResponse> {
    return this.http.put<UserProfileResponse>('/api/v1/users/me/preferences', request);
  }

  requestEmailChange(newEmail: string, password: string): Observable<void> {
    return this.http.post<void>('/api/v1/users/me/email-change', { newEmail, password });
  }

  getAvatar(): Observable<Blob> {
    return this.http.get('/api/v1/users/me/avatar', { responseType: 'blob' });
  }

  updateAvatar(file: File): Observable<UserProfileResponse> {
    const body = new FormData();
    body.append('file', file);
    return this.http.put<UserProfileResponse>('/api/v1/users/me/avatar', body);
  }

  deleteAvatar(): Observable<void> {
    return this.http.delete<void>('/api/v1/users/me/avatar');
  }

  exportAccount(password: string): Observable<Blob> {
    return this.http.post('/api/v1/users/me/export', { password }, { responseType: 'blob' });
  }

  getAccountDeletionEligibility(): Observable<AccountDeletionEligibilityResponse> {
    return this.http.get<AccountDeletionEligibilityResponse>(
      '/api/v1/users/me/deletion-eligibility',
    );
  }

  deleteAccount(request: DeleteAccountRequest): Observable<void> {
    return this.http.delete<void>('/api/v1/users/me', { body: request });
  }

  searchUser(email: string): Observable<UserDirectoryResponse> {
    return this.http.get<UserDirectoryResponse>('/api/v1/users/search', { params: { email } });
  }

  getFriends(): Observable<FriendResponse[]> {
    return this.http.get<FriendResponse[]>('/api/v1/friends');
  }

  getIncomingFriendRequests(): Observable<FriendshipResponse[]> {
    return this.http.get<FriendshipResponse[]>('/api/v1/friends/requests/incoming');
  }

  getOutgoingFriendRequests(): Observable<FriendshipResponse[]> {
    return this.http.get<FriendshipResponse[]>('/api/v1/friends/requests/outgoing');
  }

  sendFriendRequest(email: string): Observable<FriendshipResponse> {
    return this.http.post<FriendshipResponse>('/api/v1/friends/requests', { email });
  }

  acceptFriendRequest(requestId: string): Observable<FriendshipResponse> {
    return this.http.post<FriendshipResponse>(`/api/v1/friends/requests/${requestId}/accept`, null);
  }

  rejectFriendRequest(requestId: string): Observable<FriendshipResponse> {
    return this.http.post<FriendshipResponse>(`/api/v1/friends/requests/${requestId}/reject`, null);
  }

  removeFriend(friendUserId: string): Observable<void> {
    return this.http.delete<void>(`/api/v1/friends/${friendUserId}`);
  }

  getGroups(): Observable<GroupResponse[]> {
    return this.http.get<GroupResponse[]>('/api/v1/groups');
  }

  createGroup(request: CreateGroupRequest): Observable<GroupResponse> {
    return this.http.post<GroupResponse>('/api/v1/groups', request);
  }

  deleteGroup(groupId: string): Observable<void> {
    return this.http.delete<void>(`/api/v1/groups/${groupId}`);
  }

  private financeFilterParams(
    filters: FinanceTransactionFilters,
    includeCategory: boolean,
  ): Record<string, string> {
    const params: Record<string, string> = {};
    if (filters.from) {
      params['from'] = filters.from;
    }
    if (filters.to) {
      params['to'] = filters.to;
    }
    if (includeCategory && filters.category) {
      params['category'] = filters.category;
    }
    return params;
  }

  private buildRecentTransactions(
    incomes: IncomeResponse[],
    expenses: ExpenseResponse[],
  ): RecentTransaction[] {
    const transactions: RecentTransaction[] = [
      ...incomes.map((income) => ({
        id: income.id,
        description: income.description,
        amount: income.amount,
        transactionDate: income.transactionDate,
        kind: 'income' as const,
      })),
      ...expenses.map((expense) => ({
        id: expense.id,
        description: expense.description,
        amount: expense.amount,
        transactionDate: expense.transactionDate,
        category: expense.category,
        kind: 'expense' as const,
      })),
    ];

    return transactions
      .sort(
        (first, second) =>
          new Date(second.transactionDate).getTime() - new Date(first.transactionDate).getTime(),
      )
      .slice(0, 6);
  }

  private buildCategoryTotals(
    expenses: ExpenseResponse[],
    categories: FinanceCategoryResponse[],
  ): CategoryTotal[] {
    const totalExpenses = expenses.reduce((total, expense) => total + expense.amount, 0);
    const groupedExpenses = new Map<FinanceCategory, number>();
    const categoryNames = new Map(categories.map((category) => [category.code, category.name]));

    for (const expense of expenses) {
      groupedExpenses.set(
        expense.category,
        (groupedExpenses.get(expense.category) ?? 0) + expense.amount,
      );
    }

    return [...groupedExpenses.entries()]
      .map(([category, amount]) => ({
        category,
        name: categoryNames.get(category) ?? category,
        amount,
        percentage: totalExpenses > 0 ? amount / totalExpenses : 0,
      }))
      .sort((first, second) => second.amount - first.amount);
  }
}
