import { TestBed } from '@angular/core/testing';

import { FolderActionUpdateService } from './folder.action.update.service';

describe('FolderActionUpdateService', () => {
  let service: FolderActionUpdateService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FolderActionUpdateService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
