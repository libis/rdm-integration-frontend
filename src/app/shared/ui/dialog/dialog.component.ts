// Author: Eryk Kulikowski @ KU Leuven (2026). Apache 2.0 License

import { CdkTrapFocus } from '@angular/cdk/a11y';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  input,
  model,
  output,
} from '@angular/core';

@Component({
  selector: 'app-dialog',
  templateUrl: './dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CdkTrapFocus],
  host: { '(document:keydown.escape)': 'onEscape()' },
})
export class DialogComponent {
  readonly visible = model(false);
  readonly header = input('');
  readonly closable = input(true);
  readonly position = input<'center' | 'topright'>('center');
  readonly hidden = output<void>();

  constructor() {
    let wasVisible = false;
    effect(() => {
      const now = this.visible();
      if (wasVisible && !now) this.hidden.emit();
      wasVisible = now;
    });
  }

  close(): void {
    if (!this.closable()) return;
    this.visible.set(false);
  }

  onEscape(): void {
    if (this.visible()) this.close();
  }
}
