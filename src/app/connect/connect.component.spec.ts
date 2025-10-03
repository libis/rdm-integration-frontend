import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

import { ConnectComponent } from './connect.component';
import { Router } from '@angular/router';
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
      getPlugin: () => ({ tokenGetter: {}, repoNameFieldHasSearch: false }) as any,
      dataverseHeader: () => 'Dataverse',
      showDVTokenGetter: () => false,
      showDVToken: () => false,
      collectionOptionsHidden: () => false,
      collectionFieldEditable: () => true,
      datasetFieldEditable: () => true,
      createNewDatasetEnabled: () => true,
      getRedirectUri: () => '',
      getExternalURL: () => '',
      isStoreDvToken: () => false,
      getGlobusPlugin: () => undefined,
    } as Partial<PluginService> as PluginService;

    await TestBed.configureTestingModule({
      imports: [RouterTestingModule, ConnectComponent],
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideNoopAnimations(),
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
    expect(comp.datasetId).toBe('doi:10.123/ABC');
    expect(comp.doiItems.some(i => i.value === 'doi:10.123/ABC')).toBeTrue();
  });

  it('falls back to datasetId in navigation state when missing in snapshot', async () => {
    setHistoryState({
      connectSnapshot: {
        plugin: 'github',
        pluginId: 'github',
        repo_name: 'owner/repo',
        dataset_id: '',
      },
      datasetId: 'doi:10.999/MISSING'
    });
  const fixture = TestBed.createComponent(ConnectComponent);
  const comp = fixture.componentInstance;
  fixture.detectChanges();
    expect(comp.datasetId).toBe('doi:10.999/MISSING');
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
    expect(comp.collectionId).toBe('root:COLL');
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
    expect(comp.collectionId).toBe('root:SNAP');
  });
});
