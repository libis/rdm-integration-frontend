import { TestBed } from '@angular/core/testing';

import { BranchLookupService } from './branch.lookup.service';

describe('BranchLookupService', () => {
  let service: BranchLookupService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(BranchLookupService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
