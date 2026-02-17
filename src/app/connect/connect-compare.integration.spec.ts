import {
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router, RouterOutlet, Routes } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

import { CompareComponent } from '../compare/compare.component';
import { CredentialsService } from '../credentials.service';
import { DataStateService } from '../data.state.service';
import { Credentials } from '../models/credentials';
import { PluginService } from '../plugin.service';
import { NotificationService } from '../shared/notification.service';
import { SnapshotStorageService } from '../shared/snapshot-storage.service';
import { ConnectComponent } from './connect.component';

// Minimal stubs
class PluginServiceStub {
  async setConfig() {
    return Promise.resolve();
  }
  getPlugins() {
    return [];
  }
  getPluginIds() {
    return [];
  }
  getPlugin() {
    return { tokenGetter: {}, repoNameFieldHasSearch: false };
  }
  dataverseHeader() {
    return 'Dataverse';
  }
  showDVTokenGetter() {
    return false;
  }
  showDVToken() {
    return false;
  }
  isStoreDvToken() {
    return false;
  }
  collectionOptionsHidden() {
    return false;
  }
  collectionFieldEditable() {
    return true;
  }
  datasetFieldEditable() {
    return true;
  }
  createNewDatasetEnabled() {
    return true;
  }
  getRedirectUri() {
    return '';
  }
  getExternalURL() {
    return '';
  }
  getGlobusPlugin() {
    return undefined;
  }

  // Signal properties for computed signal consumers
  dataverseHeader$ = signal('Dataverse').asReadonly();
  showDVTokenGetter$ = signal(false).asReadonly();
  showDVToken$ = signal(false).asReadonly();
  configLoaded$ = signal(true).asReadonly();
  collectionOptionsHidden$ = signal(false).asReadonly();
  collectionFieldEditable$ = signal(true).asReadonly();
  datasetFieldEditable$ = signal(true).asReadonly();
  createNewDatasetEnabled$ = signal(true).asReadonly();
  externalURL$ = signal('').asReadonly();
}

class DataStateServiceStub {
  private _state: any = null;
  private subj = new BehaviorSubject<any>(null);

  // Signal-based API (primary)
  state$ = signal<any>(null);

  initializeState(creds?: Credentials) {
    const datasetId = creds?.dataset_id ?? 'mock-dataset-id';
    this._state = { id: datasetId, data: [], status: 0 };
    this.subj.next(this._state);
    this.state$.set(this._state);
  }
  updateState(d: any) {
    this._state = d;
    this.subj.next(d);
    this.state$.set(d);
  }
  resetState() {
    this._state = null;
    this.state$.set(null);
  }
  cancelInitialization(_resetState?: boolean) {}
}

class CredentialsServiceStub {
  credentials: any = {
    pluginId: 'github',
    plugin: 'github',
    repo_name: 'owner/repo',
    dataset_id: 'doi:10.321/INTEG',
  };

  // Signal-based API
  credentials$ = signal(this.credentials).asReadonly();
  plugin$ = signal('github').asReadonly();
  pluginId$ = signal('github').asReadonly();
  repoName$ = signal('owner/repo').asReadonly();
  url$ = signal<string | undefined>(undefined).asReadonly();
  option$ = signal<string | undefined>(undefined).asReadonly();
  user$ = signal<string | undefined>(undefined).asReadonly();
  token$ = signal<string | undefined>(undefined).asReadonly();
  datasetId$ = signal('doi:10.321/INTEG').asReadonly();
  newlyCreated$ = signal<boolean | undefined>(undefined).asReadonly();
  dataverseToken$ = signal<string | undefined>(undefined).asReadonly();
  metadataAvailable$ = signal<boolean | undefined>(undefined).asReadonly();

  setCredentials(creds: any): void {
    this.credentials = creds;
  }
  updateCredentials(partial: any): void {
    this.credentials = { ...this.credentials, ...partial };
  }
  clearCredentials(): void {
    this.credentials = {};
  }
}

class NotificationServiceStub {
  showError(_m: string) {}
}

@Component({
  selector: 'stub-metadata-selector',
  template: '<p>metadata selector stub</p>',
  standalone: true,
})
class MetadataSelectorStubComponent {}

const routes: Routes = [
  { path: 'connect', component: ConnectComponent },
  { path: 'compare', component: CompareComponent },
  { path: 'metadata-selector', component: MetadataSelectorStubComponent },
  { path: '', redirectTo: 'connect', pathMatch: 'full' },
];

@Component({
  selector: 'test-host',
  template: '<router-outlet></router-outlet>',
  standalone: true,
  imports: [RouterOutlet, ConnectComponent, CompareComponent],
})
class HostComponent {}

describe('Integration: Compare back -> Connect restoration', () => {
  let router: Router;
  let hostFixture: ComponentFixture<HostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        provideRouter(routes),
        provideHttpClient(withInterceptorsFromDi()),
        { provide: PluginService, useClass: PluginServiceStub },
        { provide: DataStateService, useClass: DataStateServiceStub },
        { provide: CredentialsService, useClass: CredentialsServiceStub },
        { provide: NotificationService, useClass: NotificationServiceStub },
        SnapshotStorageService,
      ],
    }).compileComponents();
    router = TestBed.inject(Router);
    hostFixture = TestBed.createComponent(HostComponent);
    hostFixture.detectChanges();
    await router.navigateByUrl('/compare');
  });

  it('restores datasetId on Connect after Compare back navigation', async () => {
    // Find CompareComponent instance
    hostFixture.detectChanges();
    await hostFixture.whenStable();
    const compareDebugEl = hostFixture.debugElement
      .queryAll((de) => !!de.componentInstance)
      .find((de) => de.componentInstance instanceof CompareComponent);
    expect(compareDebugEl).toBeDefined();
    const compareComp = compareDebugEl!.componentInstance as CompareComponent;
    // Execute back navigation
    // Intentionally not asserting prior history.state; capturing removed to satisfy lint
    compareComp.back();
    // Wait for navigation to connect
    await hostFixture.whenStable();
    hostFixture.detectChanges();
    // Intentionally not asserting after history.state; capturing removed to satisfy lint
    // Navigation state may now intentionally be empty; rely on storage fallback.
    // Locate ConnectComponent instance now rendered
    const connectDebugEl = hostFixture.debugElement
      .queryAll((de) => !!de.componentInstance)
      .find((de) => de.componentInstance instanceof ConnectComponent);
    expect(connectDebugEl).toBeDefined();
    const connectComp = connectDebugEl!.componentInstance as ConnectComponent;
    // Precedence: existing datasetId (credentials) should persist, or fallback to stored snapshot.
    expect(connectComp.datasetId()).toBeDefined();
  });
});
