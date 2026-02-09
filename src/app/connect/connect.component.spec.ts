import {
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ConnectComponent } from './connect.component';
// Router intentionally not imported (was unused)
import { PluginService } from '../plugin.service';

// Helper to mock history.state
function setHistoryState(state: any) {
  window.history.replaceState(state, '');
}

describe('ConnectComponent', () => {
  beforeEach(async () => {
    const pluginServiceStub: any = {
      setConfig: () => Promise.resolve(),
      getPlugins: () => [],
      getPluginIds: () => [],
      getPlugin: () =>
        ({ tokenGetter: {}, repoNameFieldHasSearch: false }) as any,
      dataverseHeader: () => 'Dataverse',
      showDVTokenGetter: () => false,
      showDVToken: () => false,
      isStoreDvToken: () => false,
      collectionOptionsHidden: () => false,
      collectionFieldEditable: () => true,
      datasetFieldEditable: () => true,
      createNewDatasetEnabled: () => true,
      getRedirectUri: () => '',
      getExternalURL: () => '',
      getGlobusPlugin: () => undefined,
      // Signal properties for computed signal consumers
      dataverseHeader$: signal('Dataverse').asReadonly(),
      showDVTokenGetter$: signal(false).asReadonly(),
      showDVToken$: signal(false).asReadonly(),
      collectionOptionsHidden$: signal(false).asReadonly(),
      collectionFieldEditable$: signal(true).asReadonly(),
      datasetFieldEditable$: signal(true).asReadonly(),
      createNewDatasetEnabled$: signal(true).asReadonly(),
      externalURL$: signal('').asReadonly(),
    } as Partial<PluginService> as PluginService;

    await TestBed.configureTestingModule({
      imports: [ConnectComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: PluginService, useValue: pluginServiceStub },
      ],
    }).compileComponents();
  });

  it('restores datasetId from connectSnapshot', async () => {
    setHistoryState({
      connectSnapshot: {
        plugin: 'github',
        pluginId: 'github',
        repo_name: 'owner/repo',
        dataset_id: 'doi:10.123/ABC',
      },
    });
    const fixture = TestBed.createComponent(ConnectComponent);
    const comp = fixture.componentInstance;
    fixture.detectChanges();
    expect(comp.datasetId()).toBe('doi:10.123/ABC');
    expect(
      comp.doiItems().some((i) => i.value === 'doi:10.123/ABC'),
    ).toBeTrue();
  });

  it('falls back to datasetId in navigation state when missing in snapshot', async () => {
    setHistoryState({
      connectSnapshot: {
        plugin: 'github',
        pluginId: 'github',
        repo_name: 'owner/repo',
        dataset_id: '',
      },
      datasetId: 'doi:10.999/MISSING',
    });
    const fixture = TestBed.createComponent(ConnectComponent);
    const comp = fixture.componentInstance;
    fixture.detectChanges();
    expect(comp.datasetId()).toBe('doi:10.999/MISSING');
  });

  it('restores collectionId from navigation state', () => {
    setHistoryState({
      connectSnapshot: {
        plugin: 'github',
        pluginId: 'github',
        repo_name: 'owner/repo',
      },
      collectionId: 'root:COLL',
    });
    const fixture = TestBed.createComponent(ConnectComponent);
    const comp = fixture.componentInstance;
    fixture.detectChanges();
    expect(comp.collectionId()).toBe('root:COLL');
  });

  it('restores collectionId from snapshot if not in navigation state', () => {
    setHistoryState({
      connectSnapshot: {
        plugin: 'github',
        pluginId: 'github',
        repo_name: 'owner/repo',
        collectionId: 'root:SNAP',
      },
    });
    const fixture = TestBed.createComponent(ConnectComponent);
    const comp = fixture.componentInstance;
    fixture.detectChanges();
    expect(comp.collectionId()).toBe('root:SNAP');
  });
  it('changing plugin does NOT clear restored datasetId or collectionId', () => {
    setHistoryState({
      connectSnapshot: {
        plugin: 'github',
        pluginId: 'github',
        repo_name: 'owner/repo',
        dataset_id: 'doi:10.777/KEEP',
        collectionId: 'root:KEEP',
      },
    });
    const fixture = TestBed.createComponent(ConnectComponent);
    const comp: any = fixture.componentInstance;
    fixture.detectChanges();
    const originalDataset = comp.datasetId();
    const originalCollection = comp.collectionId();

    // Override pluginService behavior at runtime for this test
    const pluginService: any = TestBed.inject(PluginService);
    pluginService.getPluginIds = (plugin?: string) => {
      if (plugin === 'newPlugin') {
        return [{ label: 'New', value: 'new' }];
      }
      return [{ label: 'GitHub', value: 'github' }];
    };
    pluginService.getPlugins = () => [
      { label: 'GitHub', value: 'github' },
      { label: 'New', value: 'new' },
    ];

    // Simulate user selecting a different plugin
    comp.plugin.set('newPlugin');
    comp.changePlugin();

    expect(comp.datasetId()).toBe(originalDataset);
    expect(comp.collectionId()).toBe(originalCollection);
    // Ensure the ids are still present in their respective select item arrays
    expect(
      comp.doiItems().some((i: any) => i.value === originalDataset),
    ).toBeTrue();
    expect(
      comp.collectionItems().some((i: any) => i.value === originalCollection),
    ).toBeTrue();
  });

  it('ensureSelectContains adds value only once', () => {
    const fixture = TestBed.createComponent(ConnectComponent);
    const comp: any = fixture.componentInstance;
    fixture.detectChanges();
    const arr: any[] = [];
    comp['ensureSelectContains'](
      arr,
      'val1',
      (items: any[]) => ((arr.length = 0), arr.push(...items)),
    );
    comp['ensureSelectContains'](
      arr,
      'val1',
      (items: any[]) => ((arr.length = 0), arr.push(...items)),
    ); // second call should not duplicate
    expect(arr.filter((i) => i.value === 'val1').length).toBe(1);
  });

  it('perform reset when reset query param present', () => {
    // simulate history state that will get cleared
    window.history.replaceState({ datasetId: 'shouldClear' }, '');
    const fixture = TestBed.createComponent(ConnectComponent);
    const comp: any = fixture.componentInstance;
    // directly invoke private handleQueryParams with reset flag to avoid router dependency
    comp['handleQueryParams']({ reset: '1' });
    expect(comp.datasetId()).toBeUndefined();
  });
});
