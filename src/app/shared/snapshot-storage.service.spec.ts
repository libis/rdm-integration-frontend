import { TestBed } from '@angular/core/testing';
import {
  SnapshotStorageService,
  ConnectSnapshot,
} from './snapshot-storage.service';

describe('SnapshotStorageService', () => {
  let service: SnapshotStorageService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SnapshotStorageService);
    sessionStorage.clear();
  });

  it('saves and loads a snapshot', () => {
    const snap: ConnectSnapshot = {
      dataset_id: 'doi:10.123/ABC',
      plugin: 'git',
      pluginId: 'github',
    };
    service.saveConnect(snap);
    const loaded = service.loadConnect();
    expect(loaded).toEqual(snap);
  });

  it('merges snapshot fields', () => {
    service.saveConnect({ dataset_id: 'old', plugin: 'git' });
    service.mergeConnect({ dataset_id: 'new', user: 'alice' });
    const loaded = service.loadConnect();
    expect(loaded?.dataset_id).toBe('new');
    expect(loaded?.plugin).toBe('git');
    expect(loaded?.user).toBe('alice');
  });

  it('clears snapshot', () => {
    service.saveConnect({ dataset_id: 'to-clear' });
    service.clearConnect();
    expect(service.loadConnect()).toBeUndefined();
  });
});
