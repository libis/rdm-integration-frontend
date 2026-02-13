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
import { Datafile } from './models/datafile';
import { SubmitService, TransferTaskStatus } from './submit.service';

class MockCredentialsService {
  credentials: any = {
    plugin: 'p1',
    pluginId: 'p1id',
    repo_name: 'repoX',
    url: 'http://repo',
    option: 'optA',
    user: 'u1',
    token: 'tok',
    dataset_id: 'doi:10/ABC',
    dataverse_token: 'dvTok',
  };
}

describe('SubmitService', () => {
  let service: SubmitService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: CredentialsService, useClass: MockCredentialsService },
      ],
    });
    service = TestBed.inject(SubmitService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('submit builds correct payload', () => {
    const selected: Datafile[] = [
      { id: '1', name: 'f1', path: '/', hidden: false } as any,
    ];
    service.submit(selected, true).subscribe();
    const req = httpMock.expectOne('api/common/store');
    expect(req.request.method).toBe('POST');
    const body: any = req.request.body;
    expect(body.plugin).toBe('p1');
    expect(body.streamParams.pluginId).toBe('p1id');
    expect(body.streamParams.repoName).toBe('repoX');
    expect(body.streamParams.option).toBe('optA');
    expect(body.streamParams.user).toBe('u1');
    expect(body.streamParams.token).toBe('tok');
    expect(body.persistentId).toBe('doi:10/ABC');
    expect(body.dataverseKey).toBe('dvTok');
    expect(body.selectedNodes.length).toBe(1);
    expect(body.sendEmailOnSuccess).toBeTrue();
    req.flush({ status: 'ok' });
  });

  it('download builds correct payload', () => {
    const selected: Datafile[] = [
      { id: '2', name: 'f2', path: '/', hidden: false } as any,
    ];
    let response: any;
    service
      .download(
        selected,
        'endpointX',
        'optionB',
        'gTok',
        'pidX',
        'dv2',
        'dl123',
      )
      .subscribe((res) => (response = res));
    const req = httpMock.expectOne('api/common/download');
    expect(req.request.method).toBe('POST');
    const body: any = req.request.body;
    expect(body.plugin).toBe('globus');
    expect(body.streamParams.pluginId).toBe('globus');
    expect(body.streamParams.repoName).toBe('endpointX');
    expect(body.streamParams.option).toBe('optionB');
    expect(body.streamParams.token).toBe('gTok');
    expect(body.streamParams.downloadId).toBe('dl123');
    expect(body.persistentId).toBe('pidX');
    expect(body.dataverseKey).toBe('dv2');
    expect(body.selectedNodes.length).toBe(1);
    req.flush({
      taskId: 'task-1',
      monitorUrl: 'https://app.globus.org/activity/task-1',
    });
    expect(response.taskId).toBe('task-1');
  });

  it('getGlobusTransferStatus fetches globus transfer status', () => {
    let status: TransferTaskStatus | undefined;
    service.getGlobusTransferStatus('task-42').subscribe((s) => (status = s));
    const req = httpMock.expectOne(
      (r) =>
        r.url === 'api/common/globus/status' &&
        r.params.get('taskId') === 'task-42',
    );
    expect(req.request.method).toBe('GET');
    req.flush({ task_id: 'task-42', status: 'ACTIVE', nice_status: 'Active' });
    expect(status?.status).toBe('ACTIVE');
  });
});
