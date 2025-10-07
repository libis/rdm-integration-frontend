import { TestBed } from '@angular/core/testing';
import { FolderActionUpdateService } from './folder.action.update.service';
import { TreeNode } from 'primeng/api';
import { Datafile, Fileaction, Filestatus } from './models/datafile';

describe('FolderActionUpdateService', () => {
  let service: FolderActionUpdateService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FolderActionUpdateService);
  });

  function node(action: Fileaction, status: Filestatus): TreeNode<Datafile> {
    return {
      data: {
        id: `${status}:${action}`,
        name: '',
        path: '',
        hidden: false,
        action,
        status,
      },
    } as TreeNode<Datafile>;
  }

  it('aggregates all equal -> Ignore', () => {
    const root: TreeNode<Datafile> = {
      data: { id: 'root', name: '', path: '', hidden: false },
      children: [
        node(Fileaction.Ignore, Filestatus.Equal),
        node(Fileaction.Ignore, Filestatus.Equal),
      ],
    };
    service.doUpdateFoldersAction(root);
    expect(root.data?.action).toBe(Fileaction.Ignore);
  });

  it('aggregates all deleted -> Delete', () => {
    const root: TreeNode<Datafile> = {
      data: { id: 'root', name: '', path: '', hidden: false },
      children: [
        node(Fileaction.Delete, Filestatus.Deleted),
        node(Fileaction.Delete, Filestatus.Deleted),
      ],
    };
    service.doUpdateFoldersAction(root);
    expect(root.data?.action).toBe(Fileaction.Delete);
  });

  it('aggregates matching status/action pairs -> Update', () => {
    const root: TreeNode<Datafile> = {
      data: { id: 'root', name: '', path: '', hidden: false },
      children: [
        node(Fileaction.Copy, Filestatus.New),
        node(Fileaction.Ignore, Filestatus.Equal),
      ],
    };
    service.doUpdateFoldersAction(root);
    expect(root.data?.action).toBe(Fileaction.Update);
  });

  it('updateFoldersAction clears folder actions then computes', () => {
    const map = new Map<string, TreeNode<Datafile>>();
    // root folder
    map.set('', {
      data: { id: '', name: '', path: '', hidden: false },
      children: [],
    });
    // file nodes with isFile attribute so they retain action
    const file1: TreeNode<Datafile> = {
      data: {
        id: 'f1',
        name: 'f1',
        path: '',
        hidden: false,
        action: Fileaction.Copy,
        status: Filestatus.New,
        attributes: { isFile: true },
      },
    };
    const file2: TreeNode<Datafile> = {
      data: {
        id: 'f2',
        name: 'f2',
        path: '',
        hidden: false,
        action: Fileaction.Ignore,
        status: Filestatus.Equal,
        attributes: { isFile: true },
      },
    };
    map.get('')!.children = [file1, file2];
    service.updateFoldersAction(map);
    expect(map.get('')!.data!.action).toBe(Fileaction.Update);
  });
});
