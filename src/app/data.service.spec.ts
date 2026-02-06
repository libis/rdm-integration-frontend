import {
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { CredentialsService } from './credentials.service';
import { DataService } from './data.service';
import { ComputeRequest, Key } from './models/compare-result';

describe('DataService', () => {
  let service: DataService;
  let httpMock: HttpTestingController;
  let credentialsService: CredentialsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(DataService);
    httpMock = TestBed.inject(HttpTestingController);
    credentialsService = TestBed.inject(CredentialsService);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should call getData with credentials', () => {
    credentialsService.setCredentials({
      pluginId: 'test-plugin',
      plugin: 'github',
      repo_name: 'test/repo',
      url: 'https://test.com',
      option: 'branch',
      user: 'testuser',
      token: 'test-token',
      dataset_id: 'doi:123',
      newly_created: false,
      dataverse_token: 'dv-token',
    });

    const mockResponse: Key = { key: 'test-key-123' };

    service.getData().subscribe((response) => {
      expect(response).toEqual(mockResponse);
    });

    const req = httpMock.expectOne('api/plugin/compare');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.pluginId).toBe('test-plugin');
    expect(req.request.body.plugin).toBe('github');
    req.flush(mockResponse);
  });

  it('should call getCachedData', () => {
    const key: Key = { key: 'test-key' };
    const mockResponse = { key: 'test-key', ready: true, res: {} };

    service.getCachedData(key).subscribe((response) => {
      expect(response.key).toBe('test-key');
      expect(response.ready).toBe(true);
    });

    const req = httpMock.expectOne('api/common/cached');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(key);
    req.flush(mockResponse);
  });

  it('should call getExecutableFiles', () => {
    const pid = 'doi:123';
    const token = 'dv-token';
    const mockResponse = { id: '1', data: [] };

    service.getExecutableFiles(pid, token).subscribe((response) => {
      expect(response.id).toBe('1');
      expect(response.data).toEqual([]);
    });

    const req = httpMock.expectOne('api/common/executable');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.persistentId).toBe(pid);
    expect(req.request.body.dataverseKey).toBe(token);
    req.flush(mockResponse);
  });

  it('should call checkAccessToQueue', () => {
    const pid = 'doi:123';
    const token = 'dv-token';
    const queue = 'compute-queue';
    const mockResponse = { access: true, message: 'Access granted' };

    service.checkAccessToQueue(pid, token, queue).subscribe((response) => {
      expect(response.access).toBe(true);
      expect(response.message).toBe('Access granted');
    });

    const req = httpMock.expectOne('api/common/checkaccess');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.persistentId).toBe(pid);
    expect(req.request.body.dataverseKey).toBe(token);
    expect(req.request.body.queue).toBe(queue);
    req.flush(mockResponse);
  });

  it('should call compute', () => {
    const computeReq: ComputeRequest = {
      persistentId: 'doi:123',
      dataverseKey: 'dv-token',
      queue: 'test-queue',
      executable: 'test-script.sh',
      sendEmailOnSuccess: true,
    };
    const mockResponse: Key = { key: 'compute-key' };

    service.compute(computeReq).subscribe((response) => {
      expect(response).toEqual(mockResponse);
    });

    const req = httpMock.expectOne('api/common/compute');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(computeReq);
    req.flush(mockResponse);
  });

  it('should call getCachedComputeData', () => {
    const key: Key = { key: 'compute-key' };
    const mockResponse = { key: 'compute-key', ready: true, res: 'result' };

    service.getCachedComputeData(key).subscribe((response) => {
      expect(response.key).toBe('compute-key');
      expect(response.ready).toBe(true);
      expect(response.res).toBe('result');
    });

    const req = httpMock.expectOne('api/common/cachedcompute');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(key);
    req.flush(mockResponse);
  });

  it('should call getDownloadableFiles', () => {
    const pid = 'doi:123';
    const token = 'dv-token';
    const mockResponse = { id: '2', data: [] };

    service.getDownloadableFiles(pid, token).subscribe((response) => {
      expect(response.id).toBe('2');
      expect(response.data).toEqual([]);
    });

    const req = httpMock.expectOne('api/common/downloadable');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.persistentId).toBe(pid);
    expect(req.request.body.dataverseKey).toBe(token);
    req.flush(mockResponse);
  });
});
