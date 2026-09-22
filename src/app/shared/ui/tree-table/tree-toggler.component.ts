// Author: Eryk Kulikowski @ KU Leuven (2026). Apache 2.0 License

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { TreeNode } from '../../../models/tree-node';

@Component({
  selector: 'app-tree-toggler',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="tt-indent" [style.width.rem]="level() * 1.25"></span>
    @if (expandable()) {
      <button
        type="button"
        class="btn btn-link btn-sm p-0 tt-toggle"
        [attr.aria-expanded]="node().expanded ?? false"
        aria-label="Toggle folder"
        (click)="toggle.emit()"
      >
        <i
          class="pi"
          [class.pi-chevron-down]="node().expanded"
          [class.pi-chevron-right]="!node().expanded"
        ></i>
      </button>
    } @else {
      <span class="tt-toggle"></span>
    }
  `,
  styles: `
    /* Exactly one line tall and aligned to the top of it: a taller box would
       stretch the cell's line and push the file name off the row's centre. */
    :host {
      display: inline-flex;
      align-items: center;
      vertical-align: top;
      height: 1lh;
    }
    .tt-indent {
      display: inline-block;
      flex: none;
    }
    .tt-toggle {
      display: inline-block;
      width: 1.5rem;
      text-align: center;
      text-decoration: none;
    }
  `,
})
export class TreeTogglerComponent<T = unknown> {
  readonly node = input.required<TreeNode<T>>();
  readonly level = input(0);
  readonly toggle = output<void>();
  readonly expandable = computed(() => (this.node().children?.length ?? 0) > 0);
}
