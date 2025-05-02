// Author: Eryk Kulikowski @ KU Leuven (2024). Apache 2.0 License

import { Component, Input, OnInit } from '@angular/core';
import { TreeNode } from 'primeng/api';
import { Field, Fieldaction } from '../models/field';

@Component({
  selector: 'tr[app-metadatafield]',
  standalone: false,
  templateUrl: './metadatafield.component.html',
  styleUrls: ['./metadatafield.component.scss']
})
export class MetadatafieldComponent implements OnInit {

  @Input("field") field: Field = {};
  @Input("rowNodeMap") rowNodeMap: Map<string, TreeNode<Field>> = new Map<string, TreeNode<Field>>();
  @Input("rowNode") rowNode: TreeNode<Field> = {};


  static icon_ignore = "pi pi-stop";
  static icon_copy = "pi pi-check-square";
  static icon_custom = "pi pi-exclamation-triangle";

  constructor() { }

  ngOnInit(): void {
  }

  action(): string {
    return MetadatafieldComponent.actionIcon(this.rowNode);
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

  sourceFile(): string {
    return `${this.field.name}`;
  }

  toggleAction(): void {
    MetadatafieldComponent.toggleNodeAction(this.rowNode);
    this.updateFolderActions(this.rowNodeMap.get("")!);
  }

  updateFolderActions(node: TreeNode<Field>): Fieldaction {
    if (node.children && node.children.length > 0) {
      let res: Fieldaction | undefined = undefined;
      for (const child of node.children) {
        const childAction = this.updateFolderActions(child)
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

  private static setNodeAction(node: TreeNode<Field>, action: Fieldaction): void {
    node.data!.action = action;
    node.children?.forEach(v => this.setNodeAction(v, action));
  }
}
