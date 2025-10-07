import { TestBed } from '@angular/core/testing';
import {
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { DataUpdatesService } from './data.updates.service';
import { CredentialsService } from './credentials.service';

describe('DataUpdatesService', () => {
  let service: DataUpdatesService;
  let http: HttpTestingController;
  let creds: CredentialsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(DataUpdatesService);
    http = TestBed.inject(HttpTestingController);
    creds = TestBed.inject(CredentialsService);
    creds.credentials = { dataverse_token: 'tok' };
  });

  it('updateData sorts result data by id', (done) => {
    service
      .updateData(
        [
          { id: 'b', name: 'b', path: '', hidden: false },
          { id: 'a', name: 'a', path: '', hidden: false },
        ] as any,
        'doi:123',
      )
      .subscribe((r) => {
        expect(r.data?.map((f) => f.id)).toEqual(['a', 'b']);
        done();
      });
    const req = http.expectOne('api/common/compare');
    req.flush({
      data: [
        { id: 'b', name: 'b', path: '', hidden: false },
        { id: 'a', name: 'a', path: '', hidden: false },
      ],
    });
  });

  it('updateData handles missing response data without crashing', (done) => {
    service.updateData([], 'doi:456').subscribe((r) => {
      expect(r.data).toBeUndefined();
      done();
    });
    const req = http.expectOne('api/common/compare');
    req.flush({});
  });

  it('updateData sorts undefined ids deterministically', (done) => {
    service
      .updateData(
        [
          { id: undefined, name: 'b', path: '', hidden: false },
          { id: 'a', name: 'a', path: '', hidden: false },
        ] as any,
        'doi:789',
      )
      .subscribe((r) => {
        expect(r.data?.map((f) => f.id ?? '')).toEqual(['', 'a']);
        done();
      });
    const req = http.expectOne('api/common/compare');
    req.flush({
      data: [
        { id: undefined, name: 'b', path: '', hidden: false },
        { id: 'a', name: 'a', path: '', hidden: false },
      ],
    });
  });
});
