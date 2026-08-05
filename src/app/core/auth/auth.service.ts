import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { catchError, finalize, Observable, of, shareReplay, tap } from 'rxjs';

import {
  ChangePasswordRequest,
  ConfirmEmailRequest,
  ConfirmEmailChangeRequest,
  DeviceSession,
  LoginRequest,
  LoginResponse,
  RegistrationResponse,
  RegisterRequest,
  ResetPasswordRequest,
} from './auth.models';

const LEGACY_SESSION_KEY = 'finance-control.session';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly sessionState = signal<LoginResponse | null>(null);
  private refreshRequest?: Observable<LoginResponse>;
  private refreshTimer: ReturnType<typeof setTimeout> | undefined;

  readonly session = this.sessionState.asReadonly();
  readonly isAuthenticated = computed(() => this.sessionState() !== null);
  readonly userEmail = computed(() => this.sessionState()?.user.email ?? '');
  readonly userDisplayName = computed(() => this.sessionState()?.user.displayName ?? 'Minha conta');

  constructor() {
    window.localStorage?.removeItem(LEGACY_SESSION_KEY);
    window.sessionStorage?.removeItem(LEGACY_SESSION_KEY);
  }

  initialize(): Promise<void> {
    return new Promise((resolve) => {
      this.refreshAccessToken().pipe(catchError(() => of(null))).subscribe({ complete: resolve });
    });
  }

  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>('/api/v1/auth/login', credentials).pipe(
      tap((session) => this.setSession(session)),
    );
  }

  register(request: RegisterRequest): Observable<RegistrationResponse> {
    return this.http.post<RegistrationResponse>('/api/v1/auth/register', request);
  }

  confirmEmail(request: ConfirmEmailRequest): Observable<void> {
    return this.http.post<void>('/api/v1/auth/confirm-email', request);
  }

  confirmEmailChange(request: ConfirmEmailChangeRequest): Observable<void> {
    return this.http.post<void>('/api/v1/auth/confirm-email-change', request).pipe(
      tap(() => this.clearSession()),
    );
  }

  resendConfirmation(email: string): Observable<void> {
    return this.http.post<void>('/api/v1/auth/resend-confirmation', { email });
  }

  forgotPassword(email: string): Observable<void> {
    return this.http.post<void>('/api/v1/auth/forgot-password', { email });
  }

  resetPassword(request: ResetPasswordRequest): Observable<void> {
    return this.http.post<void>('/api/v1/auth/reset-password', request);
  }

  changePassword(request: ChangePasswordRequest): Observable<void> {
    return this.http.post<void>('/api/v1/auth/change-password', request).pipe(
      tap(() => this.clearSession()),
    );
  }

  refreshAccessToken(): Observable<LoginResponse> {
    if (!this.refreshRequest) {
      this.refreshRequest = this.http.post<LoginResponse>('/api/v1/auth/refresh', {}).pipe(
        tap((session) => this.setSession(session)),
        finalize(() => (this.refreshRequest = undefined)),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    }
    return this.refreshRequest;
  }

  logout(): Observable<void> {
    return this.http.post<void>('/api/v1/auth/logout', {}).pipe(
      finalize(() => this.clearSession()),
    );
  }

  clearSession(): void {
    this.sessionState.set(null);
    this.clearRefreshTimer();
  }

  accessToken(): string | null {
    const session = this.sessionState();
    if (!session || new Date(session.expiresAt).getTime() <= Date.now()) return null;
    return session.accessToken;
  }

  updateCurrentUser(displayName: string, email?: string): void {
    this.sessionState.update((session) => session
      ? {
          ...session,
          user: {
            ...session.user,
            displayName,
            email: email ?? session.user.email,
          },
        }
      : null);
  }

  listSessions(): Observable<DeviceSession[]> {
    return this.http.get<DeviceSession[]>('/api/v1/auth/sessions');
  }

  revokeSession(id: string): Observable<void> {
    return this.http.delete<void>(`/api/v1/auth/sessions/${id}`);
  }

  private setSession(session: LoginResponse): void {
    this.sessionState.set(session);
    this.clearRefreshTimer();
    const refreshIn = new Date(session.expiresAt).getTime() - Date.now() - 30_000;
    this.refreshTimer = setTimeout(
      () => this.refreshAccessToken().pipe(catchError(() => of(null))).subscribe(),
      Math.max(1_000, Math.min(refreshIn, 2_147_483_647)),
    );
  }

  private clearRefreshTimer(): void {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.refreshTimer = undefined;
  }
}
