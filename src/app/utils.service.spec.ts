import { TestBed } from '@angular/core/testing';
import { UtilsService } from './utils.service';
import { Datafile, Fileaction } from './models/datafile';

describe('UtilsService', () => {
  let service: UtilsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(UtilsService);
  });

  it('sleep waits roughly specified ms', async () => {
    const start = Date.now();
    await service.sleep(5);
    expect(Date.now() - start).toBeGreaterThanOrEqual(5);
  });

  it('mapDatafiles builds hierarchical folder nodes and addChild attaches children', () => {
    const files: Datafile[] = [
      {
        id: 'a.txt',
        path: 'dir1',
        name: 'a.txt',
        action: Fileaction.Ignore,
        hidden: false,
      },
      {
        id: 'b.txt',
        path: 'dir1/dir2',
        name: 'b.txt',
        action: Fileaction.Ignore,
        hidden: false,
      },
    ];
    const map = service.mapDatafiles(files);
    // ensure folder nodes created
    expect(map.has('dir1')).toBeTrue();
    expect(map.has('dir1/dir2')).toBeTrue();
    // attach children
    map.forEach((v) => service.addChild(v, map));
    const root = map.get('');
    expect(root?.children?.some((c) => c.data?.id === 'dir1')).toBeTrue();
  });

  it('buildFileTree adds every node to its parent and returns the root children', () => {
    const mapDatafiles = spyOn(service, 'mapDatafiles').and.callThrough();
    const addChild = spyOn(service, 'addChild').and.callThrough();
    const files: Datafile[] = [
      { id: 'top.txt', path: '', name: 'top.txt', action: Fileaction.Ignore },
      { id: 'a.txt', path: 'dir1', name: 'a.txt', action: Fileaction.Ignore },
      {
        id: 'b.txt',
        path: 'dir1/dir2',
        name: 'b.txt',
        action: Fileaction.Ignore,
      },
    ];
    const { rowNodeMap, rootChildren } = service.buildFileTree(files);
    expect(mapDatafiles).toHaveBeenCalledOnceWith(files);
    expect(addChild).toHaveBeenCalledTimes(rowNodeMap.size);
    expect(rootChildren).toBe(rowNodeMap.get('')!.children!);
    expect(rootChildren!.map((n) => n.data?.id)).toEqual(['top.txt', 'dir1']);
    const dir2 = rowNodeMap.get('dir1/dir2')!;
    expect(dir2.parent).toBe(rowNodeMap.get('dir1'));
    expect(rowNodeMap.get('b.txt:file')!.parent).toBe(dir2);
  });

  it('buildFileTree of an empty list is the root without children', () => {
    const { rowNodeMap, rootChildren } = service.buildFileTree([]);
    expect(Array.from(rowNodeMap.keys())).toEqual(['']);
    expect(rootChildren).toEqual([]);
  });
});
