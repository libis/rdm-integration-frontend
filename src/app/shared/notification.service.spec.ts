import { TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  let service: NotificationService;
  let messageService: jasmine.SpyObj<MessageService>;

  beforeEach(() => {
    messageService = jasmine.createSpyObj<MessageService>('MessageService', [
      'add',
    ]);
    TestBed.configureTestingModule({
      providers: [{ provide: MessageService, useValue: messageService }],
    });
    service = TestBed.inject(NotificationService);
  });

  it('publishes success/info/warning notifications', () => {
    service.showSuccess('ok');
    service.showInfo('info');
    service.showWarning('warn');

    expect(messageService.add).toHaveBeenCalledWith(
      jasmine.objectContaining({ severity: 'success', detail: 'ok' }),
    );
    expect(messageService.add).toHaveBeenCalledWith(
      jasmine.objectContaining({ severity: 'info', detail: 'info' }),
    );
    expect(messageService.add).toHaveBeenCalledWith(
      jasmine.objectContaining({ severity: 'warn', detail: 'warn' }),
    );
  });

  it('handles plain error object with error field', () => {
    service.handleHttpError({ error: 'boom' }, 'CTX');
    expect(messageService.add).toHaveBeenCalledWith(
      jasmine.objectContaining({ severity: 'error', detail: 'CTX: boom' }),
    );
  });

  it('handles error with message', () => {
    service.handleHttpError({ message: 'msg' });
    expect(messageService.add).toHaveBeenCalledWith(
      jasmine.objectContaining({ severity: 'error', detail: 'msg' }),
    );
  });

  it('handles unknown error', () => {
    service.handleHttpError('strange');
    expect(messageService.add).toHaveBeenCalledWith(
      jasmine.objectContaining({
        severity: 'error',
        detail: 'An unexpected error occurred',
      }),
    );
  });
});

describe('NotificationService without MessageService', () => {
  let service: NotificationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(NotificationService);
  });

  it('showError falls back to alert', () => {
    const alertSpy = spyOn(window, 'alert');
    service.showError('boom');
    expect(alertSpy).toHaveBeenCalledWith('boom');
  });

  it('showSuccess/showInfo/showWarning do not throw', () => {
    expect(() => service.showSuccess('ok')).not.toThrow();
    expect(() => service.showInfo('info')).not.toThrow();
    expect(() => service.showWarning('warn')).not.toThrow();
  });
});
