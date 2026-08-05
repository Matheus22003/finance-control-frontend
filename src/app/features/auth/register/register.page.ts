import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { ProblemDetails } from '../../../core/api/api.models';
import { AuthService } from '../../../core/auth/auth.service';
import { ThemeService } from '../../../core/theme/theme.service';

@Component({
  selector: 'app-register-page',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register.page.html',
  styleUrl: '../login/login.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterPage {
  private readonly builder = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  protected readonly themeService = inject(ThemeService);
  protected readonly isSubmitting = signal(false);
  protected readonly isResending = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly infoMessage = signal<string | null>(null);
  protected readonly registeredEmail = signal<string | null>(null);
  protected readonly form = this.builder.nonNullable.group({
    displayName: ['', [Validators.required, Validators.maxLength(120)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    passwordConfirmation: ['', Validators.required],
  });

  protected submit(): void {
    this.errorMessage.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    if (value.password !== value.passwordConfirmation) {
      this.errorMessage.set('As senhas precisam ser iguais.');
      return;
    }

    this.isSubmitting.set(true);
    this.auth.register({
      displayName: value.displayName,
      email: value.email,
      password: value.password,
    }).pipe(finalize(() => this.isSubmitting.set(false))).subscribe({
      next: (response) => this.registeredEmail.set(response.email),
      error: (error: unknown) => this.handleError(error),
    });
  }

  protected resendConfirmation(): void {
    const email = this.registeredEmail();
    if (!email) return;

    this.errorMessage.set(null);
    this.infoMessage.set(null);
    this.isResending.set(true);
    this.auth.resendConfirmation(email).pipe(finalize(() => this.isResending.set(false))).subscribe({
      next: () => this.infoMessage.set('Enviamos um novo link de confirmação.'),
      error: () => this.errorMessage.set('Não foi possível reenviar agora. Tente novamente.'),
    });
  }

  private handleError(error: unknown): void {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 409) {
        this.errorMessage.set('Este e-mail já possui uma conta.');
        return;
      }
      const problem = error.error as Partial<ProblemDetails> | null;
      if (problem?.detail) {
        this.errorMessage.set(problem.detail);
        return;
      }
    }
    this.errorMessage.set('Não foi possível criar sua conta agora. Tente novamente.');
  }
}
