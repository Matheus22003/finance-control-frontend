import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';

import { DeviceSession } from '../../core/auth/auth.models';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-security-page',
  imports: [DatePipe, ReactiveFormsModule],
  templateUrl: './security.page.html',
  styleUrl: './security.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SecurityPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly builder = inject(FormBuilder);
  protected readonly sessions = signal<DeviceSession[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly revokingId = signal<string | null>(null);
  protected readonly isChangingPassword = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly passwordError = signal<string | null>(null);
  protected readonly passwordForm = this.builder.nonNullable.group({
    currentPassword: ['', Validators.required],
    newPassword: ['', [Validators.required, Validators.minLength(8)]],
    confirmation: ['', Validators.required],
  });

  constructor() {
    this.load();
  }

  protected changePassword(): void {
    this.passwordError.set(null);
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    const value = this.passwordForm.getRawValue();
    if (value.newPassword !== value.confirmation) {
      this.passwordError.set('As novas senhas precisam ser iguais.');
      return;
    }

    this.isChangingPassword.set(true);
    this.auth.changePassword({
      currentPassword: value.currentPassword,
      newPassword: value.newPassword,
    }).pipe(finalize(() => this.isChangingPassword.set(false))).subscribe({
      next: () => void this.router.navigate(['/login'], {
        queryParams: { passwordChanged: 'true' },
      }),
      error: () => this.passwordError.set(
        'Não foi possível alterar a senha. Confira a senha atual e os requisitos da nova senha.',
      ),
    });
  }

  protected revoke(session: DeviceSession): void {
    this.revokingId.set(session.id);
    this.errorMessage.set(null);
    this.auth.revokeSession(session.id).pipe(finalize(() => this.revokingId.set(null))).subscribe({
      next: () => {
        if (session.isCurrent) {
          this.auth.clearSession();
          void this.router.navigate(['/login']);
        } else {
          this.sessions.update((items) => items.filter((item) => item.id !== session.id));
        }
      },
      error: () => this.errorMessage.set('Não foi possível encerrar esta sessão.'),
    });
  }

  private load(): void {
    this.auth.listSessions().pipe(finalize(() => this.isLoading.set(false))).subscribe({
      next: (sessions) => this.sessions.set(sessions),
      error: () => this.errorMessage.set('Não foi possível carregar os dispositivos conectados.'),
    });
  }
}
