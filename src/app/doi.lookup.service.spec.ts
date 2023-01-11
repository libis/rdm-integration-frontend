import { TestBed } from '@angular/core/testing';

import { DoiLookupService } from './dvobject.lookup.service';

describe('DoiLookupService', () => {
  let service: DoiLookupService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DoiLookupService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
