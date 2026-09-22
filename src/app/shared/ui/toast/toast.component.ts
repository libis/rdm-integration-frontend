// Author: Eryk Kulikowski @ KU Leuven (2026). Apache 2.0 License

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService, ToastSeverity } from './toast.service';

const SEVERITY_CLASS: Record<ToastSeverity, string> = {
  error: 'text-bg-danger',
  success: 'text-bg-success',
  warning: 'text-bg-warning',
  info: 'text-bg-info',
};

@Component({
  selector: 'app-toast',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="toast-container position-fixed end-0 p-3 app-toasts"
      aria-live="polite"
      aria-atomic="true"
    >
      @for (toast of toasts.messages(); track toast.id) {
        <div
          [class]="'toast show ' + severityClass(toast.severity)"
          role="alert"
        >
          <div class="d-flex">
            <div class="toast-body">
              <strong>{{ toast.summary }}</strong>
              <div>{{ toast.detail }}</div>
            </div>
            <button
              type="button"
              class="btn-close btn-close-white me-2 m-auto"
              aria-label="Close"
              (click)="toasts.dismiss(toast.id)"
            ></button>
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    /* Positioned below the application header, and above everything in stacking. */
    .app-toasts {
      top: var(--app-header-height);
      z-index: 10000;
    }
  `,
})
export class ToastComponent {
  readonly toasts = inject(ToastService);

  severityClass(severity: ToastSeverity): string {
    return SEVERITY_CLASS[severity];
  }
}
