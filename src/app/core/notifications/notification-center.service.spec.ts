import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { NotificationResponse } from '../api/api.models';
import { FinanceControlApiService } from '../api/finance-control-api.service';
import { AuthService } from '../auth/auth.service';
import { NotificationCenterService } from './notification-center.service';

describe('NotificationCenterService', () => {
  const notification: NotificationResponse = {
    id: 'notification-id',
    type: 'PAYMENT_RECORDED',
    title: 'Pagamento pendente',
    message: 'Ana registrou um pagamento.',
    route: '/debts',
    isRead: false,
    readAt: null,
    createdAt: '2026-08-03T12:00:00Z',
  };
  const api = {
    getNotifications: vi.fn(() => of([notification])),
    getUnreadNotificationCount: vi.fn(() => of({ unreadCount: 1 })),
    syncNotificationAlerts: vi.fn(() => of({ createdCount: 1, syncedAt: '2026-08-03T12:00:00Z' })),
    markNotificationAsRead: vi.fn(() =>
      of({ ...notification, isRead: true, readAt: '2026-08-03T12:01:00Z' }),
    ),
    markAllNotificationsAsRead: vi.fn(() => of({ unreadCount: 0 })),
  };
  const auth = {
    isAuthenticated: vi.fn(() => true),
    accessToken: vi.fn(() => 'token'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        { provide: FinanceControlApiService, useValue: api },
        { provide: AuthService, useValue: auth },
      ],
    });
  });

  it('loads persistent notifications and their unread count', () => {
    const service = TestBed.inject(NotificationCenterService);

    service.refresh();

    expect(service.notifications()).toEqual([notification]);
    expect(service.unreadCount()).toBe(1);
  });

  it('marks one notification and then all notifications as read', () => {
    const service = TestBed.inject(NotificationCenterService);
    service.refresh();

    service.markAsRead(notification);

    expect(api.markNotificationAsRead).toHaveBeenCalledWith('notification-id');
    expect(service.notifications()[0]?.isRead).toBe(true);
    expect(service.unreadCount()).toBe(0);

    service.markAllAsRead();

    expect(api.markAllNotificationsAsRead).toHaveBeenCalled();
    expect(service.unreadCount()).toBe(0);
  });

  it('synchronizes server-side alerts and refreshes the persistent inbox', () => {
    const service = TestBed.inject(NotificationCenterService);

    service.synchronizeAlerts();

    expect(api.syncNotificationAlerts).toHaveBeenCalledOnce();
    expect(api.getNotifications).toHaveBeenCalledOnce();
    expect(service.notifications()).toEqual([notification]);
  });
});
