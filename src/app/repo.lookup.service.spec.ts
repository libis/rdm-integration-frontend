import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { RepoLookupService } from './repo.lookup.service';

describe('BranchLookupService', () => {
  let service: RepoLookupService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(RepoLookupService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
