import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { ThemeService } from '../../../core/theme/theme.service';

type EmailChangeState = 'confirming' | 'confirmed' | 'invalid';

@Component({
  selector: 'app-confirm-email-change-page',
  imports: [RouterLink],
  templateUrl: './confirm-email-change.page.html',
  styleUrl: '../login/login.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmEmailChangePage {
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  protected readonly themeService = inject(ThemeService);
  protected readonly state = signal<EmailChangeState>('confirming');
  protected readonly newEmail = this.route.snapshot.queryParamMap.get('newEmail') ?? '';

  constructor() {
    const userId = this.route.snapshot.queryParamMap.get('userId');
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!userId || !token || !this.newEmail) {
      this.state.set('invalid');
      return;
    }

    this.auth.confirmEmailChange({ userId, newEmail: this.newEmail, token }).subscribe({
      next: () => this.state.set('confirmed'),
      error: () => this.state.set('invalid'),
    });
  }
}
