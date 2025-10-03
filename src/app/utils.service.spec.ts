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
});
