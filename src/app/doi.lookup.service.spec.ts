import { TestBed } from '@angular/core/testing';

import { DvObjectLookupService } from './dvobject.lookup.service';

describe('DoiLookupService', () => {
  let service: DvObjectLookupService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DvObjectLookupService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
