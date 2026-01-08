import {
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  tick,
} from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, Subject } from 'rxjs';
import { DataService } from '../data.service';
import { DvObjectLookupService } from '../dvobject.lookup.service';
import { CompareResult, Key } from '../models/compare-result';
import { Datafile, Fileaction, Filestatus } from '../models/datafile';
import { PluginService } from '../plugin.service';
import { NavigationService } from '../shared/navigation.service';
import { NotificationService } from '../shared/notification.service';
import { UtilsService } from '../utils.service';
import { ComputeComponent } from './compute.component';

class MockDataService {
  executableResponse: CompareResult = { data: [] };
  executableError?: string;
  computeError?: unknown;
  computeKey: Key = { key: 'k1' };
  private responses: Subject<any> = new Subject();

  getExecutableFiles(): Observable<CompareResult> {
    return new Observable((observer) => {
      setTimeout(() => {
        if (this.executableError) {
          observer.error({ error: this.executableError });
        } else {
          observer.next(this.executableResponse);
          observer.complete();
        }
      }, 0);
    });
  }

  compute(): Observable<Key> {
    return new Observable((observer) => {
      setTimeout(() => {
        if (this.computeError) {
          observer.error(this.computeError);
        } else {
          observer.next(this.computeKey);
          observer.complete();
        }
      }, 0);
    });
  }

  getCachedComputeData() {
    return this.responses.asObservable();
  }
  emit(res: any) {
    this.responses.next(res);
  }
}
class MockUtilsService {
  sleep(_ms: number) {
    return Promise.resolve();
  }
  mapDatafiles(data: Datafile[]) {
    const map = new Map<string, any>();
    map.set('', { data: { id: '', action: Fileaction.Ignore }, children: [] });
    data.forEach((d) => map.set(`${d.id}:file`, { data: d }));
    return map as any;
  }
  addChild(_v: any, _map: Map<string, any>) {
    /* no-op for test */
  }
}

class MockPluginService {
  showDvToken = false;
  datasetEditable = true;
  mailEnabled = false;

  setConfig() {
    return Promise.resolve();
  }
  showDVToken() {
    return this.showDvToken;
  }
  datasetFieldEditable() {
    return this.datasetEditable;
  }
  sendMails() {
    return this.mailEnabled;
  }
  dataverseHeader() {
    return 'Dataverse:';
  }
}

class MockDvObjectLookupService {
  items: any[] = [];
  error?: string;

  getItems() {
    return new Observable((observer) => {
      setTimeout(() => {
        if (this.error) {
          observer.error({ error: this.error });
        } else {
          observer.next(this.items);
          observer.complete();
        }
      }, 0);
    });
  }
}

class MockNotificationService {
  errors: string[] = [];
  showError(msg: string) {
    this.errors.push(msg);
  }
}

class MockNavigationService {
  assign = jasmine.createSpy('assign');
}

