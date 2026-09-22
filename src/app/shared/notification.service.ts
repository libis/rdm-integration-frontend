import { Injectable, inject } from '@angular/core';
import { ToastService } from './ui/toast/toast.service';

/**
 * Service for handling errors and user notifications.
 */
@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private readonly toasts = inject(ToastService);

  showError(message: string): void {
    this.toasts.show({
      severity: 'error',
      summary: 'Error',
      detail: message,
      life: 8000,
    });
  }

  showSuccess(message: string): void {
    this.toasts.show({
      severity: 'success',
      summary: 'Success',
      detail: message,
      life: 4000,
    });
  }

  showInfo(message: string): void {
    this.toasts.show({
      severity: 'info',
      summary: 'Info',
      detail: message,
      life: 4000,
    });
  }

  showWarning(message: string): void {
    this.toasts.show({
      severity: 'warning',
      summary: 'Warning',
      detail: message,
      life: 6000,
    });
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
