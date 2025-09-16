import { TestBed } from '@angular/core/testing';
import {
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { DvObjectLookupService } from './dvobject.lookup.service';

describe('DoiLookupService', () => {
  let service: DvObjectLookupService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(DvObjectLookupService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
