import { inject, Injectable, signal } from '@angular/core';
import { forkJoin } from 'rxjs';

import { FinanceControlApiService } from '../api/finance-control-api.service';

@Injectable({ providedIn: 'root' })
export class DebtNotificationsService {
  private readonly api = inject(FinanceControlApiService);
  private readonly pendingCountState = signal(0);

  readonly pendingCount = this.pendingCountState.asReadonly();

  refresh(): void {
    forkJoin({
      payments: this.api.getPendingPaymentConfirmations(),
      settlements: this.api.getPendingSettlementTransferConfirmations(),
    }).subscribe({
      next: ({ payments, settlements }) =>
        this.pendingCountState.set(payments.length + settlements.length),
      error: () => this.pendingCountState.set(0),
    });
  }

  setCount(count: number): void {
    this.pendingCountState.set(Math.max(0, count));
  }
}
