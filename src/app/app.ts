import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ThemeService } from './core/theme/theme.service';
import { WebPushNotificationService } from './core/notifications/web-push-notification.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly themeService = inject(ThemeService);
  private readonly webPushNotifications = inject(WebPushNotificationService);

  protected readonly themePreference = this.themeService.preference;

  constructor() {
    this.webPushNotifications.initialize();
  }
}
