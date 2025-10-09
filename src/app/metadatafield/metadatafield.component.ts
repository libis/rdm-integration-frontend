// Author: Eryk Kulikowski @ KU Leuven (2024). Apache 2.0 License

import { Component, OnInit, input } from '@angular/core';
import { TreeNode } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
import { TreeTableModule } from 'primeng/treetable';
import { Field, Fieldaction } from '../models/field';
import { FileActionStyle, getFileActionStyle } from '../shared/constants';

@Component({
  selector: 'tr[app-metadatafield]',
  templateUrl: './metadatafield.component.html',
  styleUrls: ['./metadatafield.component.scss'],
  imports: [TreeTableModule, ButtonDirective],
  exportAs: 'appMetadatafield',
})
export class MetadatafieldComponent implements OnInit {
  readonly field = input<Field>({});
  readonly rowNodeMap = input<Map<string, TreeNode<Field>>>(
    new Map<string, TreeNode<Field>>(),
  );
  readonly rowNode = input<TreeNode<Field>>({});

  static icon_ignore = 'pi pi-stop';
  static icon_copy = 'pi pi-check-square';
  static icon_custom = 'pi pi-exclamation-triangle';

  node: TreeNode<Field> = {};

  constructor() {}

  ngOnInit(): void {
    const foundNode = [...this.rowNodeMap().values()].find(
      (x) => x.data?.id === this.field().id,
    );
    this.node = foundNode ? foundNode : this.rowNode();
  }

  action(): string {
    return MetadatafieldComponent.actionIcon(this.node);
  }

  public static actionIcon(node: TreeNode<Field>): string {
    switch (node.data?.action) {
      case Fieldaction.Ignore:
        return this.icon_ignore;
      case Fieldaction.Copy:
        return this.icon_copy;
      case Fieldaction.Custom:
        return this.icon_custom;
      default:
        return this.icon_ignore;
    }
  }

  name(): string {
    return `${this.field().name}`;
  }

  value(): string {
    const field = this.field();
    return field.leafValue ? `${field.leafValue}` : '';
  }

  source(): string {
    const f = this.node?.data?.field;
    // When the node is a leaf, field is a MetadataField and may carry `source`.
    // When it's a compound, it's a FieldDictionary and we don't show a source at this row level.
    // A safer check: if it has a 'value' and 'typeName', it's a MetadataField.
    const maybe = f as { typeName?: string; value?: unknown; source?: string };
    if (maybe && maybe.typeName !== undefined && maybe.value !== undefined) {
      return maybe.source ?? '';
    }
    // Fallback for compound rows: derive source from the first leaf child that has a source
    const derived = this.firstLeafSource(this.node);
    return derived ?? '';
  }

  private firstLeafSource(node?: TreeNode<Field>): string | undefined {
    if (!node) return undefined;
    // If this node is a leaf with a MetadataField, return its source if present
    const f = node.data?.field as
      | { typeName?: string; value?: unknown; source?: string }
      | undefined;
    if (f && f.typeName !== undefined && f.value !== undefined && f.source) {
      return f.source;
    }
    // Otherwise search children depth-first
    if (node.children && node.children.length > 0) {
      for (const ch of node.children) {
        const s = this.firstLeafSource(ch);
        if (s) return s;
      }
    }
    return undefined;
  }

  toggleAction(): void {
    MetadatafieldComponent.toggleNodeAction(this.node);
    this.updateFolderActions(this.rowNodeMap().get('')!);
  }

  updateFolderActions(node: TreeNode<Field>): Fieldaction {
    if (node.children && node.children.length > 0) {
      let res: Fieldaction | undefined = undefined;
      for (const child of node.children) {
        const childAction = this.updateFolderActions(child);
        if (res !== undefined && res !== childAction) {
          res = Fieldaction.Custom;
        } else if (res === undefined) {
          res = childAction;
        }
      }
      if (node.data) {
        node.data.action = res;
      }
      return res ? res : Fieldaction.Ignore;
    } else {
      return node.data?.action ? node.data.action : Fieldaction.Ignore;
    }
  }

  public static toggleNodeAction(node: TreeNode<Field>): void {
    switch (node.data?.action) {
      case Fieldaction.Ignore:
        MetadatafieldComponent.setNodeAction(node, Fieldaction.Copy);
        break;
      case Fieldaction.Copy:
        MetadatafieldComponent.setNodeAction(node, Fieldaction.Ignore);
        break;
      default:
        MetadatafieldComponent.setNodeAction(node, Fieldaction.Ignore);
        break;
    }
  }

  private static setNodeAction(
    node: TreeNode<Field>,
    action: Fieldaction,
  ): void {
    node.data!.action = action;
    node.children?.forEach((v) => this.setNodeAction(v, action));
  }

  private resolveHostStyle(): FileActionStyle {
    const action = this.field().action ?? Fieldaction.Ignore;
    switch (action) {
      case Fieldaction.Copy:
        return getFileActionStyle('COPY');
      case Fieldaction.Custom:
        return getFileActionStyle('CUSTOM');
      default:
        return getFileActionStyle('IGNORE');
    }
  }

  getStyle(): string {
    const style = this.resolveHostStyle();
    const declarations: string[] = [];
    if (style.backgroundColor) {
      declarations.push(`background-color: ${style.backgroundColor}`);
    }
    if (style.color) {
      declarations.push(`color: ${style.color}`);
    }
    return declarations.length ? `${declarations.join('; ')};` : '';
  }
}
