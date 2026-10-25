import { TestBed } from '@angular/core/testing';
import { ToastComponent } from './toast.component';
import { ToastService } from './toast.service';

describe('ToastService and ToastComponent', () => {
  beforeEach(async () => {
    jasmine.clock().install();
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
