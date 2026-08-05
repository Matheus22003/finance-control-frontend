import { TestBed } from '@angular/core/testing';
import { NEVER, of } from 'rxjs';
import { vi } from 'vitest';

import {
  DebtResponse,
  GroupResponse,
  SimplifiedSettlementResponse,
} from '../../core/api/api.models';
import { FinanceControlApiService } from '../../core/api/finance-control-api.service';
import { NotificationCenterService } from '../../core/notifications/notification-center.service';
import { DebtsPage } from './debts.page';

describe('DebtsPage', () => {
  const currentUser = {
    id: 'current-id',
    name: 'Você',
    email: 'voce@example.com',
    isCurrentUser: true,
    createdAt: '',
    updatedAt: '',
  };
  const participant = {
    id: 'participant-id',
    name: 'Ana',
    email: 'ana@example.com',
    isCurrentUser: false,
    createdAt: '',
    updatedAt: '',
  };
  const emptySummary = { totalOwed: 0, totalToReceive: 0, openDebtsCount: 0 };
  const emptySettlements: SimplifiedSettlementResponse = {
    totalOpenAmount: 0,
    originalTransferCount: 0,
    simplifiedTransferCount: 0,
    transfers: [],
  };
  const api = {
    getDebts: vi.fn(() => of([] as DebtResponse[])),
    getPeople: vi.fn(() => of([currentUser, participant])),
    getDebtSummary: vi.fn(() => of(emptySummary)),
    getSimplifiedSettlements: vi.fn((groupId?: string) => of(emptySettlements)),
    getActiveSettlementTransfers: vi.fn(() => of([])),
    getGroups: vi.fn(() => of([] as GroupResponse[])),
    createDebt: vi.fn(() => of({})),
    updateDebt: vi.fn(),
    deleteDebt: vi.fn(),
    createPerson: vi.fn(),
    recordSettlementTransfer: vi.fn(() => of({})),
    confirmSettlementTransfer: vi.fn(() => of({})),
    rejectSettlementTransfer: vi.fn(() => of({})),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    api.getDebts.mockReturnValue(of([] as DebtResponse[]));
    api.getPeople.mockReturnValue(of([currentUser, participant]));
    api.getDebtSummary.mockReturnValue(of(emptySummary));
    api.getSimplifiedSettlements.mockReturnValue(of(emptySettlements));
    api.getActiveSettlementTransfers.mockReturnValue(of([]));
    api.getGroups.mockReturnValue(of([]));
    api.createDebt.mockReturnValue(of({}));
    api.updateDebt.mockReturnValue(of({}));

    await TestBed.configureTestingModule({
      imports: [DebtsPage],
      providers: [
        { provide: FinanceControlApiService, useValue: api },
        { provide: NotificationCenterService, useValue: { changes$: NEVER } },
      ],
    }).compileComponents();
  });

  it('requires participants whose shares match the total', () => {
    const fixture = TestBed.createComponent(DebtsPage);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    element.querySelector<HTMLButtonElement>('.page-header .primary-button')?.click();
    fixture.detectChanges();
    const description = element.querySelector<HTMLInputElement>('#debt-description');
    const total = element.querySelector<HTMLInputElement>('#debt-total');
    if (!description || !total) {
      throw new Error('Debt fields were not rendered.');
    }
    description.value = 'Jantar';
    description.dispatchEvent(new Event('input'));
    total.value = '120';
    total.dispatchEvent(new Event('input'));
    element.querySelector<HTMLButtonElement>('.debt-modal button[type="submit"]')?.click();
    fixture.detectChanges();

    expect(api.createDebt).not.toHaveBeenCalled();
    expect(element.textContent).toContain('distribua exatamente o valor total');
  });

  it('keeps payer independent and creates the selected participant share', () => {
    const fixture = TestBed.createComponent(DebtsPage);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    element.querySelector<HTMLButtonElement>('.page-header .primary-button')?.click();
    fixture.detectChanges();
    const description = element.querySelector<HTMLInputElement>('#debt-description');
    const total = element.querySelector<HTMLInputElement>('#debt-total');
    const anaRow = [...element.querySelectorAll<HTMLElement>('.participant-row')].find((row) =>
      row.textContent?.includes('Ana'),
    );
    const checkbox = anaRow?.querySelector<HTMLInputElement>('input[type="checkbox"]');
    if (!description || !total || !checkbox) {
      throw new Error('Debt creation controls were not rendered.');
    }

    description.value = 'Jantar';
    description.dispatchEvent(new Event('input'));
    total.value = '120';
    total.dispatchEvent(new Event('input'));
    checkbox.click();
    fixture.detectChanges();
    const share = anaRow?.querySelector<HTMLInputElement>('input[type="number"]');
    if (!share) {
      throw new Error('Participant share input was not rendered.');
    }
    share.value = '120';
    share.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    element.querySelector<HTMLButtonElement>('.debt-modal button[type="submit"]')?.click();
    fixture.detectChanges();

    expect(api.createDebt).toHaveBeenCalledWith({
      description: 'Jantar',
      totalAmount: 120,
      paidByPersonId: 'current-id',
      groupId: null,
      category: 'OTHER',
      dueDate: null,
      shares: [{ personId: 'participant-id', amount: 120 }],
    });
  });

  it('prevents creating a second current user from the quick form', () => {
    const fixture = TestBed.createComponent(DebtsPage);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    element.querySelector<HTMLButtonElement>('.page-header .primary-button')?.click();
    fixture.detectChanges();
    const addPersonButton = [...element.querySelectorAll<HTMLButtonElement>('.text-button')].find(
      (button) => button.textContent?.includes('Adicionar pessoa'),
    );
    addPersonButton?.click();
    fixture.detectChanges();

    expect(element.querySelector<HTMLInputElement>('.current-user-check input')?.disabled).toBe(
      true,
    );
  });

  it('edits the people and shares involved in an existing debt', () => {
    api.getDebts.mockReturnValue(
      of([
        {
          id: 'debt-id',
          description: 'Jantar',
          totalAmount: 120,
          paidBy: { id: 'current-id', name: 'Você', isCurrentUser: true },
          groupId: null,
          category: 'FOOD' as const,
          status: 'OPEN' as const,
          dueDate: null,
          createdByCurrentUser: true,
          createdAt: '',
          updatedAt: '',
          shares: [
            {
              id: 'share-id',
              person: { id: 'participant-id', name: 'Ana', isCurrentUser: false },
              amount: 120,
              paidAmount: 0,
              remainingAmount: 120,
              isPayer: false,
            },
          ],
        },
      ]),
    );
    const fixture = TestBed.createComponent(DebtsPage);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    element.querySelector<HTMLButtonElement>('[aria-label="Editar Jantar"]')?.click();
    fixture.detectChanges();
    const rows = [...element.querySelectorAll<HTMLElement>('.participant-row')];
    const currentRow = rows.find((row) => row.textContent?.includes('Você'));
    currentRow?.querySelector<HTMLInputElement>('input[type="checkbox"]')?.click();
    fixture.detectChanges();

    const anaAmount = element.querySelector<HTMLInputElement>('[aria-label="Parte de Ana"]');
    const currentAmount = element.querySelector<HTMLInputElement>('[aria-label="Parte de Você"]');
    if (!anaAmount || !currentAmount) {
      throw new Error('Participant share inputs were not rendered for editing.');
    }
    anaAmount.value = '60';
    anaAmount.dispatchEvent(new Event('input'));
    currentAmount.value = '60';
    currentAmount.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    element.querySelector<HTMLButtonElement>('.debt-modal button[type="submit"]')?.click();

    expect(api.updateDebt).toHaveBeenCalledWith('debt-id', {
      description: 'Jantar',
      paidByPersonId: 'current-id',
      category: 'FOOD',
      dueDate: null,
      shares: [
        { personId: 'participant-id', amount: 60 },
        { personId: 'current-id', amount: 60 },
      ],
    });
  });

  it('calculates a settlement plan only for the selected group', () => {
    api.getGroups.mockReturnValue(
      of([
        {
          id: 'group-id',
          name: 'Viagem',
          description: null,
          createdByUserId: 'current-id',
          createdAt: '',
          updatedAt: '',
          members: [],
        },
      ]),
    );
    api.getSimplifiedSettlements.mockImplementation((groupId?: string) =>
      of(
        groupId
          ? {
              totalOpenAmount: 150,
              originalTransferCount: 3,
              simplifiedTransferCount: 1,
              transfers: [
                {
                  fromIdentityId: 'participant-user-id',
                  fromPerson: { id: 'participant-id', name: 'Ana', isCurrentUser: false },
                  toIdentityId: 'current-user-id',
                  toPerson: { id: 'current-id', name: 'Você', isCurrentUser: true },
                  amount: 50,
                },
              ],
            }
          : emptySettlements,
      ),
    );
    const fixture = TestBed.createComponent(DebtsPage);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const selector = element.querySelector<HTMLSelectElement>('#settlement-group');
    if (!selector) {
      throw new Error('Settlement group selector was not rendered.');
    }

    selector.value = 'group-id';
    selector.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(api.getSimplifiedSettlements).toHaveBeenCalledWith('group-id');
    expect(element.textContent).toContain('Ana');
    expect(element.textContent).toContain('2 transferência(s) evitada(s)');
  });

  it('opens the simplified payment already filled and sends it through the BFF', () => {
    api.getSimplifiedSettlements.mockReturnValue(
      of({
        totalOpenAmount: 50,
        originalTransferCount: 1,
        simplifiedTransferCount: 1,
        transfers: [
          {
            fromIdentityId: 'current-user-id',
            fromPerson: { id: 'current-id', name: 'Você', isCurrentUser: true },
            toIdentityId: 'participant-user-id',
            toPerson: { id: 'participant-id', name: 'Ana', isCurrentUser: false },
            amount: 50,
          },
        ],
      }),
    );
    const fixture = TestBed.createComponent(DebtsPage);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    element.querySelector<HTMLButtonElement>('.settlement-action')?.click();
    fixture.detectChanges();
    const date = element.querySelector<HTMLInputElement>('#settlement-payment-date');
    if (!date) {
      throw new Error('Simplified payment modal was not rendered.');
    }

    expect(element.textContent).toContain('R$50.00');
    expect(date.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    element
      .querySelector<HTMLButtonElement>('.settlement-payment-modal button[type="submit"]')
      ?.click();

    expect(api.recordSettlementTransfer).toHaveBeenCalledWith({
      groupId: null,
      fromPersonId: 'current-id',
      toPersonId: 'participant-id',
      amount: 50,
      paymentDate: date.value,
      note: null,
    });
  });
});
