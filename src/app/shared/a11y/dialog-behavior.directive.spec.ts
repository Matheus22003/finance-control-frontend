import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DialogBehaviorDirective } from './dialog-behavior.directive';

@Component({
  imports: [DialogBehaviorDirective],
  template: `
    <button id="opener" type="button">Abrir</button>
    @if (open()) {
      <section appDialogBehavior (appDialogDismiss)="close()">
        <button id="close" type="button" autofocus>Fechar</button>
        <button id="last" type="button">Última ação</button>
      </section>
    }
  `,
})
class DialogHostComponent {
  readonly open = signal(false);

  close(): void {
    this.open.set(false);
  }
}

describe('DialogBehaviorDirective', () => {
  let fixture: ComponentFixture<DialogHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [DialogHostComponent] }).compileComponents();
    fixture = TestBed.createComponent(DialogHostComponent);
    fixture.detectChanges();
  });

  async function openDialog(): Promise<HTMLElement> {
    const host = fixture.nativeElement as HTMLElement;
    const opener = host.querySelector<HTMLButtonElement>('#opener')!;
    opener.focus();
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    return host.querySelector<HTMLElement>('[appDialogBehavior]')!;
  }

  it('moves focus to the autofocus control and restores it after dismissal', async () => {
    const dialog = await openDialog();
    expect(document.activeElement).toBe(dialog.querySelector('#close'));

    dialog.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(document.activeElement).toBe(
      (fixture.nativeElement as HTMLElement).querySelector('#opener'),
    );
  });

  it('cycles keyboard focus inside the dialog', async () => {
    const dialog = await openDialog();
    const first = dialog.querySelector<HTMLButtonElement>('#close')!;
    const last = dialog.querySelector<HTMLButtonElement>('#last')!;

    last.focus();
    last.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Tab' }));
    expect(document.activeElement).toBe(first);

    first.focus();
    first.dispatchEvent(
      new KeyboardEvent('keydown', { bubbles: true, key: 'Tab', shiftKey: true }),
    );
    expect(document.activeElement).toBe(last);
  });
});
