import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  tick,
} from '@angular/core/testing';
import {
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError, Observable } from 'rxjs';
import { DownloadComponent } from './download.component';
import { Datafile, Fileaction } from '../models/datafile';
import { TreeNode, SelectItem } from 'primeng/api';
import { NotificationService } from '../shared/notification.service';
import { RepoLookupService } from '../repo.lookup.service';
import { SubmitService } from '../submit.service';
import { PluginService } from '../plugin.service';
import { ActivatedRoute } from '@angular/router';

class MockNotificationService {
  errors: string[] = [];
  successes: string[] = [];
  showError(msg: string) {
    this.errors.push(msg);
  }
  showSuccess(msg: string) {
    this.successes.push(msg);
  }
}

class MockRepoLookupService {
  options: SelectItem<string>[] = [];
  search() {
    return of([]);
  }
  getOptions() {
    return new Observable<SelectItem<string>[]>((obs) => {
      queueMicrotask(() => {
        obs.next(this.options);
        obs.complete();
      });
    });
  }
}

class MockSubmitService {
  succeed = true;
  download() {
    return new Observable<string>((obs) => {
      queueMicrotask(() => {
        if (this.succeed) {
          obs.next('sub-123');
          obs.complete();
        } else {
          obs.error({ error: 'failX' });
        }
      });
    });
  }
}

class MockPluginService {
  setConfig() {
    return Promise.resolve();
  }
  isStoreDvToken() {
    return false;
  }
  showDVToken() {
    return false;
  }
  datasetFieldEditable() {
    return true;
  }
  getGlobusPlugin() {
    return {
      repoNameFieldName: 'Repo Name',
      sourceUrlFieldValue: 'https://example.com',
      repoNameFieldHasInit: true,
    } as any;
  }
}

