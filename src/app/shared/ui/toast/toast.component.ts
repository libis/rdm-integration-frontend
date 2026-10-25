// Author: Eryk Kulikowski @ KU Leuven (2026). Apache 2.0 License

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService, ToastSeverity } from './toast.service';

const SEVERITY_CLASS: Record<ToastSeverity, string> = {
  error: 'text-bg-danger',
  success: 'text-bg-success',
  warning: 'text-bg-warning',
  info: 'text-bg-info',
};

// The danger and success backgrounds are dark and take a white X; warning and info are light
// and keep the black one.
const WHITE_CLOSE: Record<ToastSeverity, boolean> = {
  error: true,
  success: true,
  warning: false,
  info: false,
};

// The container is the live region and is there before the first toast, since screen readers
// announce changes inside an existing region only. Each toast is read as one unit: errors as
// assertive alerts, the other severities as polite status messages. A toast stays while the
// pointer is over it or the focus is in it.
@Component({
  selector: 'app-toast',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="toast-container position-fixed end-0 p-3 app-toasts"
      aria-live="polite"
    >
      @for (toast of toasts.messages(); track toast.id) {
        <div
          #toastEl
          [class]="'toast show ' + severityClass(toast.severity)"
          [attr.role]="toast.severity === 'error' ? 'alert' : 'status'"
          [attr.aria-live]="toast.severity === 'error' ? 'assertive' : 'polite'"
          aria-atomic="true"
          (mouseenter)="toasts.hold(toast.id, 'hover')"
          (mouseleave)="toasts.release(toast.id, 'hover')"
          (focusin)="toasts.hold(toast.id, 'focus')"
          (focusout)="onFocusOut($event, toastEl, toast.id)"
        >
          <div class="d-flex">
            <div class="toast-body">
              <strong>{{ toast.summary }}</strong>
              <div>{{ toast.detail }}</div>
            </div>
            <button
              type="button"
              class="btn-close me-2 m-auto"
              [class.btn-close-white]="whiteClose(toast.severity)"
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

    /* Bootstrap's dark mode puts the white X filter on every .btn-close, so the black X of
       warning and info is set on the button itself. At 75 percent opacity (100 on hover and
       focus) either X has at least 3:1 against its toast. */
    .app-toasts .btn-close {
      --bs-btn-close-opacity: 0.75;
      --bs-btn-close-hover-opacity: 1;
    }
    .app-toasts .btn-close:not(.btn-close-white) {
      --bs-btn-close-filter: none;
    }
  `,
})
export class ToastComponent {
  readonly toasts = inject(ToastService);

  severityClass(severity: ToastSeverity): string {
    return SEVERITY_CLASS[severity];
  }

  whiteClose(severity: ToastSeverity): boolean {
    return WHITE_CLOSE[severity];
  }

  // Focus moving between the toast's own elements keeps it held.
  onFocusOut(event: FocusEvent, toast: HTMLElement, id: number): void {
    if (toast.contains(event.relatedTarget as Node | null)) return;
    this.toasts.release(id, 'focus');
  }
}
