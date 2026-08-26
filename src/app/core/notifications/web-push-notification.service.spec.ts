import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { SwPush } from '@angular/service-worker';
import { BehaviorSubject, of, Subject, throwError } from 'rxjs';

import { FinanceControlApiService } from '../api/finance-control-api.service';
import { AuthService } from '../auth/auth.service';
import { WebPushNotificationService } from './web-push-notification.service';

describe('WebPushNotificationService', () => {
  const subscriptionState = new BehaviorSubject<PushSubscription | null>(null);
  const clickState = new Subject<{
    action: string;
    notification: { data?: Record<string, unknown> };
  }>();
  const subscriptionChangesState = new Subject<{
    oldSubscription: PushSubscription | null;
    newSubscription: PushSubscription | null;
  }>();
  const router = { navigateByUrl: vi.fn() };
  const api = {
    getPushNotificationConfiguration: vi.fn(),
    getPushSubscriptions: vi.fn(),
    createPushSubscription: vi.fn(),
    unsubscribeCurrentPushEndpoint: vi.fn(),
    removePushSubscription: vi.fn(),
  };
  const swPush = {
    isEnabled: true,
    subscription: subscriptionState.asObservable(),
    notificationClicks: clickState.asObservable(),
    pushSubscriptionChanges: subscriptionChangesState.asObservable(),
    requestSubscription: vi.fn(),
  };

  let service: WebPushNotificationService;

  beforeEach(() => {
    vi.clearAllMocks();
    subscriptionState.next(null);
    api.getPushNotificationConfiguration.mockReturnValue(
      of({ isConfigured: true, publicKey: 'public-vapid-key' }),
    );
    api.getPushSubscriptions.mockReturnValue(of([]));

    TestBed.configureTestingModule({
      providers: [
        WebPushNotificationService,
        { provide: FinanceControlApiService, useValue: api },
        { provide: AuthService, useValue: { isAuthenticated: () => true } },
        { provide: Router, useValue: router },
        { provide: SwPush, useValue: swPush },
      ],
    });
    service = TestBed.inject(WebPushNotificationService);
  });

  afterEach(() => TestBed.resetTestingModule());

  it('loads server configuration and registered devices', () => {
    const device = {
      id: 'device-id',
      deviceName: 'Browser de teste',
      createdAt: '2026-08-25T12:00:00Z',
      updatedAt: '2026-08-25T12:00:00Z',
    };
    api.getPushSubscriptions.mockReturnValue(of([device]));

    service.refresh();

    expect(service.configured()).toBe(true);
    expect(service.subscribed()).toBe(false);
    expect(service.devices()).toEqual([device]);
  });

  it('registers the browser subscription only through the BFF', async () => {
    const browserSubscription = {
      endpoint: 'https://push.example/subscription',
      toJSON: () => ({
        endpoint: 'https://push.example/subscription',
        keys: { p256dh: 'p256dh-key', auth: 'auth-key' },
      }),
    } as unknown as PushSubscription;
    const device = {
      id: 'device-id',
      deviceName: 'Browser de teste',
      createdAt: '2026-08-25T12:00:00Z',
      updatedAt: '2026-08-25T12:00:00Z',
    };
    swPush.requestSubscription.mockResolvedValue(browserSubscription);
    api.createPushSubscription.mockReturnValue(of(device));
    service.refresh();

    service.enableCurrentDevice();
    await Promise.resolve();

    expect(swPush.requestSubscription).toHaveBeenCalledWith({
      serverPublicKey: 'public-vapid-key',
    });
    expect(api.createPushSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: browserSubscription.endpoint,
        p256Dh: 'p256dh-key',
        auth: 'auth-key',
      }),
    );
    expect(service.subscribed()).toBe(true);
    expect(service.devices()).toEqual([device]);
  });

  it('routes notification clicks and reports configuration failures', () => {
    service.initialize();
    clickState.next({ action: '', notification: { data: { route: '/debts' } } });

    expect(router.navigateByUrl).toHaveBeenCalledWith('/debts');

    api.getPushNotificationConfiguration.mockReturnValue(throwError(() => new Error('offline')));
    service.refresh();

    expect(service.message()).toBe('Não foi possível carregar os dispositivos push.');
  });

  it('registers a replacement when the browser rotates its subscription', () => {
    const replacement = {
      endpoint: 'https://push.example/replacement',
      toJSON: () => ({
        endpoint: 'https://push.example/replacement',
        keys: { p256dh: 'replacement-p256dh', auth: 'replacement-auth' },
      }),
    } as unknown as PushSubscription;
    const device = {
      id: 'replacement-id',
      deviceName: 'Browser atualizado',
      createdAt: '2026-08-25T12:00:00Z',
      updatedAt: '2026-08-25T13:00:00Z',
    };
    api.createPushSubscription.mockReturnValue(of(device));
    service.initialize();

    subscriptionChangesState.next({ oldSubscription: null, newSubscription: replacement });

    expect(api.createPushSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: replacement.endpoint }),
    );
    expect(service.subscribed()).toBe(true);
    expect(service.devices()).toEqual([device]);
  });
});
