import { TestBed } from '@angular/core/testing';
import { ToastComponent } from './toast.component';
import { ToastService } from './toast.service';

describe('ToastService and ToastComponent', () => {
  beforeEach(async () => {
    jasmine.clock().install();
    // The paused toasts keep their remaining life, measured with Date.now().
    jasmine.clock().mockDate(new Date(2026, 9, 25));
    await TestBed.configureTestingModule({
      imports: [ToastComponent],
    }).compileComponents();
  });
  afterEach(() => jasmine.clock().uninstall());

  it('queues a message, renders it with the severity class and removes it after its life', () => {
    const fixture = TestBed.createComponent(ToastComponent);
    const service = TestBed.inject(ToastService);
    service.show({
      severity: 'error',
      summary: 'Error',
      detail: 'boom',
      life: 1000,
    });
    fixture.detectChanges();
    const toast = fixture.nativeElement.querySelector('.toast') as HTMLElement;
    expect(toast.classList).toContain('text-bg-danger');
    expect(toast.textContent).toContain('boom');
    jasmine.clock().tick(1001);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.toast')).toBeNull();
  });

  it('dismisses a message when its close button is clicked', () => {
    const fixture = TestBed.createComponent(ToastComponent);
    TestBed.inject(ToastService).show({
      severity: 'info',
      summary: 'Info',
      detail: 'stay',
      life: 0,
    });
    fixture.detectChanges();
    (
      fixture.nativeElement.querySelector('.btn-close') as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.toast')).toBeNull();
  });

  const showOne = (life: number) => {
    const fixture = TestBed.createComponent(ToastComponent);
    TestBed.inject(ToastService).show({
      severity: 'error',
      summary: 'Error',
      detail: 'read me',
      life,
    });
    fixture.detectChanges();
    const toast = (): HTMLElement | null =>
      fixture.nativeElement.querySelector('.toast');
    const tick = (ms: number) => {
      jasmine.clock().tick(ms);
      fixture.detectChanges();
    };
    return { fixture, toast, tick };
  };

  it('announces errors assertively as alerts and the other severities politely as status', () => {
    const fixture = TestBed.createComponent(ToastComponent);
    const service = TestBed.inject(ToastService);
    for (const severity of ['error', 'success', 'warning', 'info'] as const) {
      service.show({ severity, summary: severity, detail: 'x', life: 0 });
    }
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const container = host.querySelector('.toast-container')!;
    // The live region is there before the first toast, and each toast is read as one unit.
    expect(container.getAttribute('aria-live')).toBe('polite');
    expect(container.hasAttribute('aria-atomic')).toBeFalse();
    const toasts = Array.from(host.querySelectorAll('.toast'));
    expect(
      toasts.map((t) => [
        t.getAttribute('role'),
        t.getAttribute('aria-live'),
        t.getAttribute('aria-atomic'),
      ]),
    ).toEqual([
      ['alert', 'assertive', 'true'],
      ['status', 'polite', 'true'],
      ['status', 'polite', 'true'],
      ['status', 'polite', 'true'],
    ]);
  });

  it('holds the toast while the pointer is over it and keeps the rest of its life after', () => {
    const { toast, tick } = showOne(1000);
    tick(600);
    toast()!.dispatchEvent(new MouseEvent('mouseenter'));
    tick(5000);
    expect(toast()).not.toBeNull();
    toast()!.dispatchEvent(new MouseEvent('mouseleave'));
    tick(399);
    expect(toast()).not.toBeNull();
    tick(2);
    expect(toast()).toBeNull();
  });

  it('holds the toast while the focus is in it and lets it go when the focus leaves', () => {
    const { fixture, toast, tick } = showOne(1000);
    const close = toast()!.querySelector('.btn-close') as HTMLButtonElement;
    tick(300);
    close.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    tick(5000);
    expect(toast()).not.toBeNull();
    // Focus moving within the toast keeps it.
    close.dispatchEvent(
      new FocusEvent('focusout', { bubbles: true, relatedTarget: toast() }),
    );
    tick(5000);
    expect(toast()).not.toBeNull();
    close.dispatchEvent(
      new FocusEvent('focusout', {
        bubbles: true,
        relatedTarget: document.body,
      }),
    );
    tick(699);
    expect(toast()).not.toBeNull();
    tick(2);
    expect(fixture.nativeElement.querySelector('.toast')).toBeNull();
  });

  it('stays while either the pointer or the focus holds it', () => {
    const { toast, tick } = showOne(1000);
    const close = toast()!.querySelector('.btn-close') as HTMLButtonElement;
    toast()!.dispatchEvent(new MouseEvent('mouseenter'));
    close.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    toast()!.dispatchEvent(new MouseEvent('mouseleave'));
    tick(5000);
    expect(toast()).not.toBeNull();
    toast()!.dispatchEvent(new MouseEvent('mouseenter'));
    close.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    tick(5000);
    expect(toast()).not.toBeNull();
    toast()!.dispatchEvent(new MouseEvent('mouseleave'));
    tick(1001);
    expect(toast()).toBeNull();
  });

  it('lets another toast expire on time while one is held', () => {
    const fixture = TestBed.createComponent(ToastComponent);
    const service = TestBed.inject(ToastService);
    service.show({
      severity: 'info',
      summary: 'a',
      detail: 'held',
      life: 1000,
    });
    jasmine.clock().tick(200);
    service.show({
      severity: 'success',
      summary: 'b',
      detail: 'free',
      life: 1000,
    });
    fixture.detectChanges();
    const details = () =>
      Array.from(
        (fixture.nativeElement as HTMLElement).querySelectorAll(
          '.toast-body div',
        ),
      ).map((d) => d.textContent);
    const held = fixture.nativeElement.querySelector('.toast') as HTMLElement;
    jasmine.clock().tick(100);
    held.dispatchEvent(new MouseEvent('mouseenter'));
    // The free toast ends at 1200 ms, its full life after it was shown.
    jasmine.clock().tick(899);
    fixture.detectChanges();
    expect(details()).toEqual(['held', 'free']);
    jasmine.clock().tick(2);
    fixture.detectChanges();
    expect(details()).toEqual(['held']);
    // The held one still has the 700 ms it had left at 300 ms.
    held.dispatchEvent(new MouseEvent('mouseleave'));
    jasmine.clock().tick(699);
    fixture.detectChanges();
    expect(details()).toEqual(['held']);
    jasmine.clock().tick(2);
    fixture.detectChanges();
    expect(details()).toEqual([]);
  });

  it('keeps a toast without a life until it is closed, also after a hover', () => {
    const { toast, tick } = showOne(0);
    toast()!.dispatchEvent(new MouseEvent('mouseenter'));
    toast()!.dispatchEvent(new MouseEvent('mouseleave'));
    tick(60000);
    expect(toast()).not.toBeNull();
  });

  it('cancels the timer of a toast closed by hand', () => {
    const fixture = TestBed.createComponent(ToastComponent);
    const service = TestBed.inject(ToastService);
    service.show({ severity: 'info', summary: 'a', detail: 'a', life: 1000 });
    fixture.detectChanges();
    const dismiss = spyOn(service, 'dismiss').and.callThrough();
    (
      fixture.nativeElement.querySelector('.btn-close') as HTMLButtonElement
    ).click();
    jasmine.clock().tick(2000);
    expect(dismiss).toHaveBeenCalledTimes(1);
  });
});

// The close button draws the SVG's black X, or a white one under the invert filter of
// btn-close-white (and of Bootstrap's dark mode, which sets that filter on every .btn-close),
// at its opacity over the toast background. A control needs 3:1 against what is around it.
describe('ToastComponent close button contrast', () => {
  const channels = (rgb: string): number[] =>
    (rgb.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
  const luminance = (rgb: number[]): number => {
    const [r, g, b] = rgb.map((c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (a: number[], b: number[]): number => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ToastComponent],
    }).compileComponents();
  });
  afterEach(() => document.documentElement.removeAttribute('data-bs-theme'));

  for (const theme of ['light', 'dark']) {
    it(`draws a white X on danger and success and a black one on warning and info, at 3:1 or more, ${theme}`, () => {
      document.documentElement.setAttribute('data-bs-theme', theme);
      const fixture = TestBed.createComponent(ToastComponent);
      const service = TestBed.inject(ToastService);
      const severities = ['error', 'success', 'warning', 'info'] as const;
      for (const severity of severities) {
        service.show({ severity, summary: severity, detail: 'x', life: 0 });
      }
      fixture.detectChanges();
      const toasts = Array.from(
        (fixture.nativeElement as HTMLElement).querySelectorAll('.toast'),
      ) as HTMLElement[];
      expect(toasts.length).toBe(4);
      const white = { error: true, success: true, warning: false, info: false };
      toasts.forEach((toast, i) => {
        const severity = severities[i];
        const close = getComputedStyle(toast.querySelector('.btn-close')!);
        const background = channels(getComputedStyle(toast).backgroundColor);
        const inverted = close.filter.startsWith('invert(1)');
        expect(close.filter)
          .withContext(`${theme} ${severity} filter`)
          .toBe(
            white[severity] ? 'invert(1) grayscale(1) brightness(2)' : 'none',
          );
        expect(inverted)
          .withContext(`${theme} ${severity} white X`)
          .toBe(white[severity]);
        const opacity = Number(close.opacity);
        const x = (inverted ? [255, 255, 255] : [0, 0, 0]).map(
          (c, j) => c * opacity + background[j] * (1 - opacity),
        );
        expect(contrast(x, background))
          .withContext(`${theme} ${severity} contrast`)
          .toBeGreaterThanOrEqual(3);
      });
    });
  }
});
