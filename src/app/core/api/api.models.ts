export interface ProblemDetails {
  type?: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  traceId?: string;
  errors?: Record<string, string | string[]>;
}

export interface DashboardResponse {
  balance: number;
  totalIncome: number;
  totalExpenses: number;
  debtsSummary: DebtSummary;
  budget: MonthlyBudgetResponse;
  monthlyTrend: FinanceTrendMonth[];
  budgetAlerts: DashboardBudgetAlert[];
  goals: FinancialGoalResponse[];
  cashFlowProjection: CashFlowProjectionResponse;
}

export interface FinanceTrendMonth {
  referenceMonth: string;
  totalIncome: number;
  totalExpenses: number;
  balance: number;
}

export interface DashboardBudgetAlert extends BudgetCategoryResponse {
  severity: 'WARNING' | 'CRITICAL';
}

export interface DebtSummary {
  totalOwed: number;
  totalToReceive: number;
  openDebtsCount: number;
}

export type AiInsightSeverity = 'INFO' | 'POSITIVE' | 'WARNING' | 'CRITICAL';

export interface AiInsightResponse {
  severity: AiInsightSeverity;
  title: string;
  description: string;
}

export interface AiAnalysisMetrics {
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  totalOwed: number;
  totalToReceive: number;
  openDebtsCount: number;
  overdueDebtsCount: number;
  dueSoonDebtsCount: number;
  originalTransferCount: number;
  simplifiedTransferCount: number;
}

export interface AiAnalysisResponse {
  generatedAt: string;
  provider: string;
  referenceMonth: string;
  overview: string;
  metrics: AiAnalysisMetrics;
  financeInsights: AiInsightResponse[];
  debtInsights: AiInsightResponse[];
  recommendations: string[];
}

export interface AiQuestionResponse {
  generatedAt: string;
  provider: string;
  answer: string;
  suggestedQuestions: string[];
}

export interface IncomeResponse {
  id: string;
  description: string;
  amount: number;
  transactionDate: string;
  createdAt: string;
  updatedAt: string;
  recurringTransactionId?: string | null;
  goalAllocatedAmount: number;
  goalAvailableAmount: number;
}

export interface IncomeRequest {
  description: string;
  amount: number;
  transactionDate: string;
}

export interface IncomeGoalAllocationItemResponse {
  contributionId: string;
  financialGoalId: string;
  financialGoalName: string;
  amount: number;
  contributionDate: string;
  note: string | null;
  createdAt: string;
}

export interface IncomeGoalAllocationResponse {
  incomeId: string;
  incomeDescription: string;
  incomeAmount: number;
  transactionDate: string;
  goalAllocatedAmount: number;
  goalAvailableAmount: number;
  allocations: IncomeGoalAllocationItemResponse[];
}

export interface FinanceCategoryRequest {
  name: string;
}