describe('DownloadComponent', () => {
  let component: DownloadComponent;
  let fixture: ComponentFixture<DownloadComponent>;

  let notification: MockNotificationService;
  let repoLookup: MockRepoLookupService;
  let submit: MockSubmitService;
  let plugin: MockPluginService;

  beforeEach(async () => {
    notification = new MockNotificationService();
    repoLookup = new MockRepoLookupService();
    submit = new MockSubmitService();
    plugin = new MockPluginService();
    await TestBed.configureTestingModule({
      imports: [RouterTestingModule, DownloadComponent],
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: NotificationService, useValue: notification },
        { provide: RepoLookupService, useValue: repoLookup },
        { provide: SubmitService, useValue: submit },
        { provide: PluginService, useValue: plugin },
        { provide: ActivatedRoute, useValue: { queryParams: of({}) } },
      ],
    })
      .overrideComponent(DownloadComponent, {
        set: { template: '<div></div>' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(DownloadComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    // mimic plugin loaded state
    component.globusPlugin = plugin.getGlobusPlugin();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('rowClass reflects action styling', () => {
    const file: Datafile = {
      id: '1',
      name: 'a',
      path: '',
      hidden: false,
      action: Fileaction.Download,
    };
    expect(component.rowClass(file)).toContain('background-color');
    file.action = Fileaction.Custom;
    expect(component.rowClass(file)).toContain('FFFAA0');
    file.action = Fileaction.Ignore;
    expect(component.rowClass(file)).toBe('');
  });

  it('downloadDisabled true when no selected download actions', () => {
    component.rowNodeMap.set('', {
      data: { id: '', name: '', path: '', hidden: false },
    });
    expect(component.downloadDisabled()).toBeTrue();
  });

  it('onDatasetSearch guards short terms and triggers search for valid term', () => {
    component.onDatasetSearch(null);
    expect(component.doiItems[0].label).toContain('start typing');
    component.onDatasetSearch('ab');
    expect(component.doiItems[0].label).toContain('start typing');
    component.onDatasetSearch('abc');
    expect(component.doiItems[0].label).toContain('searching');
  });

  it('toggleAction propagates through root when present', () => {
    const root: TreeNode<Datafile> = {
      data: {
        id: '',
        name: '',
        path: '',
        hidden: false,
        action: Fileaction.Ignore,
      },
      children: [],
    };
    component.rowNodeMap.set('', root);
    component.toggleAction(); // should not throw
    expect(root.data?.action).toBeDefined();
  });

  it('getRepoLookupRequest enforces repo name presence when not search', () => {
    component.globusPlugin = {
      repoNameFieldName: 'Repo Name',
      sourceUrlFieldValue: 'https://x',
    } as any;
    const req = component.getRepoLookupRequest(false);
    expect(req).toBeUndefined();
    expect(notification.errors.some((e) => e.includes('Repo Name'))).toBeTrue();
  });

  it('getRepoLookupRequest short-circuits when branchItems already loaded', () => {
    component.branchItems = [{ label: 'existing', value: 'v' }];
    const req = component.getRepoLookupRequest(false);
    expect(req).toBeUndefined();
  });

  it('getRepoLookupRequest builds request when conditions satisfied', () => {
    component.selectedRepoName = 'repoA';
    const req = component.getRepoLookupRequest(false);
    expect(req).toBeDefined();
    expect(component.branchItems[0].label).toBe('Loading...');
  });

  it('getOptions populates node children for nested request', fakeAsync(() => {
    component.selectedRepoName = 'repoA';
    repoLookup.options = [
      { label: 'opt1', value: 'o1' },
      { label: 'opt2', value: 'o2' },
    ];
    const parent: TreeNode<string> = {
      label: 'p',
      data: 'p',
      selectable: true,
    };
    component.getOptions(parent);
    tick();
    expect(parent.children?.length).toBe(2);
    expect(component.optionsLoading).toBeFalse();
  }));

  it('getOptions handles error path', fakeAsync(() => {
    component.selectedRepoName = 'repoA';
    // force error
    spyOn(repoLookup, 'getOptions').and.returnValue(
      new Observable((obs) => {
        queueMicrotask(() => obs.error({ error: 'BOOM' }));
      }),
    );
    component.getOptions();
    tick();
    expect(
      notification.errors.some((e) => e.includes('Branch lookup failed')),
    ).toBeTrue();
    expect(component.branchItems.length).toBe(0);
    expect(component.option).toBeUndefined();
  }));

  it('download success and error flows', fakeAsync(() => {
    // build rowNodeMap
    const df: Datafile = {
      id: '1',
      name: 'f',
      path: '',
      hidden: false,
      action: Fileaction.Download,
    } as any;
    component.rowNodeMap.set('1:file', { data: df });
    component.option = 'branchX';
    component.selectedRepoName = 'repoX';
    submit.succeed = true;
    component.download();
    tick();
    expect(notification.successes.length).toBe(1);
    // error
    submit.succeed = false;
    component.downloadRequested = false; // reset to allow second attempt
    component.download();
    tick();
    expect(
      notification.errors.some((e) => e.includes('Download request failed')),
    ).toBeTrue();
  }));

  it('downloadDisabled responds to selection & option presence', () => {
    const df: Datafile = {
      id: '1',
      name: 'f',
      path: '',
      hidden: false,
      action: Fileaction.Ignore,
    } as any;
    component.rowNodeMap.set('1:file', { data: df });
    component.option = 'b';
    expect(component.downloadDisabled()).toBeTrue();
    df.action = Fileaction.Download;
    expect(component.downloadDisabled()).toBeFalse();
  });

  it('startRepoSearch uses init capability when enabled', fakeAsync(() => {
    component.globusPlugin = { repoNameFieldHasInit: true } as any;
    component.startRepoSearch();
    expect(component.repoNames[0].label).toContain('loading');
  }));

  it('startRepoSearch shows typing hint when init disabled', () => {
    component.globusPlugin = { repoNameFieldHasInit: false } as any;
    component.startRepoSearch();
    expect(component.repoNames[0].label).toContain('start typing');
  });
});
