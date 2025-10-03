import { FolderStatusService } from './folder-status.service';
import { Filestatus, Datafile } from '../models/datafile';
import { TreeNode } from 'primeng/api';

describe('FolderStatusService', () => {
  let service: FolderStatusService;
  beforeEach(() => {
    service = new FolderStatusService();
  });

  function node(
    data: Partial<Datafile>,
    children?: TreeNode<Datafile>[],
  ): TreeNode<Datafile> {
    return { data: data as Datafile, children } as TreeNode<Datafile>;
  }

  it('aggregates to Equal when all children Equal', () => {
    const root = node({}, [
      node({ status: Filestatus.Equal }),
      node({ status: Filestatus.Equal }),
    ]);
    service.updateTreeRoot(root);
    expect(root.data!.status).toBe(Filestatus.Equal);
  });

  it('aggregates to Deleted when all children Deleted', () => {
    const root = node({}, [
      node({ status: Filestatus.Deleted }),
      node({ status: Filestatus.Deleted }),
    ]);
    service.updateTreeRoot(root);
    expect(root.data!.status).toBe(Filestatus.Deleted);
  });

  it('aggregates to New when all children New', () => {
    const root = node({}, [
      node({ status: Filestatus.New }),
      node({ status: Filestatus.New }),
    ]);
    service.updateTreeRoot(root);
    expect(root.data!.status).toBe(Filestatus.New);
  });

  it('aggregates to Unknown if any Unknown', () => {
    const root = node({}, [
      node({ status: Filestatus.Equal }),
      node({ status: Filestatus.Unknown }),
    ]);
    service.updateTreeRoot(root);
    expect(root.data!.status).toBe(Filestatus.Unknown);
  });

  it('aggregates to Updated for mixed statuses', () => {
    const root = node({}, [
      node({ status: Filestatus.Equal }),
      node({ status: Filestatus.New }),
    ]);
    service.updateTreeRoot(root);
    expect(root.data!.status).toBe(Filestatus.Updated);
  });
});
