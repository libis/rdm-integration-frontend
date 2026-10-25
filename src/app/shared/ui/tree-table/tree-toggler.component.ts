// Author: Eryk Kulikowski @ KU Leuven (2026). Apache 2.0 License

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { TreeNode } from '../../../models/tree-node';
import { expansionOf } from './tree-rows';
import { TreeTableComponent } from './tree-table.component';

@Component({
  selector: 'app-tree-toggler',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="tt-indent" [style.width.rem]="level() * 1.25"></span>
    @if (expanded() !== null) {
      <button
        type="button"
        class="btn btn-link btn-sm p-0 tt-toggle"
        [attr.aria-expanded]="expanded()"
        aria-label="Toggle folder"
        (click)="toggle.emit()"
      >
        <i
          class="pi"
          [class.pi-chevron-down]="expanded()"
          [class.pi-chevron-right]="!expanded()"
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
  // The table of the row. A compare row has two togglers and only the clicked
  // one is refreshed by its click: both read the state through the table's
  // signal, so both follow it. Without a table (a row rendered alone) the node
  // is read as it is.
  private readonly table = inject<TreeTableComponent<T>>(TreeTableComponent, {
    optional: true,
  });
  readonly node = input.required<TreeNode<T>>();
  readonly level = input(0);
  readonly toggle = output<void>();
  /** Whether the node is expanded, or null for a node without children. */
  readonly expanded = computed(() =>
    this.table
      ? this.table.expandedState(this.node())
      : expansionOf(this.node()),
  );
}
