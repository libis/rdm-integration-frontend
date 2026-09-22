import { TestBed } from '@angular/core/testing';
import { NotificationService } from './notification.service';
import { ToastService } from './ui/toast/toast.service';

describe('NotificationService', () => {
  let service: NotificationService;
  let toasts: ToastService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(NotificationService);
    toasts = TestBed.inject(ToastService);
  });

  it('publishes success/info/warning notifications', () => {
    service.showSuccess('ok');
    service.showInfo('info');
    service.showWarning('warn');

    expect(toasts.messages()).toEqual([
      jasmine.objectContaining({
        severity: 'success',
        summary: 'Success',
        detail: 'ok',
        life: 4000,
      }),
      jasmine.objectContaining({
        severity: 'info',
        summary: 'Info',
        detail: 'info',
        life: 4000,
      }),
      jasmine.objectContaining({
        severity: 'warning',
        summary: 'Warning',
        detail: 'warn',
        life: 6000,
      }),
    ]);
  });

  it('handles plain error object with error field', () => {
    service.handleHttpError({ error: 'boom' }, 'CTX');
    expect(toasts.messages()).toEqual([
      jasmine.objectContaining({
        severity: 'error',
        summary: 'Error',
        detail: 'CTX: boom',
        life: 8000,
      }),
    ]);
  });

  it('handles error with message', () => {
    service.handleHttpError({ message: 'msg' });
    expect(toasts.messages()).toEqual([
      jasmine.objectContaining({ severity: 'error', detail: 'msg' }),
    ]);
  });

  it('handles unknown error', () => {
    service.handleHttpError('strange');
    expect(toasts.messages()).toEqual([
      jasmine.objectContaining({
        severity: 'error',
        detail: 'An unexpected error occurred',
      }),
    ]);
  });
});
