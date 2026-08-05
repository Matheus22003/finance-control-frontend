import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';

import { AuthService } from './auth.service';

const PUBLIC_AUTH_ENDPOINTS = [
  '/api/v1/auth/login',
  '/api/v1/auth/register',
  '/api/v1/auth/refresh',
  '/api/v1/auth/confirm-email',
  '/api/v1/auth/confirm-email-change',
  '/api/v1/auth/resend-confirmation',
  '/api/v1/auth/forgot-password',
  '/api/v1/auth/reset-password',
];

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const isApi = request.url.startsWith('/api/');
  const isPublicAuth = PUBLIC_AUTH_ENDPOINTS.some((endpoint) => request.url.startsWith(endpoint));
  const token = auth.accessToken();
  const outgoing = isApi && !isPublicAuth && token
    ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : request;

  return next(outgoing).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401 || !isApi || isPublicAuth) {
        return throwError(() => error);
      }

      return auth.refreshAccessToken().pipe(
        switchMap((session) => next(request.clone({
          setHeaders: { Authorization: `Bearer ${session.accessToken}` },
        }))),
        catchError((refreshError: unknown) => {
          auth.clearSession();
          void router.navigate(['/login']);
          return throwError(() => refreshError);
        }),
      );
    }),
  );
};