describe('ComputeComponent', () => {
  let component: ComputeComponent;
  let fixture: ComponentFixture<ComputeComponent>;
  let mockData: MockDataService;
  let plugin: MockPluginService;
  let dvLookup: MockDvObjectLookupService;
  let notification: MockNotificationService;
  let navigation: MockNavigationService;

  beforeEach(async () => {
    mockData = new MockDataService();
    plugin = new MockPluginService();
    dvLookup = new MockDvObjectLookupService();
    notification = new MockNotificationService();
    navigation = new MockNavigationService();
    await TestBed.configureTestingModule({
      imports: [ComputeComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: DataService, useValue: mockData },
        { provide: PluginService, useValue: plugin },
        { provide: DvObjectLookupService, useValue: dvLookup },
        { provide: NotificationService, useValue: notification },
        { provide: UtilsService, useClass: MockUtilsService },
        { provide: NavigationService, useValue: navigation },
      ],
    })
      .overrideComponent(ComputeComponent, { set: { template: '<div></div>' } })
      .compileComponents();

    fixture = TestBed.createComponent(ComputeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    navigation.assign.calls.reset();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('onDatasetSearch guards short terms then triggers search', () => {
    component.onDatasetSearch('ab');
    expect(component.doiItems[0].label).toContain('start typing');
    component.onDatasetSearch('abcd');
    expect(component.doiItems[0].label).toContain('searching');
  });

  it('setData builds tree or stops when empty', () => {
    component.setData({ data: [] });
    expect(component.loading).toBeFalse();
    const file: Datafile = {
      id: 'f1',
      path: 'x',
      name: 'f1',
      hidden: false,
      status: Filestatus.New,
      action: Fileaction.Copy,
    };
    component.setData({ data: [file] });
    expect(component.rowNodeMap.size).toBeGreaterThan(0);
  });

  it('continueSubmit polls until ready', fakeAsync(() => {
    component.submitCompute({
      persistentId: 'd1',
      queue: 'q',
      executable: 'run.sh',
      sendEmailOnSuccess: false,
    });
    component.sendEmailOnSuccess = true;
    component.continueSubmit();
    // flush compute() delayed emission to obtain key and trigger first getComputeData subscription
    tick();
    // first poll response: not ready yet
    mockData.emit({ ready: false, res: 'partial' });
    // allow microtasks (sleep immediate resolve) & re-subscription
    tick();
    // second poll response: ready
    mockData.emit({ ready: true, res: 'final', err: '' });
    tick();
    expect(component.output).toBe('final');
    expect(component.outputDisabled).toBeFalse();
  }));

  it('back navigates by changing location href', () => {
    component.back();
    expect(navigation.assign).toHaveBeenCalledWith('connect');
  });

  it('plugin flags drive showDVToken, datasetFieldEditable and sendMails', () => {
    plugin.showDvToken = true;
    plugin.datasetEditable = false;
    plugin.mailEnabled = true;
    expect(component.showDVToken()).toBeTrue();
    expect(component.datasetFieldEditable()).toBeFalse();
    expect(component.sendMails()).toBeTrue();
  });

  it('getDoiOptions loads options and handles errors', fakeAsync(() => {
    dvLookup.items = [
      { label: 'Dataset A', value: 'doi:A' },
      { label: 'Dataset B', value: 'doi:B' },
    ];
    component.getDoiOptions();
    tick();
    expect(component.doiItems.length).toBe(2);

    component.doiItems = [];
    dvLookup.error = 'fail';
    component.getDoiOptions();
    tick();
    expect(
      notification.errors.some((e) => e.includes('DOI lookup failed')),
    ).toBeTrue();
  }));

  it('getDoiOptions avoids reload when options already available', () => {
    component.doiItems = [{ label: 'existing', value: 'doi:X' }];
    component.datasetId = 'doi:X';
    dvLookup.items = [{ label: 'another', value: 'doi:Y' }];
    component.getDoiOptions();
    expect(component.doiItems[0].value).toBe('doi:X');
  });

  it('onUserChange clears selections', () => {
    component.dataverseToken = 'dvTok';
    component.doiItems = [{ label: 'a', value: 'a' }];
    component.datasetId = 'a';
    component.onUserChange();
    expect(component.doiItems.length).toBe(0);
    expect(component.datasetId).toBeUndefined();
  });

  it('onDatasetChange populates map or reports error', fakeAsync(() => {
    const df: Datafile = {
      id: '1',
      name: 'file',
      path: '',
      hidden: false,
      status: Filestatus.New,
      action: Fileaction.Copy,
    } as any;
    mockData.executableResponse = { data: [df] };
    component.datasetId = 'doi:1';
    component.onDatasetChange();
    tick();
    expect(component.loading).toBeFalse();
    expect(component.rowNodeMap.size).toBeGreaterThan(0);

    mockData.executableError = 'boom';
    component.onDatasetChange();
    tick();
    expect(
      notification.errors.some((e) =>
        e.includes('Getting executable files failed'),
      ),
    ).toBeTrue();
    mockData.executableError = undefined;
  }));

  it('continueSubmit handles compute errors gracefully', fakeAsync(() => {
    mockData.computeError = { error: 'server down' };
    component.submitCompute({
      persistentId: 'doi:1',
      queue: 'q',
      executable: 'run.sh',
      sendEmailOnSuccess: false,
    });
    component.continueSubmit();
    tick();
    expect(notification.errors.length).toBeGreaterThan(0);
  }));

  it('compute polling surfaces backend error messages', fakeAsync(() => {
    component.submitCompute({
      persistentId: 'doi:1',
      queue: 'q',
      executable: 'run.sh',
      sendEmailOnSuccess: false,
    });
    component.continueSubmit();
    tick();
    mockData.emit({ ready: true, err: 'failure', res: '' });
    tick();
    expect(notification.errors.some((e) => e.includes('failure'))).toBeTrue();
  }));
});
