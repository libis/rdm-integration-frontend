import {
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DvObjectLookupService } from './dvobject.lookup.service';

describe('DvObjectLookupService', () => {
  let service: DvObjectLookupService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(DvObjectLookupService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('issues POST request with full parameter set', () => {
    let response: any;
    service
      .getItems('root', 'Dataset', 'term', 'token-123')
      .subscribe((r) => (response = r));

    const req = http.expectOne('api/common/dvobjects');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      token: 'token-123',
      collectionId: 'root',
      objectType: 'Dataset',
      searchTerm: 'term',
    });

    req.flush([{ label: 'Dataset', value: 'doi:1' }]);
    expect(response).toEqual([{ label: 'Dataset', value: 'doi:1' }]);
  });

  it('omits optional fields when not provided', () => {
    service.getItems('root', 'Collection').subscribe();

    const req = http.expectOne('api/common/dvobjects');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      token: undefined,
      collectionId: 'root',
      objectType: 'Collection',
      searchTerm: undefined,
    });

    req.flush([]);
  });
});
