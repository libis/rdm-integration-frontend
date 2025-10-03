import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import {
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { DataStateService } from './data.state.service';
import { DataService } from './data.service';
import { UtilsService } from './utils.service';
import { NotificationService } from './shared/notification.service';
import { CredentialsService } from './credentials.service';
import { Credentials } from './models/credentials';

class MockDataService {
  key$ = of({ key: 'k1' });
  cached$ = new Subject<any>();
  getData() {
    return this.key$;
  }
  getCachedData() {
    return this.cached$.asObservable();
  }
}
class MockUtilsService {
  sleep(ms: number) {
    return Promise.resolve();
  }
}
class MockNotification {
  errors: string[] = [];
  showError(m: string) {
    this.errors.push(m);
  }
}
class MockRouter {
  navigated: any[] = [];
  navigate(a: any) {
    this.navigated.push(a);
  }
}

describe('DataStateService', () => {
  let service: DataStateService;
  let data: MockDataService;
  let router: MockRouter;
  let notify: MockNotification;
  let creds: CredentialsService;

  beforeEach(() => {
    data = new MockDataService();
    router = new MockRouter();
    notify = new MockNotification();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: DataService, useValue: data },
        { provide: UtilsService, useClass: MockUtilsService },
        { provide: NotificationService, useValue: notify },
        { provide: Router, useValue: router },
      ],
    });
    service = TestBed.inject(DataStateService);
    creds = TestBed.inject(CredentialsService);
  });

  function init(credsIn?: Partial<Credentials>) {
    service.initializeState({
      plugin: 'git',
      pluginId: 'git',
      repo_name: 'r',
      user: 'u',
      url: '',
      dataset_id: 'doi:123',
      dataverse_token: 'tok',
      ...credsIn,
    });
  }

  it('initializes and polls until ready true then stores result', fakeAsync(() => {
    init();
    data.cached$.next({ ready: false });
    data.cached$.next({
      ready: true,
      res: {
        data: [
          { id: 'b', name: 'b', path: '', hidden: false },
          { id: 'a', name: 'a', path: '', hidden: false },
        ],
      },
    });
    tick();
    const v = service.getCurrentValue();
    expect(v?.data?.map((f) => f.id)).toEqual(['a', 'b']);
  }));

  it('handles ready true with error message', fakeAsync(() => {
    init();
    data.cached$.next({ ready: true, res: { data: [] }, err: 'boom' });
    tick();
    expect(notify.errors.some((e) => e.includes('boom'))).toBeTrue();
  }));

  it('handles getData error and navigates', fakeAsync(() => {
    data.getData = () => throwError(() => ({ error: 'x' })) as any;
    init();
    tick();
    expect(notify.errors.length).toBe(1);
    expect(router.navigated[0]).toEqual(['/connect']);
  }));

  it('handles cached error and navigates', fakeAsync(() => {
    init();
    data.getCachedData = () => throwError(() => ({ error: 'y' }));
    (service as any).getCompareData({ key: 'k2' });
    tick();
    expect(
      notify.errors.some((e) => e.includes('Comparing failed')),
    ).toBeTrue();
    expect(router.navigated.some((n) => n[0] === '/connect')).toBeTrue();
  }));

  it('updateState and resetState manipulate current value', () => {
    service.updateState({ data: [] });
    expect(service.getCurrentValue()).not.toBeNull();
    service.resetState();
    expect(service.getCurrentValue()).toBeNull();
  });
});
