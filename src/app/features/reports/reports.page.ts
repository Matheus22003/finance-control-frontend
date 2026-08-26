import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { finalize } from 'rxjs';

import { FinanceControlApiService } from '../../core/api/finance-control-api.service';
import { ReportOverviewResponse } from '../../core/api/api.models';

@Component({
  selector: 'app-reports-page',
  imports: [CurrencyPipe, DatePipe, DecimalPipe],
  templateUrl: './reports.page.html',
  styleUrl: './reports.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportsPage implements OnInit {
  private readonly api = inject(FinanceControlApiService);

  protected readonly fromMonth = signal(this.defaultFromMonth());
  protected readonly toMonth = signal(this.currentMonth());
  protected readonly report = signal<ReportOverviewResponse | null>(null);
  protected readonly loading = signal(true);
  protected readonly exporting = signal(false);
  protected readonly errorMessage = signal('');

  ngOnInit(): void {
    this.loadReport();
  }

  protected updateFromMonth(event: Event): void {
    this.fromMonth.set((event.target as HTMLInputElement).value);
  }

  protected updateToMonth(event: Event): void {
    this.toMonth.set((event.target as HTMLInputElement).value);
  }

  protected loadReport(): void {
    if (!this.isPeriodValid()) {
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');
    this.api
      .getReportOverview(this.fromMonth(), this.toMonth())
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (report) => this.report.set(report),
        error: () => this.errorMessage.set('Não foi possível carregar o relatório deste período.'),
      });
  }

  protected downloadCsv(): void {
    if (!this.isPeriodValid() || this.exporting()) {
      return;
    }

    this.exporting.set(true);
    this.errorMessage.set('');
    this.api
      .exportReportCsv(this.fromMonth(), this.toMonth())
      .pipe(finalize(() => this.exporting.set(false)))
      .subscribe({
        next: (file) => {
          const url = URL.createObjectURL(file);
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = `finance-control-relatorio-${this.fromMonth()}-a-${this.toMonth()}.csv`;
          anchor.click();
          URL.revokeObjectURL(url);
        },
        error: () => this.errorMessage.set('Não foi possível exportar o relatório agora.'),
      });
  }

  protected monthLabel(value: string | null): string {
    if (!value) {
      return 'Sem dados';
    }

    const date = new Date(`${value}-01T00:00:00Z`);
    return new Intl.DateTimeFormat('pt-BR', {
      month: 'short',
      year: '2-digit',
      timeZone: 'UTC',
    }).format(date);
  }

  protected chartHeight(value: number, report: ReportOverviewResponse): number {
    const maximum = Math.max(
      1,
      ...report.finance.months.flatMap((month) => [month.totalIncome, month.totalExpenses]),
    );
    return value === 0 ? 3 : Math.max(8, Math.round((value / maximum) * 100));
  }

  protected debtCategoryName(category: string): string {
    const names: Record<string, string> = {
      FOOD: 'Alimentação',
      RENT: 'Moradia',
      TRANSPORT: 'Transporte',
      TRAVEL: 'Viagem',
      LOAN: 'Empréstimo',
      OTHER: 'Outros',
    };
    return names[category] ?? category;
  }

  private isPeriodValid(): boolean {
    if (!this.fromMonth() || !this.toMonth()) {
      this.errorMessage.set('Informe o mês inicial e o mês final.');
      return false;
    }

    if (this.fromMonth() > this.toMonth()) {
      this.errorMessage.set('O mês inicial deve ser anterior ou igual ao mês final.');
      return false;
    }

    const from = this.monthIndex(this.fromMonth());
    const to = this.monthIndex(this.toMonth());
    if (to - from + 1 > 24) {
      this.errorMessage.set('Selecione um período de no máximo 24 meses.');
      return false;
    }

    return true;
  }

  private currentMonth(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  private defaultFromMonth(): string {
    const now = new Date();
    now.setDate(1);
    now.setMonth(now.getMonth() - 5);
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  private monthIndex(value: string): number {
    const [year, month] = value.split('-').map(Number);
    return year * 12 + month;
  }
}
