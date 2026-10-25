import { ScrollDispatcher } from '@angular/cdk/scrolling';
import {
  provideHttpClient,
  withInterceptorsFromDi,
  withXhr,
} from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, withDisabledInitialNavigation } from '@angular/router';
import { Observable, Subject, of } from 'rxjs';
import { signal } from '@angular/core';
import { DataService } from '../data.service';
import { DvObjectLookupService } from '../dvobject.lookup.service';
import { CompareResult, Key } from '../models/compare-result';
import { Datafile, Fileaction, Filestatus } from '../models/datafile';
import { PluginService } from '../plugin.service';
import { NavigationService } from '../shared/navigation.service';
import { NotificationService } from '../shared/notification.service';
import { UtilsService } from '../utils.service';
import {
  measurePage,
  resizeTestWindow,
  scrolledContainers,
} from '../../testing/page-layout';
import { treegridStructure } from '../../testing/treegrid';
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
  checkAccessToQueue() {
    return of({ access: true, message: '' });
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
  readonly configLoaded$ = signal(true).asReadonly();
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
  getQueues(ext: string) {
    return ext === 'py' ? [{ label: 'CPU', value: 'cpu' }] : [];
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
        provideRouter([], withDisabledInitialNavigation()),
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: DataService, useValue: mockData },
        { provide: PluginService, useValue: plugin },
        { provide: DvObjectLookupService, useValue: dvLookup },
        { provide: NotificationService, useValue: notification },
        { provide: UtilsService, useClass: MockUtilsService },
        { provide: NavigationService, useValue: navigation },
      ],
    }).compileComponents();

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

