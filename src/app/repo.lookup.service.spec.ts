import {
    provideHttpClient,
    withInterceptorsFromDi,
} from '@angular/common/http';
import {
    HttpTestingController,
    provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { SelectItem } from 'primeng/api';
import { RepoLookupRequest } from './models/repo-lookup';
import { RepoLookupService } from './repo.lookup.service';

describe('RepoLookupService', () => {
  let service: RepoLookupService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(RepoLookupService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should call getOptions and return options', () => {
    const req: RepoLookupRequest = {
      pluginId: 'github',
      plugin: 'github',
      user: 'testuser',
      token: 'test-token',
      repoName: 'test/repo',
    };
    const mockResponse: SelectItem<string>[] = [
      { label: 'main', value: 'main' },
      { label: 'develop', value: 'develop' },
    ];

    service.getOptions(req).subscribe((response) => {
      expect(response).toEqual(mockResponse);
      expect(response.length).toBe(2);
      expect(response[0].label).toBe('main');
    });

    const httpReq = httpMock.expectOne('api/plugin/options');
    expect(httpReq.request.method).toBe('POST');
    expect(httpReq.request.body).toEqual(req);
    httpReq.flush(mockResponse);
  });

  it('should call search and return search results', () => {
    const req: RepoLookupRequest = {
      pluginId: 'github',
      plugin: 'github',
      user: 'testuser',
      token: 'test-token',
      option: 'repositories',
    };
    const mockResponse: SelectItem<string>[] = [
      { label: 'test-repo-1', value: 'owner/test-repo-1' },
      { label: 'test-repo-2', value: 'owner/test-repo-2' },
    ];

    service.search(req).subscribe((response) => {
      expect(response).toEqual(mockResponse);
      expect(response.length).toBe(2);
      expect(response[0].value).toBe('owner/test-repo-1');
    });

    const httpReq = httpMock.expectOne('api/plugin/search');
    expect(httpReq.request.method).toBe('POST');
    expect(httpReq.request.body).toEqual(req);
    httpReq.flush(mockResponse);
  });
});
