import { TestBed } from '@angular/core/testing';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  let service: NotificationService;
  let alerts: string[] = [];
  let consoleErrors: string[] = [];
  let consoleLogs: string[] = [];
  let consoleWarnings: string[] = [];

  beforeEach(() => {
    alerts = [];
    consoleErrors = [];
    consoleLogs = [];
    consoleWarnings = [];
    spyOn(window, 'alert').and.callFake((m: string) => alerts.push(m));
    spyOn(console, 'error').and.callFake((...m: unknown[]) =>
      consoleErrors.push(m.join(' ')),
    );
    spyOn(console, 'log').and.callFake((...m: unknown[]) =>
      consoleLogs.push(m.join(' ')),
    );
    spyOn(console, 'warn').and.callFake((...m: unknown[]) =>
      consoleWarnings.push(m.join(' ')),
    );
    TestBed.configureTestingModule({});
    service = TestBed.inject(NotificationService);
  });

  it('shows success/info/warning', () => {
    service.showSuccess('ok');
    service.showInfo('info');
    service.showWarning('warn');
    expect(consoleLogs.some((l) => l.includes('ok'))).toBeTrue();
    expect(consoleLogs.some((l) => l.includes('info'))).toBeTrue();
    expect(consoleWarnings.some((l) => l.includes('warn'))).toBeTrue();
  });

  it('handles plain error object with error field', () => {
    service.handleHttpError({ error: 'boom' }, 'CTX');
    expect(alerts[0]).toContain('CTX: boom');
  });

  it('handles error with message', () => {
    service.handleHttpError({ message: 'msg' });
    expect(alerts[0]).toContain('msg');
  });

  it('handles unknown error', () => {
    service.handleHttpError('strange');
    expect(alerts[0]).toContain('unexpected');
  });
});