describe('ComputeComponent layout and row state', () => {
  let fixture: ComponentFixture<ComputeComponent>;
  let component: ComputeComponent;
  let restoreWindow: () => void;

  const file = (id: string): Datafile => ({
    id,
    name: id,
    path: '',
    hidden: false,
    status: Filestatus.Equal,
    action: Fileaction.Ignore,
    attributes: { isFile: true },
  });

  // A 1366x768 window and 40 Python files, more rows than the table shows.
  beforeEach(async () => {
    restoreWindow = resizeTestWindow(1366, 768);
    // The dataset select as a button, as with the harness configuration.
    const plugin = new MockPluginService();
    plugin.datasetEditable = false;
    await TestBed.configureTestingModule({
      imports: [ComputeComponent],
      providers: [
        provideRouter([], withDisabledInitialNavigation()),
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: DataService, useValue: new MockDataService() },
        { provide: PluginService, useValue: plugin },
        {
          provide: DvObjectLookupService,
          useValue: new MockDvObjectLookupService(),
        },
        {
          provide: NotificationService,
          useValue: new MockNotificationService(),
        },
        { provide: UtilsService, useClass: MockUtilsService },
        { provide: NavigationService, useValue: new MockNavigationService() },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ComputeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    component.doiItems.set([
      { label: 'doi:10.1234/ABC - A dataset title', value: 'doi:10.1234/ABC' },
    ]);
    component.datasetId.set('doi:10.1234/ABC');
    component.data.set({
      id: 'doi:10.1234/ABC',
      url: 'https://example.org/ds',
    });
    component.rootNodeChildren.set(
      Array.from({ length: 40 }, (_, i) => file(`file${i}.py`)).map((f) => ({
        key: `${f.id}:file`,
        data: f,
      })),
    );
    await fixture.whenStable();
  });

  afterEach(() => restoreWindow());

  const rows = (): HTMLElement[] =>
    Array.from(
      fixture.nativeElement.querySelectorAll('div[app-executablefile]'),
    );

  // An open select or filter panel follows the host when the host scrolls.
  it('reports the scrolling page host to the overlays', () => {
    expect(
      scrolledContainers(
        TestBed.inject(ScrollDispatcher),
        fixture.nativeElement,
      ),
    ).toEqual([fixture.nativeElement]);
  });

  it('renders a treegrid with levels and the expansion of folder rows', async () => {
    component.rootNodeChildren.set([
      {
        key: 'dir',
        data: { id: 'dir', name: 'dir', path: '', hidden: false },
        children: [
          { key: 'dir/run.py:file', data: { ...file('run.py'), path: 'dir' } },
        ],
      },
      { key: 'top.py:file', data: file('top.py') },
    ]);
    await fixture.whenStable();
    rows()[0]
      .querySelector<HTMLButtonElement>('app-tree-toggler button')!
      .click();
    await fixture.whenStable();
    expect(treegridStructure(fixture.nativeElement)).toEqual({
      table: 'treegrid',
      label: 'Files',
      rowCount: '4',
      header: 'row 1',
      headerCells: ['columnheader', 'columnheader'],
      rows: [
        'dir: row 2, level 1, expanded true',
        'run.py: row 3, level 2, expanded null',
        'top.py: row 4, level 1, expanded null',
      ],
      cells: ['gridcell'],
      togglers: ['Toggle dir'],
    });
  });

  it('fits the window with 40 rows in the static body', () => {
    const body = fixture.nativeElement.querySelector('.tt-body') as HTMLElement;
    expect(body.classList).toContain('tt-body-static');
    expect(rows().length).toBe(40);
    const layout = measurePage(fixture.nativeElement);
    expect(layout.window).toBe(768);
    expect(layout.pageHeight).toBeLessThanOrEqual(layout.window);
    expect(layout.hostScrollHeight).toBeLessThanOrEqual(
      layout.hostClientHeight,
    );
    expect(layout.body).toBeGreaterThanOrEqual(12 * layout.rem);
    expect(layout.header).toBe(layout.headerNoRows);
    expect(body.scrollHeight).toBeGreaterThan(body.clientHeight);
  });

  it('draws 48 px rows with room for the focus rings of the queue select and the run button', () => {
    const row = rows()[0];
    const rowBox = row.getBoundingClientRect();
    expect(rowBox.height).toBe(48);
    // The action cell clips (overflow hidden) and sits above the row border.
    const cell = row.querySelectorAll('.tt-cell')[1] as HTMLElement;
    expect(getComputedStyle(cell).overflow).toBe('hidden');
    const box = cell.getBoundingClientRect();
    expect(box.top).toBeGreaterThanOrEqual(rowBox.top);
    expect(box.bottom).toBeLessThanOrEqual(rowBox.bottom - 1);
    for (const control of [
      row.querySelector('.form-select'),
      row.querySelector('button.btn-primary'),
    ] as HTMLElement[]) {
      const r = control.getBoundingClientRect();
      expect(r.height).toBeGreaterThan(0);
      expect(r.top - box.top).toBeGreaterThanOrEqual(4);
      expect(box.bottom - r.bottom).toBeGreaterThanOrEqual(4);
    }
  });

  it('keeps the dataset select on one line and fits the window with a long label', async () => {
    const trigger = fixture.nativeElement.querySelector(
      '#datasetId',
    ) as HTMLButtonElement;
    const oneLine = trigger.getBoundingClientRect().height;
    const label =
      'doi:10.1234/ABC - A rather long dataset title about measurements of ' +
      'something in several Flemish rivers between 2019 and 2024';
    component.doiItems.set([{ label, value: 'doi:10.1234/ABC' }]);
    await fixture.whenStable();
    expect(trigger.textContent).toContain(label);
    expect(trigger.getBoundingClientRect().height).toBe(oneLine);
    const layout = measurePage(fixture.nativeElement);
    expect(layout.pageHeight).toBeLessThanOrEqual(layout.window);
    expect(layout.hostScrollHeight).toBeLessThanOrEqual(
      layout.hostClientHeight,
    );
    expect(layout.header).toBe(layout.headerNoRows);
  });

  it('keeps the queue chosen in the first row after scrolling', async () => {
    const trigger = rows()[0].querySelector(
      '.form-select',
    ) as HTMLButtonElement;
    trigger.click();
    await fixture.whenStable();
    const option = document.querySelector(
      '.cdk-overlay-container .app-select-option',
    ) as HTMLElement;
    expect(option.textContent).toContain('CPU');
    option.click();
    await fixture.whenStable();
    expect(trigger.textContent).toContain('CPU');
    const body = fixture.nativeElement.querySelector('.tt-body') as HTMLElement;
    body.scrollTop = body.scrollHeight;
    body.dispatchEvent(new Event('scroll'));
    await fixture.whenStable();
    // The table really scrolled: the first row is out of view, the last in,
    // and every row still exists, so the first one kept its state.
    expect(body.scrollTop).toBeGreaterThan(0);
    expect(rows().length).toBe(40);
    const view = body.getBoundingClientRect();
    expect(rows()[0].getBoundingClientRect().bottom).toBeLessThanOrEqual(
      view.top,
    );
    expect(rows()[39].getBoundingClientRect().bottom).toBeLessThanOrEqual(
      view.bottom + 1,
    );
    const firstRow = rows()[0];
    expect(firstRow.querySelector('.form-select')!.textContent).toContain(
      'CPU',
    );
    expect(
      (firstRow.querySelector('button.btn-primary') as HTMLButtonElement)
        .disabled,
    ).toBeFalse();
  });
});
