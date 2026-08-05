import { DOCUMENT } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';

import { UserProfileStateService } from '../../core/account/user-profile-state.service';
import { AccountDeletionEligibilityResponse, ProblemDetails } from '../../core/api/api.models';
import { FinanceControlApiService } from '../../core/api/finance-control-api.service';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-account-page',
  imports: [ReactiveFormsModule],
  templateUrl: './account.page.html',
  styleUrl: './account.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountPage {
  private readonly builder = inject(FormBuilder);
  private readonly api = inject(FinanceControlApiService);
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  protected readonly profileState = inject(UserProfileStateService);
  protected readonly profile = this.profileState.profile;
  protected readonly avatarUrl = this.profileState.avatarObjectUrl;
  protected readonly initials = this.profileState.initials;
  protected readonly isSavingProfile = signal(false);
  protected readonly isSavingPreferences = signal(false);
  protected readonly isUploadingAvatar = signal(false);
  protected readonly isRequestingEmail = signal(false);
  protected readonly isExporting = signal(false);
  protected readonly isCheckingDeletion = signal(true);
  protected readonly isDeleting = signal(false);
  protected readonly deletionEligibility = signal<AccountDeletionEligibilityResponse | null>(null);
  protected readonly profileMessage = signal<string | null>(null);
  protected readonly preferencesMessage = signal<string | null>(null);
  protected readonly avatarMessage = signal<string | null>(null);
  protected readonly emailMessage = signal<string | null>(null);
  protected readonly exportMessage = signal<string | null>(null);
  protected readonly deletionMessage = signal<string | null>(null);
  private initializedUserId: string | null = null;

  protected readonly profileForm = this.builder.nonNullable.group({
    displayName: ['', [Validators.required, Validators.maxLength(120)]],
  });
  protected readonly preferencesForm = this.builder.nonNullable.group({
    theme: this.builder.nonNullable.control<'system' | 'light' | 'dark'>('system'),
    emailNotificationsEnabled: true,
    pushNotificationsEnabled: true,
  });
  protected readonly emailForm = this.builder.nonNullable.group({
    newEmail: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });
  protected readonly exportForm = this.builder.nonNullable.group({
    password: ['', Validators.required],
  });
  protected readonly deletionForm = this.builder.nonNullable.group({
    password: ['', Validators.required],
    confirmation: ['', [Validators.required, Validators.pattern(/^EXCLUIR$/)]],
  });

  constructor() {
    this.profileState.load();
    this.loadDeletionEligibility();
    effect(() => {
      const profile = this.profile();
      if (!profile || profile.id === this.initializedUserId) return;
      this.initializedUserId = profile.id;
      this.profileForm.patchValue({ displayName: profile.displayName });
      this.preferencesForm.patchValue(profile.preferences);
    });
  }

  protected saveProfile(): void {
    this.profileMessage.set(null);
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }

    this.isSavingProfile.set(true);
    this.api.updateProfile(this.profileForm.controls.displayName.value)
      .pipe(finalize(() => this.isSavingProfile.set(false)))
      .subscribe({
        next: (profile) => {
          this.profileState.apply(profile);
          this.profileMessage.set('Nome atualizado em toda a sua conta.');
        },
        error: (error: unknown) => this.profileMessage.set(
          this.errorDetail(error, 'Não foi possível atualizar o perfil.'),
        ),
      });
  }

  protected savePreferences(): void {
    this.preferencesMessage.set(null);
    this.isSavingPreferences.set(true);
    this.api.updatePreferences(this.preferencesForm.getRawValue())
      .pipe(finalize(() => this.isSavingPreferences.set(false)))
      .subscribe({
        next: (profile) => {
          this.profileState.apply(profile);
          this.preferencesMessage.set('Preferências salvas.');
        },
        error: () => this.preferencesMessage.set('Não foi possível salvar as preferências.'),
      });
  }

  protected selectAvatar(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.avatarMessage.set(null);
    if (file.size > 1_048_576 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      this.avatarMessage.set('Escolha uma imagem JPEG, PNG ou WebP de até 1 MB.');
      return;
    }

    this.isUploadingAvatar.set(true);
    this.api.updateAvatar(file).pipe(finalize(() => this.isUploadingAvatar.set(false))).subscribe({
      next: (profile) => {
        this.profileState.apply(profile);
        this.avatarMessage.set('Foto atualizada.');
      },
      error: () => this.avatarMessage.set('Não foi possível atualizar a foto.'),
    });
  }

  protected deleteAvatar(): void {
    this.avatarMessage.set(null);
    this.isUploadingAvatar.set(true);
    this.api.deleteAvatar().pipe(finalize(() => this.isUploadingAvatar.set(false))).subscribe({
      next: () => {
        const profile = this.profile();
        if (profile) this.profileState.apply({ ...profile, avatarUrl: null });
        this.avatarMessage.set('Foto removida.');
      },
      error: () => this.avatarMessage.set('Não foi possível remover a foto.'),
    });
  }

  protected requestEmailChange(): void {
    this.emailMessage.set(null);
    if (this.emailForm.invalid) {
      this.emailForm.markAllAsTouched();
      return;
    }

    const value = this.emailForm.getRawValue();
    this.isRequestingEmail.set(true);
    this.api.requestEmailChange(value.newEmail, value.password)
      .pipe(finalize(() => this.isRequestingEmail.set(false)))
      .subscribe({
        next: () => {
          this.emailForm.reset();
          this.emailMessage.set(`Enviamos a confirmação para ${value.newEmail}.`);
        },
        error: (error: unknown) => this.emailMessage.set(
          this.errorDetail(error, 'Não foi possível solicitar a alteração.'),
        ),
      });
  }

  protected exportAccount(): void {
    this.exportMessage.set(null);
    if (this.exportForm.invalid) {
      this.exportForm.markAllAsTouched();
      return;
    }

    this.isExporting.set(true);
    this.api.exportAccount(this.exportForm.controls.password.value)
      .pipe(finalize(() => this.isExporting.set(false)))
      .subscribe({
        next: (file) => {
          const url = URL.createObjectURL(file);
          const anchor = this.document.createElement('a');
          anchor.href = url;
          anchor.download = `finance-control-export-${new Date().toISOString().slice(0, 10)}.json`;
          anchor.click();
          URL.revokeObjectURL(url);
          this.exportForm.reset();
          this.exportMessage.set('Exportação concluída.');
        },
        error: (error: unknown) => this.exportMessage.set(
          this.errorDetail(error, 'Não foi possível exportar os dados.'),
        ),
      });
  }

  protected deleteAccount(): void {
    this.deletionMessage.set(null);
    if (this.deletionForm.invalid || !this.deletionEligibility()?.canDelete) {
      this.deletionForm.markAllAsTouched();
      return;
    }

    this.isDeleting.set(true);
    this.api.deleteAccount(this.deletionForm.getRawValue())
      .pipe(finalize(() => this.isDeleting.set(false)))
      .subscribe({
        next: () => {
          this.profileState.clear();
          this.auth.clearSession();
          void this.router.navigate(['/login'], { queryParams: { accountDeleted: 'true' } });
        },
        error: (error: unknown) => {
          this.deletionMessage.set(this.errorDetail(
            error,
            'Não foi possível excluir a conta. Verifique as pendências e tente novamente.',
          ));
          this.loadDeletionEligibility();
        },
      });
  }

  protected loadDeletionEligibility(): void {
    this.isCheckingDeletion.set(true);
    this.api.getAccountDeletionEligibility()
      .pipe(finalize(() => this.isCheckingDeletion.set(false)))
      .subscribe({
        next: (eligibility) => this.deletionEligibility.set(eligibility),
        error: () => this.deletionMessage.set(
          'Não foi possível verificar as pendências para exclusão.',
        ),
      });
  }

  private errorDetail(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      const problem = error.error as Partial<ProblemDetails> | null;
      return problem?.detail ?? fallback;
    }
    return fallback;
  }
}
