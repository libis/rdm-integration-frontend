import { Injectable, inject } from '@angular/core';
import { MessageService } from 'primeng/api';

/**
 * Service for handling errors and user notifications.
 */
@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private readonly messageService = inject(MessageService, { optional: true });

  showError(message: string): void {
    if (this.messageService) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: message,
        life: 8000,
      });
      return;
    }
    // eslint-disable-next-line no-restricted-syntax
    alert(message);
  }

  showSuccess(message: string): void {
    if (this.messageService) {
      this.messageService.add({
        severity: 'success',
        summary: 'Success',
        detail: message,
        life: 4000,
      });
      return;
    }
    void message;
  }

  showInfo(message: string): void {
    if (this.messageService) {
      this.messageService.add({
        severity: 'info',
        summary: 'Info',
        detail: message,
        life: 4000,
      });
      return;
    }
    void message;
  }

  showWarning(message: string): void {
    if (this.messageService) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Warning',
        detail: message,
        life: 6000,
      });
      return;
    }
    void message;
  }

  /**
   * Handle HTTP errors with user-friendly messages.
   */
  handleHttpError(error: unknown, context?: string): void {
    let message = 'An unexpected error occurred';

    if (error && typeof error === 'object' && 'error' in error) {
      message = String(error.error);
    } else if (error && typeof error === 'object' && 'message' in error) {
      message = String(error.message);
    }

    if (context) {
      message = `${context}: ${message}`;
    }

    this.showError(message);
  }
}
