import { Routes } from '@angular/router';

import { authGuard, anonymousGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [anonymousGuard],
    loadComponent: () =>
      import('./features/auth/login/login.page').then((module) => module.LoginPage),
    title: 'Entrar | Finance Control',
  },
  {
    path: 'register',
    canActivate: [anonymousGuard],
    loadComponent: () =>
      import('./features/auth/register/register.page').then((module) => module.RegisterPage),
    title: 'Criar conta | Finance Control',
  },
  {
    path: 'confirm-email',
    loadComponent: () =>
      import('./features/auth/confirm-email/confirm-email.page').then(
        (module) => module.ConfirmEmailPage,
      ),
    title: 'Confirmar e-mail | Finance Control',
  },
  {
    path: 'confirm-email-change',
    loadComponent: () =>
      import('./features/auth/confirm-email-change/confirm-email-change.page').then(
        (module) => module.ConfirmEmailChangePage,
      ),
    title: 'Confirmar novo e-mail | Finance Control',
  },
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./features/auth/forgot-password/forgot-password.page').then(
        (module) => module.ForgotPasswordPage,
      ),
    title: 'Recuperar senha | Finance Control',
  },
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./features/auth/reset-password/reset-password.page').then(
        (module) => module.ResetPasswordPage,
      ),
    title: 'Nova senha | Finance Control',
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./layout/app-shell/app-shell.component').then((module) => module.AppShellComponent),
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.page').then((module) => module.DashboardPage),
        title: 'Visão geral | Finance Control',
      },
      {
        path: 'finance',
        loadComponent: () =>
          import('./features/finance/finance.page').then((module) => module.FinancePage),
        title: 'Finanças | Finance Control',
      },
      {
        path: 'debts',
        loadComponent: () =>
          import('./features/debts/debts.page').then((module) => module.DebtsPage),
        title: 'Dívidas | Finance Control',
      },
      {
        path: 'social',
        loadComponent: () =>
          import('./features/social/social.page').then((module) => module.SocialPage),
        title: 'Amigos e grupos | Finance Control',
      },
      {
        path: 'people',
        loadComponent: () =>
          import('./features/people/people.page').then((module) => module.PeoplePage),
        title: 'Pessoas | Finance Control',
      },
      {
        path: 'account',
        loadComponent: () =>
          import('./features/account/account.page').then((module) => module.AccountPage),
        title: 'Minha conta | Finance Control',
      },
      {
        path: 'security',
        loadComponent: () =>
          import('./features/security/security.page').then((module) => module.SecurityPage),
        title: 'Segurança | Finance Control',
      },
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
    ],
  },
  { path: '**', redirectTo: '' },
];
