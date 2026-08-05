import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { LoginResponse } from './auth.models';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let httpTesting: HttpTestingController;
  const response: LoginResponse = {
    accessToken: 'signed-jwt',
    tokenType: 'Bearer',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    user: { id: 'user-id', email: 'demo@financecontrol.local', displayName: 'Conta demo' },
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    service.clearSession();
    httpTesting.verify();
  });

  it('keeps the access token only in memory after login', () => {
    service.login({ email: 'demo@financecontrol.local', password: 'ChangeMe123!' }).subscribe();
    const request = httpTesting.expectOne('/api/v1/auth/login');
    expect(request.request.method).toBe('POST');
    request.flush(response);

    expect(service.isAuthenticated()).toBe(true);
    expect(service.accessToken()).toBe('signed-jwt');
    expect(service.userEmail()).toBe('demo@financecontrol.local');
    expect(window.localStorage?.getItem('finance-control.session') ?? null).toBeNull();
  });

  it('restores the session through the refresh cookie', async () => {
    const initialization = service.initialize();
    const request = httpTesting.expectOne('/api/v1/auth/refresh');
    expect(request.request.method).toBe('POST');
    request.flush(response);
    await initialization;
    expect(service.isAuthenticated()).toBe(true);
  });

  it('registers without creating a session before email confirmation', () => {
    service.register({
      displayName: 'Nova conta',
      email: 'new@example.com',
      password: 'NewPassword123!',
    }).subscribe();
    const request = httpTesting.expectOne('/api/v1/auth/register');
    expect(request.request.method).toBe('POST');
    request.flush({ email: 'new@example.com', message: 'Check your email.' });
    expect(service.isAuthenticated()).toBe(false);
  });

  it('confirms email through the public confirmation endpoint', () => {
    service.confirmEmail({ userId: 'user-id', token: 'encoded-token' }).subscribe();
    const request = httpTesting.expectOne('/api/v1/auth/confirm-email');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ userId: 'user-id', token: 'encoded-token' });
    request.flush(null);
  });

  it('continues anonymously when no refresh session exists', async () => {
    const initialization = service.initialize();
    httpTesting.expectOne('/api/v1/auth/refresh').flush({}, { status: 401, statusText: 'Unauthorized' });
    await initialization;
    expect(service.isAuthenticated()).toBe(false);
  });

  it('calls server logout and clears memory', () => {
    service.login({ email: 'demo@financecontrol.local', password: 'ChangeMe123!' }).subscribe();
    httpTesting.expectOne('/api/v1/auth/login').flush(response);
    service.logout().subscribe();
    const logout = httpTesting.expectOne('/api/v1/auth/logout');
    logout.flush(null);
    expect(service.isAuthenticated()).toBe(false);
  });
});
