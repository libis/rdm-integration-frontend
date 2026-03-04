import { Injectable } from '@angular/core';
import { TreeNode } from 'primeng/api';
import { Datafile, Fileaction } from './models/datafile';

@Injectable({
  providedIn: 'root',
})
export class UtilsService {
  constructor() {
    /*NOOP*/
  }

  sleep(ms: number): Promise<void> {
    return new Promise<void>((f) => setTimeout(f, ms));
  }

  addChild(
    v: TreeNode<Datafile>,
    rowDataMap: Map<string, TreeNode<Datafile>>,
  ): void {
    if (v.data!.id === '') {
      return;
    }
    const parentKey =
      v.data?.path
        ?.split('/')
        .map((segment) => segment.trim())
        .filter((segment) => segment.length > 0)
        .join('/') ?? '';
    const parent = rowDataMap.get(parentKey)!;
    if (!parent.children) {
      parent.children = [];
    }
    parent.children.push(v);
    v.parent = parent;
  }

  mapDatafiles(data: Datafile[]): Map<string, TreeNode<Datafile>> {
    const rootData: Datafile = {
      path: '',
      name: '',
      action: Fileaction.Ignore,
      hidden: false,
      id: '',
    };

    const rowDataMap: Map<string, TreeNode<Datafile>> = new Map<
      string,
      TreeNode<Datafile>
    >();
    rowDataMap.set('', {
      data: rootData,
      children: [],
    });

    data.forEach((d) => {
      let path = '';
      const folders =
        d.path
          ?.split('/')
          .map((folder) => folder.trim())
          .filter((folder) => folder.length > 0) ?? [];
      folders.forEach((folder) => {
        const id = path != '' ? `${path}/${folder}` : folder;
        if (!rowDataMap.has(id)) {
          const folderData: Datafile = {
            path: path,
            name: folder,
            action: Fileaction.Ignore,
            hidden: false,
            id: id,
          };
          rowDataMap.set(id, {
            data: folderData,
            children: [],
          });
        }
        path = id;
      });
      rowDataMap.set(`${d.id!}:file`, {
        // avoid collisions between folders and files having the same path and name
        data: d,
      });
    });
    return rowDataMap;
  }
}
