import { Injectable } from '@angular/core';
import { TreeNode } from 'primeng/api';
import { Datafile, Fileaction } from './models/datafile';

@Injectable({
  providedIn: 'root'
})

export class UtilsService {

  constructor() { /*NOOP*/ }

  sleep(ms: number): Promise<void> {
    return new Promise<void>(f => setTimeout(f, ms));
  }

  addChild(v: TreeNode<Datafile>, rowDataMap: Map<string, TreeNode<Datafile>>): void {
    if (v.data!.id === "") {
      return;
    }
    const parent = rowDataMap.get(v.data!.path!)!;
    const children = parent.children ? parent.children : [];
    parent.children = children.concat(v);
  }

  mapDatafiles(data: Datafile[]): Map<string, TreeNode<Datafile>> {
    const rootData: Datafile = {
      path: "",
      name: "",
      action: Fileaction.Ignore,
      hidden: false,
      id: "",
    }

    const rowDataMap: Map<string, TreeNode<Datafile>> = new Map<string, TreeNode<Datafile>>();
    rowDataMap.set("", {
      data: rootData,
    });

    data.forEach((d) => {
      let path = "";
      d.path!.split("/").forEach((folder) => {
        const id = path != "" ? path + "/" + folder : folder;
        const folderData: Datafile = {
          path: path,
          name: folder,
          action: Fileaction.Ignore,
          hidden: false,
          id: id,
        }
        rowDataMap.set(id, {
          data: folderData,
        });
        path = id;
      });
      rowDataMap.set(d.id! + ":file", { // avoid collisions between folders and files having the same path and name
        data: d,
      });
    });
    return rowDataMap;
  }
}
