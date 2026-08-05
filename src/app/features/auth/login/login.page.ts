import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { ProblemDetails } from '../../../core/api/api.models';
import { AuthService } from '../../../core/auth/auth.service';
import { ThemeService } from '../../../core/theme/theme.service';

@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.page.html',
  styleUrl: './login.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPage {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly themeService = inject(ThemeService);

  protected readonly isSubmitting = signal(false);
  protected readonly showPassword = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(
    this.route.snapshot.queryParamMap.get('accountDeleted') === 'true'
      ? 'Sua conta e seus dados privados foram excluídos com sucesso.'
      : this.route.snapshot.queryParamMap.get('passwordChanged') === 'true'
        ? 'Senha alterada. Todas as sessões foram encerradas; entre novamente.'
        : null,
  );

  protected readonly form = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  protected useDemoAccount(): void {
    this.form.setValue({
      email: 'demo@financecontrol.local',
      password: 'ChangeMe123!',
    });
    this.errorMessage.set(null);
  }

  protected submit(): void {
    this.errorMessage.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.authService
      .login(this.form.getRawValue())
      .pipe(finalize(() => this.isSubmitting.set(false)))
      .subscribe({
        next: () => void this.router.navigate(['/dashboard']),
        error: (error: unknown) => this.handleLoginError(error),
      });
  }

  private handleLoginError(error: unknown): void {
    if (error instanceof HttpErrorResponse) {
      const problem = error.error as Partial<ProblemDetails> | null;
      if (error.status === 401) {
        this.errorMessage.set('E-mail ou senha incorretos. Confira os dados e tente novamente.');
        return;
      }

      if (problem?.detail) {
        this.errorMessage.set(problem.detail);
        return;
      }
    }

    this.errorMessage.set(
      'Não foi possível acessar sua conta agora. Tente novamente em instantes.',
    );
  }
}
