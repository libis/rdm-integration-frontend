import { Injectable } from '@angular/core';

/**
 * Service for handling errors and user notifications
 */
@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  /**
   * Show an error message to the user
   * TODO: Replace with proper notification system (e.g., toast, snackbar)
   */
  showError(message: string): void {
    // eslint-disable-next-line no-restricted-syntax
    alert(message); // Temporary implementation
  }

  /**
   * Show a success message to the user
   * TODO: Replace with proper notification system
   */
  showSuccess(message: string): void {
    void message;
    // Could implement toast notifications here
  }

  /**
   * Show an info message to the user
   * TODO: Replace with proper notification system
   */
  showInfo(message: string): void {
    void message;
    // Could implement toast notifications here
  }

  /**
   * Show a warning message to the user
   * TODO: Replace with proper notification system
   */
  showWarning(message: string): void {
    void message;
    // Could implement toast notifications here
  }

  /**
   * Handle HTTP errors with user-friendly messages
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
