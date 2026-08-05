import { computed, inject, Injectable, signal } from '@angular/core';
import { catchError, finalize, Observable, of, tap } from 'rxjs';

import { FinanceControlApiService } from '../api/finance-control-api.service';
import { UserProfileResponse } from '../api/api.models';
import { AuthService } from '../auth/auth.service';
import { ThemeService } from '../theme/theme.service';

@Injectable({ providedIn: 'root' })
export class UserProfileStateService {
  private readonly api = inject(FinanceControlApiService);
  private readonly auth = inject(AuthService);
  private readonly theme = inject(ThemeService);
  private readonly profileState = signal<UserProfileResponse | null>(null);
  private readonly avatarObjectUrlState = signal<string | null>(null);
  private readonly loadingState = signal(false);

  readonly profile = this.profileState.asReadonly();
  readonly avatarObjectUrl = this.avatarObjectUrlState.asReadonly();
  readonly isLoading = this.loadingState.asReadonly();
  readonly initials = computed(() => {
    const name = this.profileState()?.displayName ?? this.auth.userDisplayName();
    const parts = name.trim().split(/\s+/).filter(Boolean);
    return (parts.length > 1 ? `${parts[0][0]}${parts.at(-1)![0]}` : name.slice(0, 2)).toUpperCase();
  });

  load(): void {
    if (this.loadingState()) return;
    this.loadingState.set(true);
    this.api.getCurrentUser().pipe(finalize(() => this.loadingState.set(false))).subscribe({
      next: (profile) => this.apply(profile),
    });
  }

  apply(profile: UserProfileResponse): void {
    this.profileState.set(profile);
    this.auth.updateCurrentUser(profile.displayName, profile.email);
    this.theme.setPreference(profile.preferences.theme);
    this.refreshAvatar(profile.avatarUrl !== null);
  }

  refreshAvatar(hasAvatar = this.profileState()?.avatarUrl !== null): void {
    if (!hasAvatar) {
      this.replaceAvatarUrl(null);
      return;
    }

    this.api.getAvatar().pipe(catchError((): Observable<Blob | null> => of(null))).subscribe({
      next: (blob) => this.replaceAvatarUrl(blob ? URL.createObjectURL(blob) : null),
    });
  }

  clear(): void {
    this.profileState.set(null);
    this.replaceAvatarUrl(null);
  }

  private replaceAvatarUrl(url: string | null): void {
    const previous = this.avatarObjectUrlState();
    if (previous) URL.revokeObjectURL(previous);
    this.avatarObjectUrlState.set(url);
  }
}
