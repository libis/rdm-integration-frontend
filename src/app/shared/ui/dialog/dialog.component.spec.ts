import { OverlayContainer } from '@angular/cdk/overlay';
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

// Two dialogs inside a scrolling page host, as on the pages that fit the window.
@Component({
  imports: [DialogComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="page-host" style="height: 100px; overflow-y: auto">
      <div style="height: 400px">Rows</div>
      <app-dialog header="First" [(visible)]="first"><p>One</p></app-dialog>
      <app-dialog header="Second" [(visible)]="second"><p>Two</p></app-dialog>
    </div>
  `,
})
class ScrollingHostComponent {
  readonly first = signal(false);
  readonly second = signal(false);
}

// A page host whose only inline overflow is overflow-x: hidden, which makes it
// scroll vertically (the other axis computes to auto).
@Component({
  imports: [DialogComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="page-host" style="height: 100px; overflow-x: hidden">
      <div style="height: 400px">Rows</div>
      <app-dialog header="Only" [(visible)]="open"><p>One</p></app-dialog>
    </div>
  `,
})
class OverflowXHostComponent {
  readonly open = signal(false);
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

  describe('behind an open dialog', () => {
    const overflowY = (el: Element) => getComputedStyle(el).overflowY;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [ScrollingHostComponent, OverflowXHostComponent],
      }).compileComponents();
    });

    it('stops the page and the scrolling page host and puts them back on close', async () => {
      const fixture = TestBed.createComponent(ScrollingHostComponent);
      await fixture.whenStable();
      const host = fixture.nativeElement.querySelector(
        '.page-host',
      ) as HTMLElement;
      host.scrollTop = 50;
      const width = host.clientWidth;
      const pageWidth = document.body.getBoundingClientRect().width;
      // ChromeHeadless draws classic scrollbars, so the gutters below are real.
      expect(host.offsetWidth - width).toBeGreaterThan(0);
      const bodyBefore = overflowY(document.body);
      expect(overflowY(host)).toBe('auto');

      fixture.componentInstance.first.set(true);
      await fixture.whenStable();
      expect(overflowY(document.body)).toBe('hidden');
      expect(overflowY(host)).toBe('hidden');
      expect(document.body.classList).toContain('app-dialog-open');
      // Where the host showed a scrollbar its gutter stays, so nothing moves.
      expect(host.scrollTop).toBe(50);
      expect(host.clientWidth).toBe(width);
      expect(document.body.getBoundingClientRect().width).toBe(pageWidth);

      fixture.componentInstance.first.set(false);
      await fixture.whenStable();
      expect(overflowY(document.body)).toBe(bodyBefore);
      expect(overflowY(host)).toBe('auto');
      expect(host.clientWidth).toBe(width);
      expect(document.documentElement.getAttribute('style')).toBeNull();
      expect(host.getAttribute('style')).toBe(
        'height: 100px; overflow-y: auto;',
      );
      expect(document.body.classList).not.toContain('app-dialog-open');
    });

    // The restore wrote back the overflow shorthand, which cleared an inline
    // overflow-x set on its own.
    it('puts back an inline overflow-x set on its own, on the host and on the body', async () => {
      document.body.style.overflowX = 'hidden';
      try {
        const fixture = TestBed.createComponent(OverflowXHostComponent);
        await fixture.whenStable();
        const host = fixture.nativeElement.querySelector(
          '.page-host',
        ) as HTMLElement;
        expect(overflowY(host)).toBe('auto');
        fixture.componentInstance.open.set(true);
        await fixture.whenStable();
        expect(overflowY(host)).toBe('hidden');
        expect(overflowY(document.body)).toBe('hidden');
        fixture.componentInstance.open.set(false);
        await fixture.whenStable();
        expect(host.getAttribute('style')).toBe(
          'height: 100px; overflow-x: hidden;',
        );
        expect(overflowY(host)).toBe('auto');
        expect(document.body.style.overflowX).toBe('hidden');
        expect(document.body.style.overflowY).toBe('');
      } finally {
        document.body.style.removeProperty('overflow-x');
        if (document.body.getAttribute('style') === '') {
          document.body.removeAttribute('style');
        }
      }
    });

    it('keeps them stopped until the last open dialog closes', async () => {
      const fixture = TestBed.createComponent(ScrollingHostComponent);
      const host = fixture.nativeElement.querySelector(
        '.page-host',
      ) as HTMLElement;
      fixture.componentInstance.first.set(true);
      await fixture.whenStable();
      fixture.componentInstance.second.set(true);
      await fixture.whenStable();
      fixture.componentInstance.first.set(false);
      await fixture.whenStable();
      expect(overflowY(host)).toBe('hidden');
      expect(overflowY(document.body)).toBe('hidden');
      fixture.componentInstance.second.set(false);
      await fixture.whenStable();
      expect(overflowY(host)).toBe('auto');
      expect(document.body.classList).not.toContain('app-dialog-open');
    });

    it('puts them back when an open dialog is destroyed', async () => {
      const fixture = TestBed.createComponent(ScrollingHostComponent);
      const bodyBefore = overflowY(document.body);
      fixture.componentInstance.first.set(true);
      await fixture.whenStable();
      fixture.destroy();
      expect(overflowY(document.body)).toBe(bodyBefore);
      expect(document.body.classList).not.toContain('app-dialog-open');
    });

    it('raises the CDK overlays above the modal only while a dialog is open', async () => {
      const overlays = TestBed.inject(OverlayContainer).getContainerElement();
      const fixture = TestBed.createComponent(ScrollingHostComponent);
      await fixture.whenStable();
      expect(getComputedStyle(overlays).zIndex).toBe('1000');
      fixture.componentInstance.first.set(true);
      await fixture.whenStable();
      const modal = fixture.nativeElement.querySelector(
        '.modal',
      ) as HTMLElement;
      expect(Number(getComputedStyle(overlays).zIndex)).toBeGreaterThan(
        Number(getComputedStyle(modal).zIndex),
      );
      fixture.componentInstance.first.set(false);
      await fixture.whenStable();
      expect(getComputedStyle(overlays).zIndex).toBe('1000');
    });
  });
});
