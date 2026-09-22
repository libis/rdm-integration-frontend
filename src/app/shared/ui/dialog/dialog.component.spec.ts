import { Component, signal, ChangeDetectionStrategy } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DialogComponent } from './dialog.component';

@Component({
  imports: [DialogComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <app-dialog
      header="Submit"
      [(visible)]="visible"
      [closable]="closable()"
      [position]="position()"
      (hidden)="hidden = hidden + 1"
    >
      <p>Body text</p>
      <div appDialogFooter>
        <button
          type="button"
          class="btn btn-primary"
          (click)="visible.set(false)"
        >
          OK
        </button>
      </div>
    </app-dialog>
  `,
})
class HostComponent {
  readonly visible = signal(false);
  readonly closable = signal(true);
  readonly position = signal<'center' | 'topright'>('center');
  hidden = 0;
}

describe('DialogComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
    }).compileComponents();
  });

  it('renders nothing while hidden and a modal with header, body and footer when visible', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.modal')).toBeNull();
    fixture.componentInstance.visible.set(true);
    await fixture.whenStable();
    const modal = fixture.nativeElement.querySelector('.modal') as HTMLElement;
    expect(modal.querySelector('.modal-title')!.textContent).toContain(
      'Submit',
    );
    expect(modal.querySelector('.modal-body')!.textContent).toContain(
      'Body text',
    );
    expect(modal.querySelector('.modal-footer button')!.textContent).toContain(
      'OK',
    );
  });

  it('moves focus into the dialog when it opens', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.visible.set(true);
    await fixture.whenStable();
    await new Promise<void>((r) => setTimeout(r));
    expect(
      (fixture.nativeElement as HTMLElement).contains(document.activeElement),
    ).toBeTrue();
  });

  it('keeps the top-right close button clickable above the application header', async () => {
    const header = document.createElement('nav');
    header.className = 'dataverse-header-block';
    document.body.prepend(header);
    try {
      const fixture = TestBed.createComponent(HostComponent);
      fixture.componentInstance.position.set('topright');
      fixture.componentInstance.visible.set(true);
      await fixture.whenStable();
      const close = fixture.nativeElement.querySelector(
        '.btn-close',
      ) as HTMLButtonElement;
      const rect = close.getBoundingClientRect();
      const hit = document.elementFromPoint(
        rect.x + rect.width / 2,
        rect.y + rect.height / 2,
      );
      expect(hit).toBe(close);
      (hit as HTMLElement).click();
      await fixture.whenStable();
      expect(fixture.componentInstance.visible()).toBeFalse();
    } finally {
      header.remove();
    }
  });

  it('closes on the close button and on Escape, and emits hidden', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.visible.set(true);
    await fixture.whenStable();
    (
      fixture.nativeElement.querySelector('.btn-close') as HTMLButtonElement
    ).click();
    await fixture.whenStable();
    expect(fixture.componentInstance.visible()).toBeFalse();
    expect(fixture.componentInstance.hidden).toBe(1);
    fixture.componentInstance.visible.set(true);
    await fixture.whenStable();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await fixture.whenStable();
    expect(fixture.componentInstance.visible()).toBeFalse();
  });

  it('has no close button and ignores Escape when not closable', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.closable.set(false);
    fixture.componentInstance.visible.set(true);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.btn-close')).toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await fixture.whenStable();
    expect(fixture.componentInstance.visible()).toBeTrue();
  });
});
