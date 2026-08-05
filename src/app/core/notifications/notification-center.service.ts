import { Injectable, signal } from '@angular/core';
import { HubConnection, HubConnectionBuilder, HubConnectionState } from '@microsoft/signalr';
import { Subject, forkJoin } from 'rxjs';

import { FinanceControlApiService } from '../api/finance-control-api.service';
import { NotificationResponse } from '../api/api.models';
import { AuthService } from '../auth/auth.service';

@Injectable({ providedIn: 'root' })
export class NotificationCenterService {
  private readonly notificationsState = signal<NotificationResponse[]>([]);
  private readonly unreadCountState = signal(0);
  private readonly connectedState = signal(false);
  private readonly changesState = new Subject<NotificationResponse>();
  private connection: HubConnection | null = null;
  private shouldStayConnected = false;
  private initialReconnectTimer: ReturnType<typeof setTimeout> | undefined;

  readonly notifications = this.notificationsState.asReadonly();
  readonly unreadCount = this.unreadCountState.asReadonly();
  readonly isConnected = this.connectedState.asReadonly();
  readonly changes$ = this.changesState.asObservable();

  constructor(
    private readonly api: FinanceControlApiService,
    private readonly authService: AuthService,
  ) {}

  start(): void {
    if (this.shouldStayConnected || !this.authService.isAuthenticated()) {
      return;
    }

    this.shouldStayConnected = true;
    this.refresh();
    this.connection = new HubConnectionBuilder()
      .withUrl('/api/v1/notifications/hub', {
        accessTokenFactory: () => this.authService.accessToken() ?? '',
      })
      .withAutomaticReconnect([0, 2_000, 10_000, 30_000])
      .build();
    this.connection.on('notificationReceived', (notification: NotificationResponse) => {
      this.notificationsState.update((current) => [
        notification,
        ...current.filter((candidate) => candidate.id !== notification.id),
      ]);
      if (!notification.isRead) {
        this.unreadCountState.update((count) => count + 1);
      }
      this.changesState.next(notification);
    });
    this.connection.onreconnecting(() => this.connectedState.set(false));
    this.connection.onreconnected(() => {
      this.connectedState.set(true);
      this.refresh();
    });
    this.connection.onclose(() => {
      this.connectedState.set(false);
      this.scheduleInitialReconnect();
    });
    void this.startConnection();
  }

  refresh(): void {
    forkJoin({
      notifications: this.api.getNotifications(),
      unreadCount: this.api.getUnreadNotificationCount(),
    }).subscribe({
      next: ({ notifications, unreadCount }) => {
        this.notificationsState.set(notifications);
        this.unreadCountState.set(unreadCount.unreadCount);
      },
    });
  }

  markAsRead(notification: NotificationResponse): void {
    if (notification.isRead) {
      return;
    }

    this.api.markNotificationAsRead(notification.id).subscribe({
      next: (updated) => {
        this.notificationsState.update((current) =>
          current.map((candidate) => (candidate.id === updated.id ? updated : candidate)),
        );
        this.unreadCountState.update((count) => Math.max(0, count - 1));
      },
    });
  }

  markAllAsRead(): void {
    this.api.markAllNotificationsAsRead().subscribe({
      next: () => {
        const readAt = new Date().toISOString();
        this.notificationsState.update((current) =>
          current.map((notification) => ({ ...notification, isRead: true, readAt })),
        );
        this.unreadCountState.set(0);
      },
    });
  }

  stop(): void {
    this.shouldStayConnected = false;
    this.clearInitialReconnectTimer();
    const connection = this.connection;
    this.connection = null;
    this.connectedState.set(false);
    this.notificationsState.set([]);
    this.unreadCountState.set(0);
    if (connection && connection.state !== HubConnectionState.Disconnected) {
      void connection.stop();
    }
  }

  private async startConnection(): Promise<void> {
    if (!this.connection || !this.shouldStayConnected) {
      return;
    }

    try {
      await this.connection.start();
      this.connectedState.set(true);
    } catch {
      this.connectedState.set(false);
      this.scheduleInitialReconnect();
    }
  }

  private scheduleInitialReconnect(): void {
    if (!this.shouldStayConnected || this.initialReconnectTimer) {
      return;
    }

    this.initialReconnectTimer = setTimeout(() => {
      this.initialReconnectTimer = undefined;
      if (this.connection?.state === HubConnectionState.Disconnected) {
        void this.startConnection();
      }
    }, 5_000);
  }

  private clearInitialReconnectTimer(): void {
    if (this.initialReconnectTimer) {
      clearTimeout(this.initialReconnectTimer);
      this.initialReconnectTimer = undefined;
    }
  }
}
