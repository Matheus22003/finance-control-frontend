import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { ProblemDetails } from '../../../core/api/api.models';
import { AuthService } from '../../../core/auth/auth.service';
import { ThemeService } from '../../../core/theme/theme.service';

@Component({
  selector: 'app-reset-password-page',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './reset-password.page.html',
  styleUrl: '../login/login.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetPasswordPage {
  private readonly builder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  protected readonly themeService = inject(ThemeService);
  protected readonly isSubmitting = signal(false);
  protected readonly completed = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly userId = this.route.snapshot.queryParamMap.get('userId');
  protected readonly token = this.route.snapshot.queryParamMap.get('token');
  protected readonly hasValidLink = Boolean(this.userId && this.token);
  protected readonly form = this.builder.nonNullable.group({
    newPassword: ['', [Validators.required, Validators.minLength(8)]],
    confirmation: ['', Validators.required],
  });

  protected submit(): void {
    this.errorMessage.set(null);
    if (!this.hasValidLink || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    if (value.newPassword !== value.confirmation) {
      this.errorMessage.set('As senhas precisam ser iguais.');
      return;
    }

    this.isSubmitting.set(true);
    this.auth.resetPassword({
      userId: this.userId!,
      token: this.token!,
      newPassword: value.newPassword,
    }).pipe(finalize(() => this.isSubmitting.set(false))).subscribe({
      next: () => this.completed.set(true),
      error: (error: unknown) => this.handleError(error),
    });
  }

  private handleError(error: unknown): void {
    if (error instanceof HttpErrorResponse) {
      const problem = error.error as Partial<ProblemDetails> | null;
      if (problem?.detail) {
        this.errorMessage.set(problem.detail);
        return;
      }
    }
    this.errorMessage.set('O link expirou ou a nova senha não atende aos requisitos.');
  }
}