export interface FinanceCategoryResponse {
  id: number;
  code: string;
  name: string;
  defaultCategory: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseRequest extends IncomeRequest {
  category: FinanceCategory;
}

export interface ExpenseResponse extends IncomeResponse {
  category: FinanceCategory;
}

export type FinanceCategory = string;

export interface FinanceTransactionFilters {
  from?: string;
  to?: string;
  category?: FinanceCategory;
}

export type RecurrenceFrequency = 'WEEKLY' | 'MONTHLY' | 'YEARLY';

export interface RecurringTransactionRequest {
  kind: 'INCOME' | 'EXPENSE';
  description: string;
  amount: number;
  category: FinanceCategory | null;
  frequency: RecurrenceFrequency;
  startDate: string;
  endDate: string | null;
}

export interface UpdateRecurringTransactionRequest {
  description: string;
  amount: number;
  category: FinanceCategory | null;
  endDate: string | null;
  active: boolean;
}

export interface RecurringTransactionResponse extends RecurringTransactionRequest {
  id: string;
  nextOccurrenceDate: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetCategoryResponse {
  category: FinanceCategory;
  name: string;
  planned: number;
  spent: number;
  remaining: number;
  usagePercentage: number;
}

export interface MonthlyBudgetResponse {
  referenceMonth: string;
  totalPlanned: number;
  totalSpent: number;
  totalRemaining: number;
  categories: BudgetCategoryResponse[];
}

export type FinancialGoalStatus = 'ACTIVE' | 'COMPLETED' | 'OVERDUE';

export interface FinancialGoalRequest {
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string;
}

export interface FinancialGoalResponse extends FinancialGoalRequest {
  id: string;
  remainingAmount: number;
  progressPercentage: number;
  status: FinancialGoalStatus;
  requiredMonthlyContribution: number;
  createdAt: string;
  updatedAt: string;
}

export type FinancialGoalContributionType = 'INITIAL' | 'CONTRIBUTION';

export interface FinancialGoalContributionRequest {
  amount: number;
  contributionDate: string;
  note: string | null;
  sourceIncomeId: string | null;
}

export interface FinancialGoalContributionSourceResponse {
  incomeId: string | null;
  description: string;
  incomeAmount: number;
  transactionDate: string;
}

export interface FinancialGoalContributionResponse {
  id: string;
  financialGoalId: string;
  amount: number;
  contributionDate: string;
  note: string | null;
  type: FinancialGoalContributionType;
  source: FinancialGoalContributionSourceResponse | null;
  createdAt: string;
}

export interface CashFlowProjectionMonthResponse {
  referenceMonth: string;
  projectedIncome: number;
  projectedExpenses: number;
  projectedNet: number;
  cumulativeBalance: number;
}

export interface CashFlowProjectionResponse {
  referenceDate: string;
  months: number;
  currentRecordedBalance: number;
  totalProjectedIncome: number;
  totalProjectedExpenses: number;
  projectedCumulativeBalance: number;
  items: CashFlowProjectionMonthResponse[];
}

export interface PersonReference {
  id: string;
  name: string;
  isCurrentUser: boolean;
}

export interface PersonResponse extends PersonReference {
  email: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PersonRequest {
  name: string;
  email: string | null;
  isCurrentUser: boolean;
}

export type DebtCategory = 'FOOD' | 'RENT' | 'TRANSPORT' | 'TRAVEL' | 'LOAN' | 'OTHER';

export interface DebtShareRequest {
  personId: string;
  amount: number;
}

export interface CreateDebtRequest {
  description: string;
  totalAmount: number;
  paidByPersonId: string;
  groupId: string | null;
  category: DebtCategory;
  dueDate: string | null;
  shares: DebtShareRequest[];
}

export interface UpdateDebtRequest {
  description: string;
  paidByPersonId: string;
  category: DebtCategory;
  dueDate: string | null;
  shares: DebtShareRequest[];
}

export interface DebtShareResponse {
  id: string;
  person: PersonReference;
  amount: number;
  paidAmount: number;
  remainingAmount: number;
  isPayer: boolean;
}

export interface DebtResponse {
  id: string;
  description: string;
  totalAmount: number;
  paidBy: PersonReference;
  groupId: string | null;
  category: DebtCategory;
  status: 'OPEN' | 'PAID';
  dueDate: string | null;
  createdByCurrentUser: boolean;
  createdAt: string;
  updatedAt: string;
  shares: DebtShareResponse[];
}

export interface PaymentRequest {
  amount: number;
  paymentDate: string;
  note: string | null;
}

export type PaymentStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED';

export interface PaymentResponse {
  id: string;
  debtId: string;
  debtShareId: string;
  fromPerson: PersonReference;
  toPerson: PersonReference;
  amount: number;
  paymentDate: string;
  note: string | null;
  recordedByUserId: string;
  confirmationRequiredFromUserId: string | null;
  status: PaymentStatus;
  confirmedAt: string | null;
  rejectedAt: string | null;
  canConfirm: boolean;
  canReject: boolean;
  canEdit: boolean;
  canDelete: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DebtHistoryResponse {
  id: string;
  type: string;
  description: string;
  occurredAt: string;
}

export interface SimplifiedSettlementResponse {
  totalOpenAmount: number;
  originalTransferCount: number;
  simplifiedTransferCount: number;
  transfers: SimplifiedTransfer[];
}

export interface SimplifiedTransfer {
  fromIdentityId: string;
  fromPerson: PersonReference;
  toIdentityId: string;
  toPerson: PersonReference;
  amount: number;
}

export type SettlementTransferStatus = 'AWAITING_PAYMENT' | 'PENDING' | 'CONFIRMED' | 'REJECTED';

export interface RecordSettlementTransferRequest {
  groupId: string | null;
  fromPersonId: string;
  toPersonId: string;
  amount: number;
  paymentDate: string;
  note: string | null;
}

export interface SettlementTransferResponse {
  id: string;
  settlementPlanId: string;
  groupId: string | null;
  fromIdentityId: string;
  fromPerson: PersonReference;
  toIdentityId: string;
  toPerson: PersonReference;
  amount: number;
  paymentDate: string | null;
  note: string | null;
  status: SettlementTransferStatus;
  canRecord: boolean;
  canConfirm: boolean;
  canReject: boolean;
  confirmedAt: string | null;
  rejectedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type NotificationType =
  | 'FRIEND_REQUEST'
  | 'FRIEND_ACCEPTED'
  | 'FRIEND_REJECTED'
  | 'FRIEND_REMOVED'
  | 'GROUP_CREATED'
  | 'GROUP_UPDATED'
  | 'GROUP_MEMBER_ADDED'
  | 'GROUP_MEMBER_REMOVED'
  | 'GROUP_DELETED'
  | 'DEBT_CREATED'
  | 'DEBT_UPDATED'
  | 'DEBT_DELETED'
  | 'PAYMENT_RECORDED'
  | 'PAYMENT_CONFIRMED'
  | 'PAYMENT_REJECTED'
  | 'PAYMENT_DELETED'
  | 'SETTLEMENT_RECORDED'
  | 'SETTLEMENT_CONFIRMED'
  | 'SETTLEMENT_REJECTED'
  | 'BUDGET_WARNING'
  | 'BUDGET_EXCEEDED'
  | 'GOAL_DUE_SOON'
  | 'GOAL_OVERDUE'
  | 'GOAL_COMPLETED';

export interface NotificationResponse {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  route: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationUnreadCountResponse {
  unreadCount: number;
}

export interface NotificationSyncResponse {
  createdCount: number;
  syncedAt: string;
}

export type NotificationChannel = 'inAppEnabled' | 'pushEnabled' | 'emailEnabled';

export interface NotificationPreferenceItemResponse {
  type: NotificationType;
  category: 'SOCIAL' | 'DEBTS' | 'FINANCE';
  label: string;
  inAppEnabled: boolean;
  pushEnabled: boolean;
  emailEnabled: boolean;
}

export interface NotificationPreferencesResponse {
  preferences: NotificationPreferenceItemResponse[];
}

export interface UpdateNotificationPreferencesRequest {
  preferences: Array<
    Pick<
      NotificationPreferenceItemResponse,
      'type' | 'inAppEnabled' | 'pushEnabled' | 'emailEnabled'
    >
  >;
}

export interface PushNotificationConfigurationResponse {
  isConfigured: boolean;
  publicKey: string | null;
}

export interface CreatePushSubscriptionRequest {
  endpoint: string;
  p256Dh: string;
  auth: string;
  deviceName: string;
}

export interface PushSubscriptionResponse {
  id: string;
  deviceName: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecentTransaction {
  id: string;
  description: string;
  amount: number;
  transactionDate: string;
  kind: 'income' | 'expense';
  category?: FinanceCategory;
  recurringTransactionId?: string | null;
  goalAllocatedAmount?: number;
  goalAvailableAmount?: number;
}

export interface UserDirectoryResponse {
  id: string;
  displayName: string;
  email: string;
}

export type ThemePreference = 'system' | 'light' | 'dark';

export interface UserPreferencesResponse {
  theme: ThemePreference;
  emailNotificationsEnabled: boolean;
  pushNotificationsEnabled: boolean;
}

export interface UserProfileResponse extends UserDirectoryResponse {
  emailConfirmed: boolean;
  avatarUrl: string | null;
  preferences: UserPreferencesResponse;
}

export interface UpdatePreferencesRequest {
  theme: ThemePreference;
  emailNotificationsEnabled: boolean;
  pushNotificationsEnabled: boolean;
}

export interface AccountDeletionEligibilityResponse {
  canDelete: boolean;
  openDebtsCount: number;
  pendingPaymentsCount: number;
  activeSettlementPlansCount: number;
  ownedGroupsCount: number;
  blockers: string[];
}

export interface DeleteAccountRequest {
  password: string;
  confirmation: string;
}

export interface FriendResponse {
  friendshipId: string;
  userId: string;
  displayName: string;
  email: string;
  friendsSince: string;
}

export interface FriendshipResponse {
  id: string;
  requesterUserId: string;
  requesterDisplayName: string;
  requesterEmail: string;
  addresseeUserId: string;
  addresseeDisplayName: string;
  addresseeEmail: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  createdAt: string;
  updatedAt: string;
}

export interface GroupMemberResponse {
  userId: string;
  displayName: string;
  email: string;
  role: 'OWNER' | 'MEMBER';
  joinedAt: string;
}

export interface GroupResponse {
  id: string;
  name: string;
  description: string | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  members: GroupMemberResponse[];
}

export interface CreateGroupRequest {
  name: string;
  description: string | null;
  memberUserIds: string[];
}
export interface ReportOverviewResponse {
  fromMonth: string;
  toMonth: string;
  monthCount: number;
  generatedAt: string;
  finance: ReportFinanceSection;
  debts: ReportDebtSection;
  highlights: ReportHighlights;
}

export interface ReportFinanceSection {
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  savingsRatePercentage: number;
  incomeCount: number;
  expenseCount: number;
  months: ReportFinanceMonth[];
  expenseCategories: ReportFinanceCategory[];
  topExpenses: ReportExpenseItem[];
}

export interface ReportFinanceMonth {
  referenceMonth: string;
  totalIncome: number;
  totalExpenses: number;
  balance: number;
}

export interface ReportFinanceCategory {
  category: string;
  name: string;
  amount: number;
  percentage: number;
}

export interface ReportExpenseItem {
  id: string;
  description: string;
  amount: number;
  transactionDate: string;
  category: string;
  categoryName: string;
}

export interface ReportDebtSection {
  totalVolume: number;
  totalOwed: number;
  totalToReceive: number;
  openDebtsCount: number;
  paidDebtsCount: number;
  months: ReportDebtMonth[];
  categories: ReportDebtCategory[];
  topDebts: ReportDebtItem[];
}

export interface ReportDebtMonth {
  referenceMonth: string;
  totalVolume: number;
  totalOwed: number;
  totalToReceive: number;
  debtCount: number;
}

export interface ReportDebtCategory {
  category: string;
  totalVolume: number;
  totalOwed: number;
  totalToReceive: number;
  debtCount: number;
}

export interface ReportDebtItem {
  id: string;
  description: string;
  category: string;
  totalAmount: number;
  totalOwed: number;
  totalToReceive: number;
  status: string;
  dueDate: string | null;
  createdAt: string;
}

export interface ReportHighlights {
  averageMonthlyIncome: number;
  averageMonthlyExpenses: number;
  bestBalanceMonth: string | null;
  highestExpenseCategory: string | null;
}
