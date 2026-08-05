import { DOCUMENT } from '@angular/common';
import { inject, Injectable, signal } from '@angular/core';

export type ThemePreference = 'light' | 'dark' | 'system';

const THEME_KEY = 'finance-control.theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly mediaQuery =
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-color-scheme: dark)')
      : null;
  private readonly preferenceState = signal<ThemePreference>(this.restorePreference());

  readonly preference = this.preferenceState.asReadonly();

  constructor() {
    this.applyTheme();
    this.mediaQuery?.addEventListener('change', () => {
      if (this.preferenceState() === 'system') {
        this.applyTheme();
      }
    });
  }

  setPreference(preference: ThemePreference): void {
    this.getStorage()?.setItem(THEME_KEY, preference);
    this.preferenceState.set(preference);
    this.applyTheme();
  }

  toggle(): void {
    const activeTheme = this.document.documentElement.dataset['theme'];
    this.setPreference(activeTheme === 'dark' ? 'light' : 'dark');
  }

  private restorePreference(): ThemePreference {
    const preference = this.getStorage()?.getItem(THEME_KEY);
    return preference === 'light' || preference === 'dark' ? preference : 'system';
  }

  private getStorage(): Storage | null {
    try {
      return this.document.defaultView?.localStorage ?? null;
    } catch {
      return null;
    }
  }

  private applyTheme(): void {
    const preference = this.preferenceState();
    const resolvedTheme =
      preference === 'system' ? (this.mediaQuery?.matches ? 'dark' : 'light') : preference;

    this.document.documentElement.dataset['theme'] = resolvedTheme;
    this.document.documentElement.style.colorScheme = resolvedTheme;
  }
}
