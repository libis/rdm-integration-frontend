import { DOCUMENT } from '@angular/common';
import { inject, Injectable, InjectionToken } from '@angular/core';

export const WINDOW = new InjectionToken<Window>('RDM_WINDOW', {
  factory: () => window,
});

@Injectable({ providedIn: 'root' })
export class NavigationService {
  private readonly document = inject(DOCUMENT);
  private readonly defaultWindow = inject(WINDOW);

  assign(url: string): void {
    const targetWindow = this.document?.defaultView ?? this.defaultWindow;
    targetWindow.location.assign(url);
  }
}
