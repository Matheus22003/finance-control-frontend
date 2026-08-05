import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { ThemeService } from '../../../core/theme/theme.service';

type ConfirmationState = 'confirming' | 'confirmed' | 'invalid';

@Component({
  selector: 'app-confirm-email-page',
  imports: [RouterLink],
  templateUrl: './confirm-email.page.html',
  styleUrl: '../login/login.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmEmailPage {
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  protected readonly themeService = inject(ThemeService);
  protected readonly state = signal<ConfirmationState>('confirming');

  constructor() {
    const userId = this.route.snapshot.queryParamMap.get('userId');
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!userId || !token) {
      this.state.set('invalid');
      return;
    }

    this.auth.confirmEmail({ userId, token }).subscribe({
      next: () => this.state.set('confirmed'),
      error: () => this.state.set('invalid'),
    });
  }
}
