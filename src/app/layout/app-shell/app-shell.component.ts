import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { DebtNotificationsService } from '../../core/debts/debt-notifications.service';
import { NotificationResponse } from '../../core/api/api.models';
import { NotificationCenterService } from '../../core/notifications/notification-center.service';
import { ThemeService } from '../../core/theme/theme.service';
import { UserProfileStateService } from '../../core/account/user-profile-state.service';

@Component({
  selector: 'app-shell',
  imports: [DatePipe, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppShellComponent {
  private readonly authService = inject(AuthService);
  private readonly debtNotifications = inject(DebtNotificationsService);
  private readonly notificationCenter = inject(NotificationCenterService);
  private readonly userProfileState = inject(UserProfileStateService);
  private readonly router = inject(Router);
  protected readonly themeService = inject(ThemeService);

  protected readonly userEmail = this.authService.userEmail;
  protected readonly userDisplayName = this.authService.userDisplayName;
  protected readonly pendingDebtCount = this.debtNotifications.pendingCount;
  protected readonly notifications = this.notificationCenter.notifications;
  protected readonly unreadNotificationCount = this.notificationCenter.unreadCount;
  protected readonly notificationsOpen = signal(false);
  protected readonly userInitials = this.userProfileState.initials;
  protected readonly avatarUrl = this.userProfileState.avatarObjectUrl;

  constructor() {
    this.debtNotifications.refresh();
    this.notificationCenter.start();
    this.notificationCenter.changes$.pipe(takeUntilDestroyed()).subscribe((notification) => {
      if (
        notification.type.startsWith('PAYMENT_') ||
        notification.type.startsWith('SETTLEMENT_') ||
        notification.type.startsWith('DEBT_')
      ) {
        this.debtNotifications.refresh();
      }
    });
    this.userProfileState.load();
  }

  protected logout(): void {
    this.notificationCenter.stop();
    this.userProfileState.clear();
    this.authService.logout().subscribe({
      next: () => void this.router.navigate(['/login']),
      error: () => void this.router.navigate(['/login']),
    });
  }

  protected toggleNotifications(): void {
    this.notificationsOpen.update((open) => !open);
  }

  protected closeNotifications(): void {
    this.notificationsOpen.set(false);
  }

  protected openNotification(notification: NotificationResponse): void {
    this.notificationCenter.markAsRead(notification);
    this.notificationsOpen.set(false);
    if (notification.route) {
      void this.router.navigateByUrl(notification.route);
    }
  }

  protected markAllNotificationsAsRead(): void {
    this.notificationCenter.markAllAsRead();
  }
}
