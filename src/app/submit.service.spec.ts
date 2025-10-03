import { TestBed } from '@angular/core/testing';
import { SubmitService } from './submit.service';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { CredentialsService } from './credentials.service';
import { Datafile } from './models/datafile';

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
      imports: [HttpClientTestingModule],
      providers: [
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
      .subscribe();
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
    req.flush('ok');
  });
});
