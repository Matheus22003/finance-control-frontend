import {
  afterNextRender,
  Directive,
  ElementRef,
  EventEmitter,
  HostListener,
  OnDestroy,
  Output,
} from '@angular/core';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

@Directive({
  selector: '[appDialogBehavior]',
  standalone: true,
})
export class DialogBehaviorDirective implements OnDestroy {
  @Output('appDialogDismiss') readonly dismiss = new EventEmitter<void>();

  private readonly opener =
    document.activeElement instanceof HTMLElement ? document.activeElement : null;

  constructor(private readonly elementRef: ElementRef<HTMLElement>) {
    afterNextRender(() => this.focusInitialElement());
  }

  @HostListener('keydown', ['$event'])
  protected handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.dismiss.emit();
      return;
    }

    if (event.key === 'Tab') {
      this.trapFocus(event);
    }
  }

  ngOnDestroy(): void {
    if (this.opener?.isConnected && !this.opener.hasAttribute('disabled')) {
      this.opener.focus({ preventScroll: true });
    }
  }

  private focusInitialElement(): void {
    const host = this.elementRef.nativeElement;
    host.tabIndex = -1;

    const autofocus = host.querySelector<HTMLElement>('[autofocus]');
    const target = autofocus ?? this.focusableElements()[0] ?? host;
    target.focus({ preventScroll: true });
  }

  private trapFocus(event: KeyboardEvent): void {
    const host = this.elementRef.nativeElement;
    const elements = this.focusableElements();

    if (elements.length === 0) {
      event.preventDefault();
      host.focus({ preventScroll: true });
      return;
    }

    const first = elements[0];
    const last = elements[elements.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && (active === first || !host.contains(active))) {
      event.preventDefault();
      last.focus({ preventScroll: true });
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus({ preventScroll: true });
    }
  }

  private focusableElements(): HTMLElement[] {
    return Array.from(
      this.elementRef.nativeElement.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    )
      .filter((element) => !element.hasAttribute('hidden'))
      .filter((element) => element.getAttribute('aria-hidden') !== 'true');
  }
}
