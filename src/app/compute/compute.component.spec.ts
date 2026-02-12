import {
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, Subject } from 'rxjs';
import { signal } from '@angular/core';
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
  private readonly _showDvToken = signal(false);
  private readonly _datasetEditable = signal(true);
  private readonly _mailEnabled = signal(false);
  private readonly _storeDvToken = signal(false);

  // Signals for computed signal consumers
  readonly showDVToken$ = this._showDvToken.asReadonly();
  readonly datasetFieldEditable$ = this._datasetEditable.asReadonly();
  readonly sendMails$ = this._mailEnabled.asReadonly();
  readonly storeDvToken$ = this._storeDvToken.asReadonly();
  readonly dataverseHeader$ = signal('Dataverse:').asReadonly();

  // Setters for test control
  set showDvToken(v: boolean) {
    this._showDvToken.set(v);
  }
  set datasetEditable(v: boolean) {
    this._datasetEditable.set(v);
  }
  set mailEnabled(v: boolean) {
    this._mailEnabled.set(v);
  }
  set storeDvToken(v: boolean) {
    this._storeDvToken.set(v);
  }

  setConfig() {
    return Promise.resolve();
  }
  showDVToken() {
    return this._showDvToken();
  }
  isStoreDvToken() {
    return this._storeDvToken();
  }
  datasetFieldEditable() {
    return this._datasetEditable();
  }
  sendMails() {
    return this._mailEnabled();
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
    expect(component.doiItems()[0].label).toContain('start typing');
    component.onDatasetSearch('abcd');
    expect(component.doiItems()[0].label).toContain('searching');
  });

  it('setData builds tree or stops when empty', () => {
    component.setData({ data: [] });
    expect(component.loading()).toBeFalse();
    const file: Datafile = {
      id: 'f1',
      path: 'x',
      name: 'f1',
      hidden: false,
      status: Filestatus.New,
      action: Fileaction.Copy,
    };
    component.setData({ data: [file] });
    expect(component.rowNodeMap().size).toBeGreaterThan(0);
  });

  it('continueSubmit polls until ready', async () => {
    component.submitCompute({
      persistentId: 'd1',
      queue: 'q',
      executable: 'run.sh',
      sendEmailOnSuccess: false,
    });
    component.sendEmailOnSuccess.set(true);
    component.continueSubmit();
    // flush compute() delayed emission to obtain key and trigger first getComputeData subscription
    await new Promise<void>((r) => setTimeout(r));
    // first poll response: not ready yet
    mockData.emit({ ready: false, res: 'partial' });
    // allow microtasks (sleep immediate resolve) & re-subscription
    await new Promise<void>((r) => setTimeout(r));
    // second poll response: ready
    mockData.emit({ ready: true, res: 'final', err: '' });
    await new Promise<void>((r) => setTimeout(r));
    expect(component.output()).toBe('final');
    expect(component.outputDisabled()).toBeFalse();
  });

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

  it('getDoiOptions loads options and handles errors', async () => {
    dvLookup.items = [
      { label: 'Dataset A', value: 'doi:A' },
      { label: 'Dataset B', value: 'doi:B' },
    ];
    component.getDoiOptions();
    await new Promise<void>((r) => setTimeout(r));
    expect(component.doiItems().length).toBe(2);

    component.doiItems.set([]);
    dvLookup.error = 'fail';
    component.getDoiOptions();
    await new Promise<void>((r) => setTimeout(r));
    expect(
      notification.errors.some((e) => e.includes('DOI lookup failed')),
    ).toBeTrue();
  });

  it('getDoiOptions avoids reload when options already available', () => {
    component.doiItems.set([{ label: 'existing', value: 'doi:X' }]);
    component.datasetId.set('doi:X');
    dvLookup.items = [{ label: 'another', value: 'doi:Y' }];
    component.getDoiOptions();
    expect(component.doiItems()[0].value).toBe('doi:X');
  });

  it('onUserChange clears selections', () => {
    component.dataverseToken.set('dvTok');
    component.doiItems.set([{ label: 'a', value: 'a' }]);
    component.datasetId.set('a');
    component.onUserChange();
    expect(component.doiItems().length).toBe(0);
    expect(component.datasetId()).toBeUndefined();
  });

  it('onDatasetChange populates map or reports error', async () => {
    const df: Datafile = {
      id: '1',
      name: 'file',
      path: '',
      hidden: false,
      status: Filestatus.New,
      action: Fileaction.Copy,
    } as any;
    mockData.executableResponse = { data: [df] };
    component.datasetId.set('doi:1');
    component.onDatasetChange();
    await new Promise<void>((r) => setTimeout(r));
    expect(component.loading()).toBeFalse();
    expect(component.rowNodeMap().size).toBeGreaterThan(0);

    mockData.executableError = 'boom';
    component.onDatasetChange();
    await new Promise<void>((r) => setTimeout(r));
    expect(
      notification.errors.some((e) =>
        e.includes('Getting executable files failed'),
      ),
    ).toBeTrue();
    mockData.executableError = undefined;
  });

  it('continueSubmit handles compute errors gracefully', async () => {
    mockData.computeError = { error: 'server down' };
    component.submitCompute({
      persistentId: 'doi:1',
      queue: 'q',
      executable: 'run.sh',
      sendEmailOnSuccess: false,
    });
    component.continueSubmit();
    await new Promise<void>((r) => setTimeout(r));
    expect(notification.errors.length).toBeGreaterThan(0);
  });

  it('compute polling surfaces backend error messages', async () => {
    component.submitCompute({
      persistentId: 'doi:1',
      queue: 'q',
      executable: 'run.sh',
      sendEmailOnSuccess: false,
    });
    component.continueSubmit();
    await new Promise<void>((r) => setTimeout(r));
    mockData.emit({ ready: true, err: 'failure', res: '' });
    await new Promise<void>((r) => setTimeout(r));
    expect(notification.errors.some((e) => e.includes('failure'))).toBeTrue();
  });
});
