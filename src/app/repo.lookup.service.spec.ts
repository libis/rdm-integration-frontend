import { TestBed } from '@angular/core/testing';

import { RepoLookupService } from './repo.lookup.service';

describe('BranchLookupService', () => {
  let service: RepoLookupService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RepoLookupService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
