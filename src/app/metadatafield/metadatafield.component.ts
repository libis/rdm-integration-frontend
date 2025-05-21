// Author: Eryk Kulikowski @ KU Leuven (2024). Apache 2.0 License

import { Component, Input, OnInit } from '@angular/core';
import { TreeNode } from 'primeng/api';
import { Field, Fieldaction } from '../models/field';
import { TreeTableModule } from 'primeng/treetable';
import { ButtonDirective } from 'primeng/button';
import { Ripple } from 'primeng/ripple';

@Component({
  selector: 'tr[app-metadatafield]',
  templateUrl: './metadatafield.component.html',
  styleUrls: ['./metadatafield.component.scss'],
  imports: [TreeTableModule, ButtonDirective, Ripple],
})
export class MetadatafieldComponent implements OnInit {
  @Input('field') field: Field = {};
  @Input('rowNodeMap') rowNodeMap: Map<string, TreeNode<Field>> = new Map<
    string,
    TreeNode<Field>
  >();
  @Input('rowNode') rowNode: TreeNode<Field> = {};

  static icon_ignore = 'pi pi-stop';
  static icon_copy = 'pi pi-check-square';
  static icon_custom = 'pi pi-exclamation-triangle';

  node: TreeNode<Field> = {};

  constructor() {}

  ngOnInit(): void {
    const foundNode = [...this.rowNodeMap.values()].find(
      (x) => x.data?.id === this.field.id,
    );
    this.node = foundNode ? foundNode : this.rowNode;
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
    return `${this.field.name}`;
  }

  value(): string {
    return this.field.leafValue ? `${this.field.leafValue}` : '';
  }

  toggleAction(): void {
    MetadatafieldComponent.toggleNodeAction(this.node);
    this.updateFolderActions(this.rowNodeMap.get('')!);
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
}
